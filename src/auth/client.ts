"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accountConfig } from "./config";
let client: SupabaseClient | undefined;
export function accountClient() {
  if (typeof window === "undefined") return null;
  const config = accountConfig(window.location.origin);
  if (!config) return null;
  client ??= createClient(config.url, config.key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "how-many-beers:auth:v1",
    },
  });
  return client;
}
