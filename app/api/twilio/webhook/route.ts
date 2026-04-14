import { NextRequest } from 'next/server';
import { handleIncoming } from '@/lib/booking/flow';
import { buildTwiML, validateTwilioSignature } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) params[k] = String(v);

  const signature = req.headers.get('x-twilio-signature');
  const url = `${req.nextUrl.origin}${req.nextUrl.pathname}`;

  if (process.env.NODE_ENV === 'production') {
    if (!validateTwilioSignature(signature, url, params)) {
      return new Response('Invalid signature', { status: 403 });
    }
  }

  const from = params.From;      // e.g. "whatsapp:+94771234567"
  const body = params.Body ?? '';
  if (!from) return new Response('Missing From', { status: 400 });

  let reply: string;
  try {
    reply = await handleIncoming(from, body);
  } catch (err) {
    console.error('flow error', err);
    reply = 'Sorry, something went wrong. Please send "hi" to start again.';
  }

  return new Response(buildTwiML(reply), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
