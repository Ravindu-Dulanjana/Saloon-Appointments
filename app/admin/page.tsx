import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/format';
import { CancelButton } from './CancelButton';

interface Row {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customers: { id: string; phone: string; name: string | null } | null;
  services: { name: string; duration_minutes: number } | null;
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: { status?: string; from?: string };
}) {
  const sb = getSupabase();
  const fromIso = searchParams.from
    ? new Date(searchParams.from).toISOString()
    : new Date(Date.now() - 1000 * 60 * 60).toISOString();

  let q = sb
    .from('appointments')
    .select('id, start_at, end_at, status, customers(id, phone, name), services(name, duration_minutes)')
    .gte('start_at', fromIso)
    .order('start_at', { ascending: true })
    .limit(200);

  if (searchParams.status && searchParams.status !== 'all') {
    q = q.eq('status', searchParams.status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Appointments</h1>
        <div className="flex gap-2 text-sm">
          {(['all', 'confirmed', 'cancelled', 'completed'] as const).map((s) => (
            <Link
              key={s}
              href={`/admin?status=${s}`}
              className={`rounded border px-3 py-1 ${
                (searchParams.status ?? 'confirmed') === s
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500">No appointments.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{fmtDateTime(r.start_at)}</td>
                  <td className="px-4 py-3">
                    {r.customers ? (
                      <Link
                        href={`/admin/customers/${r.customers.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {r.customers.name ?? r.customers.phone.replace('whatsapp:', '')}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.services?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/appointments/${r.id}`}
                      className="mr-2 text-slate-700 hover:underline"
                    >
                      Edit
                    </Link>
                    {r.status === 'confirmed' && <CancelButton id={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-slate-200 text-slate-700',
    pending: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        colors[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
}
