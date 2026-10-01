import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Khusus server-side: Client dengan Service Role Key.
 * Memiliki bypass RLS untuk keperluan audit, manajemen user oleh admin, dan pembacaan konfigurasi 9router.
 * PENTING: Jangan pernah diekspor atau dipanggil di komponen sisi client (browser)!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum disetel. Set env var ini (server-only) sebelum melanjutkan."
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
