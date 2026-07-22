import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ConflictRow, ConflictLayerRow } from '@/lib/supabase/types';

export type Conflict = ConflictRow;
export type ConflictLayer = ConflictLayerRow;

/** All conflicts, ordered for the switcher. Falls back to [] if DB unset. */
export async function getConflicts(): Promise<Conflict[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('conflicts')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[data] getConflicts failed:', err);
    return [];
  }
}

export async function getConflictBySlug(slug: string): Promise<Conflict | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('conflicts')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[data] getConflictBySlug failed:', err);
    return null;
  }
}

/** Enabled layers for a conflict, z-ordered. */
export async function getConflictLayers(
  conflictId: string,
): Promise<ConflictLayer[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('conflict_layers')
      .select('*')
      .eq('conflict_id', conflictId)
      .eq('enabled', true)
      .order('z_index', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[data] getConflictLayers failed:', err);
    return [];
  }
}
