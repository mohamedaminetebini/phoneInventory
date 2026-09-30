import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";
import type { Database } from "./database.types";

export function isSupabaseServiceConfigured(): boolean {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return getSupabasePublicConfig() !== null && Boolean(serviceKey) && !/replace-this-value/i.test(serviceKey ?? "");
}

export function createSupabaseServiceClient() {
  const config = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceKey || !isSupabaseServiceConfigured()) return null;

  return createClient<Database>(config.url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
