"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";
import type { Database } from "./database.types";

type BrowserClient = SupabaseClient<Database>;
let browserClient: BrowserClient | null | undefined;

export function createSupabaseBrowserClient(): BrowserClient | null {
  if (browserClient !== undefined) return browserClient;
  const config = getSupabasePublicConfig();
  browserClient = config
    ? createBrowserClient<Database>(config.url, config.key, {
        cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      })
    : null;
  return browserClient;
}
