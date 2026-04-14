import { redirect } from 'next/navigation';
import { getSupabaseServer } from './supabaseServer';

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = adminEmails();
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
}

export async function getCurrentUser() {
  const sb = getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  if (!isAdminEmail(user.email)) redirect('/admin/login?error=not_admin');
  return user;
}
