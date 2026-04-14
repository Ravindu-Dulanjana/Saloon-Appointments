'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { rescheduleAppointment } from '../../actions';

export function RescheduleForm({
  appointmentId,
  date,
  slots,
}: {
  appointmentId: string;
  date: string;
  slots: { iso: string; label: string }[];
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeDate(newDate: string) {
    setSelectedDate(newDate);
    router.replace(`?date=${newDate}`);
  }

  function pickSlot(iso: string) {
    setError(null);
    if (!confirm(`Move appointment to ${new Date(iso).toLocaleString()}?`)) return;
    start(async () => {
      try {
        await rescheduleAppointment(appointmentId, iso);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-slate-600">Pick a new date</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => changeDate(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        />
      </label>

      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">No free slots on {selectedDate}.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s.iso}
              type="button"
              disabled={pending}
              onClick={() => pickSlot(s.iso)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
