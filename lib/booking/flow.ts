import { getSession, resetSession, setSession, SessionContext } from './session';
import { parseUserDate } from './parseDate';
import {
  listServices,
  getAvailableSlots,
  upsertCustomer,
  createAppointment,
  Service,
} from './slots';

const SALON_NAME = process.env.SALON_NAME ?? 'Our Salon';
const SALON_TZ = process.env.SALON_TIMEZONE ?? 'Asia/Colombo';
const MAX_SLOTS_SHOWN = 10;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SALON_TZ,
  });
}

function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: SALON_TZ,
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SALON_TZ,
  });
}

function serviceMenu(services: Service[]): string {
  const lines = services.map(
    (s, i) => `${i + 1}) ${s.name} — ${s.duration_minutes} min, Rs. ${s.price}`,
  );
  return `Welcome to ${SALON_NAME}!\nWhich service would you like?\n\n${lines.join('\n')}\n\nReply with the number.`;
}

function slotMenu(slots: string[], dateLabel: string): string {
  const lines = slots.map((s, i) => `${i + 1}) ${formatTime(s)}`);
  return `Available on ${dateLabel}:\n\n${lines.join('\n')}\n\nReply with the number to book.`;
}

function parseChoice(input: string, max: number): number | null {
  const n = parseInt(input.trim(), 10);
  if (Number.isNaN(n) || n < 1 || n > max) return null;
  return n;
}

function isGreeting(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ['hi', 'hello', 'hey', 'start', 'book', 'booking', 'menu'].includes(t);
}

export async function handleIncoming(phone: string, body: string): Promise<string> {
  const text = body.trim();

  if (/^cancel$/i.test(text)) {
    await resetSession(phone);
    return 'Booking flow cancelled. Send "hi" to start again.';
  }

  const session = await getSession(phone);

  // Any greeting or idle state -> show services
  if (session.state === 'idle' || isGreeting(text)) {
    const services = await listServices();
    if (services.length === 0) return 'Sorry, no services are available right now.';
    await setSession(phone, 'awaiting_service', {
      candidate_slots: services.map((s) => s.id),
    });
    return serviceMenu(services);
  }

  if (session.state === 'awaiting_service') {
    const services = await listServices();
    const pick = parseChoice(text, services.length);
    if (!pick) return `Please reply with a number between 1 and ${services.length}.`;
    const svc = services[pick - 1];
    const ctx: SessionContext = {
      service_id: svc.id,
      service_name: svc.name,
      duration: svc.duration_minutes,
    };
    await setSession(phone, 'awaiting_date', ctx);
    return `Great — ${svc.name} (${svc.duration_minutes} min).\n\nWhich date? Reply with:\n• "today" or "tomorrow"\n• a weekday like "friday"\n• or YYYY-MM-DD (e.g. 2026-04-20)`;
  }

  if (session.state === 'awaiting_date') {
    const date = parseUserDate(text);
    if (!date) return 'Sorry, I could not understand that date. Try "tomorrow", "friday", or "2026-04-20".';
    const ctx = session.context;
    if (!ctx.service_id || !ctx.duration) {
      await resetSession(phone);
      return 'Session expired. Send "hi" to start again.';
    }
    const slots = await getAvailableSlots(date, ctx.duration);
    if (slots.length === 0) {
      return `Sorry, no free slots on ${formatDate(date)}. Please reply with another date.`;
    }
    const shown = slots.slice(0, MAX_SLOTS_SHOWN);
    await setSession(phone, 'awaiting_slot', {
      ...ctx,
      date,
      candidate_slots: shown,
    });
    return slotMenu(shown, formatDate(date));
  }

  if (session.state === 'awaiting_slot') {
    const ctx = session.context;
    const slots = ctx.candidate_slots ?? [];
    const pick = parseChoice(text, slots.length);
    if (!pick) return `Please reply with a number between 1 and ${slots.length}.`;

    if (!ctx.service_id || !ctx.duration) {
      await resetSession(phone);
      return 'Session expired. Send "hi" to start again.';
    }

    const chosenStart = slots[pick - 1];
    const customerId = await upsertCustomer(phone);
    const appt = await createAppointment(
      customerId,
      ctx.service_id,
      chosenStart,
      ctx.duration,
    );

    if (!appt) {
      // Slot got taken — refresh the list
      const fresh = await getAvailableSlots(ctx.date!, ctx.duration);
      if (fresh.length === 0) {
        await resetSession(phone);
        return 'That slot was just taken and no other slots remain on that date. Send "hi" to try another date.';
      }
      const shown = fresh.slice(0, MAX_SLOTS_SHOWN);
      await setSession(phone, 'awaiting_slot', { ...ctx, candidate_slots: shown });
      return `Sorry, that slot was just taken. Please pick another:\n\n${slotMenu(shown, formatDate(ctx.date!))}`;
    }

    await resetSession(phone);
    return `Booked! ✅\n\n${ctx.service_name} on ${formatDateTime(appt.start_at)}\nReference: ${appt.id.slice(0, 8)}\n\nReply CANCEL anytime to cancel.`;
  }

  // Fallback
  await resetSession(phone);
  return 'Send "hi" to start a booking.';
}
