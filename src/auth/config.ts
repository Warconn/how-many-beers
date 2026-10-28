export type AccountConfig = {
  url: string;
  key: string;
  providers: ("google" | "apple")[];
};
/** Rollout allowlist is a UI guard. Supabase JWT validation and RLS remain authoritative. */
export function accountConfig(origin: string): AccountConfig | null {
  if (process.env.NEXT_PUBLIC_ENABLE_ACCOUNTS !== "true") return null;
  const origins = (process.env.NEXT_PUBLIC_ACCOUNT_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim());
  if (!origins.includes(origin)) return null;
  if (
    origin === "https://howmanybeers.app" &&
    process.env.NEXT_PUBLIC_AUTH_ENV !== "production"
  )
    return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      return null;
  } catch {
    return null;
  }
  return {
    url,
    key,
    providers: (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
      .split(",")
      .filter((p): p is "google" | "apple" => p === "google" || p === "apple"),
  };
}
export const accountPath = (path = "") =>
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/account/" + path;
export function callbackUrl(origin: string) {
  return origin + accountPath("callback/");
}
