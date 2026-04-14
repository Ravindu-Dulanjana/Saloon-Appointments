import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getAvailableSlots } from '@/lib/booking/slots';
import { fmtDateTime, fmtTime, todayIsoDate } from '@/lib/format';
import { RescheduleForm } from './RescheduleForm';
import { CancelButton } from '../../CancelButton';

interface Appt {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  reminder_sent: boolean;
  customers: { id: string; phone: string; name: string | null } | null;
  services: { id: string; name: string; duration_minutes: number } | null;
}

export default async function AppointmentDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('appointments')
    .select(
      'id, start_at, end_at, status, reminder_sent, customers(id, phone, name), services(id, name, duration_minutes)',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();
  const appt = data as unknown as Appt;

  const duration = appt.services?.duration_minutes ?? 30;
  const dateForSlots = searchParams.date ?? todayIsoDate();
  const slots = await getAvailableSlots(dateForSlots, duration, 15, appt.id);

  return (
    <div>
      <Link href="/admin" className="mb-4 inline-block text-sm text-slate-600 hover:underline">
        ← Back
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{appt.services?.name ?? 'Appointment'}</h1>
            <p className="mt-1 text-slate-600">{fmtDateTime(appt.start_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                appt.status === 'confirmed'
                  ? 'bg-green-100 text-green-800'
                  : appt.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {appt.status}
            </span>
            {appt.status === 'confirmed' && <CancelButton id={appt.id} />}
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Customer</dt>
            <dd>
              {appt.customers ? (
                <Link
                  href={`/admin/customers/${appt.customers.id}`}
                  className="text-slate-900 hover:underline"
                >
                  {appt.customers.name ?? appt.customers.phone.replace('whatsapp:', '')}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd>{appt.customers?.phone.replace('whatsapp:', '') ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Duration</dt>
            <dd>{duration} min</dd>
          </div>
          <div>
            <dt className="text-slate-500">Reminder sent</dt>
            <dd>{appt.reminder_sent ? 'Yes' : 'No'}</dd>
          </div>
        </dl>

        {appt.status === 'confirmed' && (
          <div className="border-t border-slate-200 pt-6">
            <h2 className="mb-3 text-lg font-semibold">Reschedule</h2>
            <RescheduleForm
              appointmentId={appt.id}
              date={dateForSlots}
              slots={slots.map((s) => ({ iso: s, label: fmtTime(s) }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
