import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
);


/*
export let supabase;

export function createClient() {
  if (!supabase) {
    console.log("Creating client");
    supabase = createSupabaseClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
    );
  } else {
    return supabase;
  }
}
*/
