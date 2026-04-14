import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/format';
import { CustomerNameForm } from './CustomerNameForm';

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
}

interface ApptRow {
  id: string;
  start_at: string;
  status: string;
  services: { name: string } | null;
}

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const sb = getSupabase();

  const { data: customer, error } = await sb
    .from('customers')
    .select('id, phone, name, created_at')
    .eq('id', params.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!customer) notFound();

  const { data: appts } = await sb
    .from('appointments')
    .select('id, start_at, status, services(name)')
    .eq('customer_id', params.id)
    .order('start_at', { ascending: false })
    .limit(50);

  const rows = (appts ?? []) as unknown as ApptRow[];

  return (
    <div>
      <Link href="/admin/customers" className="mb-4 inline-block text-sm text-slate-600 hover:underline">
        ← All customers
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">
          {(customer as Customer).name ?? 'Unnamed customer'}
        </h1>
        <p className="mt-1 text-slate-600">{(customer as Customer).phone.replace('whatsapp:', '')}</p>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Edit name</h2>
          <CustomerNameForm
            id={(customer as Customer).id}
            initialName={(customer as Customer).name ?? ''}
          />
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Appointment history</h2>
      {rows.length === 0 ? (
        <p className="text-slate-500">No appointments yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{fmtDateTime(r.start_at)}</td>
                  <td className="px-4 py-3">{r.services?.name ?? '—'}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/appointments/${r.id}`}
                      className="text-slate-700 hover:underline"
                    >
                      Open
                    </Link>
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
