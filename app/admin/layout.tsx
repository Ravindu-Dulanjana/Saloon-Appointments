import Link from 'next/link';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { signOut } from './actions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Skip auth check on the login page itself
  const pathname = headers().get('x-invoke-path') ?? '';
  if (pathname.endsWith('/admin/login')) {
    return <>{children}</>;
  }

  const user = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xl font-bold">
              {process.env.SALON_NAME ?? 'Salon'} Admin
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/admin" className="text-slate-600 hover:text-slate-900">
                Appointments
              </Link>
              <Link href="/admin/customers" className="text-slate-600 hover:text-slate-900">
                Customers
              </Link>
            </nav>
          </div>
          <form action={signOut} className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user.email}</span>
            <button
              type="submit"
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
