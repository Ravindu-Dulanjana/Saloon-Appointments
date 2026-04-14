'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/auth';

export async function cancelAppointment(id: string) {
  await requireAdmin();
  const sb = getSupabase();
  const { error } = await sb
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath(`/admin/appointments/${id}`);
}

export async function rescheduleAppointment(id: string, newStartIso: string) {
  await requireAdmin();
  const sb = getSupabase();

  const { data: appt, error: fetchErr } = await sb
    .from('appointments')
    .select('id, service_id, services(duration_minutes)')
    .eq('id', id)
    .single();
  if (fetchErr || !appt) throw new Error(fetchErr?.message ?? 'Appointment not found');

  const duration =
    (appt.services as unknown as { duration_minutes: number } | null)?.duration_minutes ?? 30;
  const endIso = new Date(new Date(newStartIso).getTime() + duration * 60_000).toISOString();

  const { error: updateErr } = await sb
    .from('appointments')
    .update({
      start_at: newStartIso,
      end_at: endIso,
      reminder_sent: false,
    })
    .eq('id', id);

  if (updateErr) {
    if ((updateErr as { code?: string }).code === '23P01') {
      throw new Error('That slot conflicts with another appointment.');
    }
    throw new Error(updateErr.message);
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/appointments/${id}`);
}

export async function updateCustomerName(id: string, name: string) {
  await requireAdmin();
  const sb = getSupabase();
  const trimmed = name.trim();
  const { error } = await sb
    .from('customers')
    .update({ name: trimmed.length > 0 ? trimmed : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath('/admin/customers');
}

export async function signOut() {
  const sb = getSupabaseServer();
  await sb.auth.signOut();
  redirect('/admin/login');
}
