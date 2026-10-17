import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Cliente com a service role: ignora RLS.
 * Usar SÓ no servidor e SÓ depois de confirmar o papel com requireAdmin()/requireStaff().
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (ver .env.example).");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
