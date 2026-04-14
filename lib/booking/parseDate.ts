// Minimal natural-date parser for the booking flow.
// Accepts: "today", "tomorrow", "YYYY-MM-DD", "DD/MM", "DD/MM/YYYY",
// and weekday names ("monday", "mon", ...).
// Returns a YYYY-MM-DD string in the salon timezone, or null on failure.

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseUserDate(input: string, now: Date = new Date()): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  if (s === 'today') return ymd(now);
  if (s === 'tomorrow' || s === 'tmrw' || s === 'tmr') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }

  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : ymd(d);
  }

  // DD/MM or DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
    return ymd(d);
  }

  // Weekday name — next occurrence (today counts if it's the same weekday)
  if (s in WEEKDAYS) {
    const target = WEEKDAYS[s];
    const d = new Date(now);
    const diff = (target - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
    return ymd(d);
  }

  return null;
}
