import { getSupabase } from '../supabase';

export type SessionState =
  | 'idle'
  | 'awaiting_service'
  | 'awaiting_date'
  | 'awaiting_slot';

export interface SessionContext {
  service_id?: string;
  service_name?: string;
  duration?: number;
  date?: string;              // YYYY-MM-DD
  candidate_slots?: string[]; // ISO timestamps
}

export interface Session {
  phone: string;
  state: SessionState;
  context: SessionContext;
}

export async function getSession(phone: string): Promise<Session> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('conversation_sessions')
    .select('phone, state, context')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { phone, state: 'idle', context: {} };
  return {
    phone: data.phone,
    state: data.state as SessionState,
    context: (data.context ?? {}) as SessionContext,
  };
}

export async function setSession(
  phone: string,
  state: SessionState,
  context: SessionContext,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('conversation_sessions')
    .upsert(
      { phone, state, context, updated_at: new Date().toISOString() },
      { onConflict: 'phone' },
    );
  if (error) throw error;
}

export async function resetSession(phone: string): Promise<void> {
  await setSession(phone, 'idle', {});
}
