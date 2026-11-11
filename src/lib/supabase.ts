import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Browser-safe Supabase client configured for persistent patron sessions.
 */
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || "placeholder-anon-key-configure-in-env",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
