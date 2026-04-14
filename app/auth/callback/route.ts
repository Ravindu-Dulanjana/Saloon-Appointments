import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/admin';

  if (code) {
    const sb = getSupabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/admin/login?error=exchange_failed', url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
