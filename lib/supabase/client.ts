import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Browser Supabase client (anon key). Safe for the client bundle and for the
 * Capacitor static build — only exposes public-read data per RLS.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
