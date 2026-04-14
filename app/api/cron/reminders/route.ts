import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SALON_TZ = process.env.SALON_TIMEZONE ?? 'Asia/Colombo';
const SALON_NAME = process.env.SALON_NAME ?? 'Our Salon';

interface ReminderRow {
  id: string;
  start_at: string;
  customers: { phone: string } | null;
  services: { name: string } | null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get('authorization');
  if (secret && provided !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sb = getSupabase();
  const now = new Date();
  const from = new Date(now.getTime() + 60 * 60_000).toISOString();       // +60 min
  const to   = new Date(now.getTime() + 75 * 60_000).toISOString();       // +75 min

  const { data, error } = await sb
    .from('appointments')
    .select('id, start_at, customers(phone), services(name)')
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)
    .gte('start_at', from)
    .lt('start_at', to);

  if (error) {
    console.error('reminder query error', error);
    return new Response('DB error', { status: 500 });
  }

  const rows = (data ?? []) as unknown as ReminderRow[];
  let sent = 0;

  for (const r of rows) {
    const phone = r.customers?.phone;
    const service = r.services?.name ?? 'your appointment';
    if (!phone) continue;
    const timeLabel = new Date(r.start_at).toLocaleString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SALON_TZ,
    });
    try {
      await sendWhatsApp(phone, `Reminder: ${service} at ${SALON_NAME} on ${timeLabel}. Reply CANCEL to cancel.`);
      await sb.from('appointments').update({ reminder_sent: true }).eq('id', r.id);
      sent++;
    } catch (err) {
      console.error('send reminder failed', r.id, err);
    }
  }

  return Response.json({ checked: rows.length, sent });
}
