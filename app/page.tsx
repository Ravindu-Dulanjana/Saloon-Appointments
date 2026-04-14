export default function Page() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 40 }}>
      <h1>Saloon Booking Bot</h1>
      <p>
        WhatsApp webhook: <code>/api/twilio/webhook</code>
      </p>
      <p>
        Reminders cron: <code>/api/cron/reminders</code>
      </p>
    </main>
  );
}
