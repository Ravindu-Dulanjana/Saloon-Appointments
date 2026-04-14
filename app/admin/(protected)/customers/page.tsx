import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';

interface Row {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const sb = getSupabase();
  const q = searchParams.q?.trim();

  let query = sb
    .from('customers')
    .select('id, phone, name, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (q) {
    query = query.or(`phone.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <form className="flex items-center gap-2" action="/admin/customers">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search name or phone"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500">No customers found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {c.name ?? <span className="text-slate-400">— no name —</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.phone.replace('whatsapp:', '')}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.created_at).toLocaleDateString('en-GB')}
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
