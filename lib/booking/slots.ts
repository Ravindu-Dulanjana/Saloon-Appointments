import { getSupabase } from '../supabase';

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  sort_order: number;
}

export async function listServices(): Promise<Service[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('services')
    .select('id, name, duration_minutes, price, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function getAvailableSlots(
  dateIso: string,         // YYYY-MM-DD
  durationMinutes: number,
  stepMinutes = 15,
): Promise<string[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('get_available_slots', {
    p_date: dateIso,
    p_duration: durationMinutes,
    p_step_minutes: stepMinutes,
  });
  if (error) throw error;
  return (data ?? []).map((r: { slot_start: string }) => r.slot_start);
}

export async function upsertCustomer(phone: string, name?: string): Promise<string> {
  const sb = getSupabase();
  const { data: existing } = await sb
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await sb
    .from('customers')
    .insert({ phone, name: name ?? null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createAppointment(
  customerId: string,
  serviceId: string,
  startAt: string,
  durationMinutes: number,
): Promise<{ id: string; start_at: string; end_at: string } | null> {
  const sb = getSupabase();
  const endAt = new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString();
  const { data, error } = await sb
    .from('appointments')
    .insert({
      customer_id: customerId,
      service_id: serviceId,
      start_at: startAt,
      end_at: endAt,
      status: 'confirmed',
    })
    .select('id, start_at, end_at')
    .single();

  if (error) {
    // Exclusion constraint violation means the slot was taken between
    // fetching availability and confirming.
    if ((error as { code?: string }).code === '23P01') return null;
    throw error;
  }
  return data as { id: string; start_at: string; end_at: string };
}
