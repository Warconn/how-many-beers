/** Tab-scoped navigation hints contain no credentials or recipe data. */
export type CookView = "home" | "planning" | "cooking" | "history";
export const ACCOUNT_RETURN_KEY = "how-many-beers:account-return:v1";
const views: CookView[] = ["home", "planning", "cooking", "history"];
export function rememberCookReturn(
  storage: Pick<Storage, "setItem">,
  view: CookView,
  cookId: string,
  now = Date.now(),
) {
  try {
    storage.setItem(
      ACCOUNT_RETURN_KEY,
      JSON.stringify({ view, cookId, at: now }),
    );
  } catch {
    /* Sign-in works even when tab storage is unavailable. */
  }
}
export function takeCookReturn(
  storage: Pick<Storage, "getItem" | "removeItem">,
  cookId: string,
  now = Date.now(),
): CookView | null {
  try {
    const raw = storage.getItem(ACCOUNT_RETURN_KEY);
    storage.removeItem(ACCOUNT_RETURN_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value &&
      value.cookId === cookId &&
      views.includes(value.view) &&
      Number.isFinite(value.at) &&
      value.at <= now &&
      now - value.at <= 3600000
      ? value.view
      : null;
  } catch {
    return null;
  }
}
export const accountHomePath = () =>
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/?account-return=1";
