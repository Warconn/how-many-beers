export type AccountConfig = {
  url: string;
  key: string;
  providers: ("google" | "apple")[];
};
/** Only the explicitly configured project's feat aliases may use dev accounts.
 * This is deliberately narrower than a general URL glob or a pages.dev wildcard. */
function featurePreviewMatches(origin: string, rule: string): boolean {
  if (process.env.NEXT_PUBLIC_AUTH_ENV !== "development") return false;
  const project = /^https:\/\/feat-\*\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.pages\.dev$/.exec(rule)?.[1];
  if (!project) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin || url.port || url.username || url.password) return false;
    const suffix = "." + project + ".pages.dev";
    if (!url.hostname.endsWith(suffix)) return false;
    const label = url.hostname.slice(0, -suffix.length);
    return label.length <= 63 && /^feat-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label);
  } catch {
    return false;
  }
}
/** Rollout allowlist is a UI guard. Supabase JWT validation and RLS remain authoritative. */
export function accountConfig(origin: string): AccountConfig | null {
  if (process.env.NEXT_PUBLIC_ENABLE_ACCOUNTS !== "true") return null;
  const origins = (process.env.NEXT_PUBLIC_ACCOUNT_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim());
  if (!origins.some(rule => rule === origin || featurePreviewMatches(origin, rule))) return null;
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
