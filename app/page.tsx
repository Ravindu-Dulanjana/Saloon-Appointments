import Link from 'next/link';

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-3xl font-bold mb-4">Saloon Booking Bot</h1>
      <p className="mb-2 text-slate-700">
        WhatsApp webhook: <code className="bg-slate-200 px-1 rounded">/api/twilio/webhook</code>
      </p>
      <p className="mb-6 text-slate-700">
        Reminders cron: <code className="bg-slate-200 px-1 rounded">/api/cron/reminders</code>
      </p>
      <Link
        href="/admin"
        className="inline-block rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
      >
        Open admin dashboard →
      </Link>
    </main>
  );
}
