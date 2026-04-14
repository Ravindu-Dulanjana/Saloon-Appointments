'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);

    const sb = getSupabaseBrowser();
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  const initialError =
    searchParams.error === 'not_admin'
      ? 'That email is not on the admin allowlist.'
      : searchParams.error === 'exchange_failed'
      ? 'Login link was invalid or expired. Try again.'
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">Admin sign in</h1>
        <p className="mb-6 text-sm text-slate-600">
          Enter your email — we&apos;ll send you a magic link.
        </p>

        {initialError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {initialError}
          </div>
        )}

        {status === 'sent' ? (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Magic link sent to <strong>{email}</strong>. Check your inbox.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
