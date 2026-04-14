'use client';

import { useTransition } from 'react';
import { cancelAppointment } from './actions';

export function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('Cancel this appointment?')) return;
        start(() => cancelAppointment(id));
      }}
      className="text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? 'Cancelling…' : 'Cancel'}
    </button>
  );
}
