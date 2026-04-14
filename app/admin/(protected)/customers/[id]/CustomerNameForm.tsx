'use client';

import { useState, useTransition } from 'react';
import { updateCustomerName } from '../../actions';

export function CustomerNameForm({ id, initialName }: { id: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await updateCustomerName(id, name);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Customer name"
        className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {savedAt && <span className="text-xs text-green-600">Saved</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
