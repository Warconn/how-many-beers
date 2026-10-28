import {
  isMeal,
  readHistory,
  type ArchivedCook,
  type HistoryLibrary,
} from "../domain/cookHistory";
import { migrateMeal } from "../domain/cookState";
import { localDateTime, newMeal } from "../domain/meal";
import type { LocalSnapshot } from "../domain/localPersistence";
import type { SupabaseClient } from "@supabase/supabase-js";
export type RawCook = {
  meal: LocalSnapshot["active"];
  serveInstant: string | null;
};
export type RawArchive = ArchivedCook & { serveInstant: string | null };
export type Document = { active: RawCook | null; history: RawArchive[] };
export type Remote = Document & { revision: number; writeId: string | null };
export type WorkspaceAPI = {
  read: () => Promise<Remote>;
  write: (revision: number, id: string, document: Document) => Promise<Remote>;
};
export class AccountConflict extends Error {}
export const equal = (a: unknown, b: unknown): boolean => {
  const sorted = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sorted)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, v]) => [key, sorted(v)]),
          )
        : value;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
};
function instant(serveAt: string) {
  const time = Date.parse(serveAt);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function restored(meal: RawCook["meal"], serveInstant: string | null) {
  return migrateMeal({
    ...meal,
    ...(serveInstant ? { serveAt: localDateTime(new Date(serveInstant)) } : {}),
  });
}
export function parseRemote(value: unknown): Remote {
  if (!value || typeof value !== "object")
    throw Error("Account data could not be read safely.");
  const v = value as Remote;
  if (
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    !(v.writeId === null || typeof v.writeId === "string") ||
    !Array.isArray(v.history)
  )
    throw Error("Unrecognized account data.");
  const validInstant = (s: unknown) =>
    s === null || (typeof s === "string" && Number.isFinite(Date.parse(s)));
  if (
    v.active !== null &&
    (!v.active ||
      !isMeal(v.active.meal) ||
      !validInstant(v.active.serveInstant))
  )
    throw Error("Invalid account cook.");
  readHistory({ version: 1, cooks: v.history });
  if (!v.history.every((a) => validInstant(a.serveInstant)))
    throw Error("Invalid account serving time.");
  return v;
}
export function decode(
  remote: Remote,
  empty = migrateMeal(newMeal()),
): LocalSnapshot {
  return {
    active: remote.active
      ? restored(remote.active.meal, remote.active.serveInstant)
      : empty,
    history: {
      version: 1,
      cooks: remote.history.map(({ serveInstant, ...entry }) => ({
        ...entry,
        meal: restored(entry.meal, serveInstant),
      })),
    },
  };
}
export function encode(snapshot: LocalSnapshot, base: Remote): Document {
  if (!isMeal(snapshot.active))
    throw Error("This cook cannot be saved safely.");
  readHistory(snapshot.history);
  return {
    active: {
      meal: migrateMeal(snapshot.active),
      serveInstant: instant(snapshot.active.serveAt),
    },
    history: snapshot.history.cooks.map((entry) => {
      const existing = base.history.find((c) => c.id === entry.id);
      if (existing) {
        const { serveInstant, ...old } = existing;
        if (!equal({ ...old, meal: restored(old.meal, serveInstant) }, entry))
          throw Error("Completed cooks cannot be rewritten.");
        return existing;
      }
      return { ...entry, serveInstant: instant(entry.meal.serveAt) };
    }),
  };
}
export function workspaceAPI(
  client: SupabaseClient,
  owner: string,
): WorkspaceAPI {
  const call = async (name: string, values: Record<string, unknown>) => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    let result;
    try {
      result = await client
        .rpc(name, { expected_owner: owner, ...values })
        .abortSignal(controller.signal);
    } finally {
      clearTimeout(timer);
    }
    const { data, error } = result;
    if (error) {
      if (error.code === "40001")
        throw new AccountConflict(
          "Your account cook changed on another device. Download a backup before loading the latest version.",
        );
      throw Error(
        "Could not reach account saving. Keep this page open and retry, or download a backup.",
      );
    }
    return parseRemote(data);
  };
  return {
    read: () => call("load_cook_workspace", {}),
    write: (revision, id, document) =>
      call("save_cook_workspace", {
        expected_revision: revision,
        write_id: id,
        document,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
  };
}
export const meaningful = (s: LocalSnapshot) => {
  const defaultServe = new Date();
  defaultServe.setDate(defaultServe.getDate() + 1);
  defaultServe.setHours(18, 0, 0, 0);
  return (
    s.active.dishes.length > 0 ||
    !!s.active.startedAt ||
    s.active.mode === "cooking" ||
    (s.active.customTasks?.length ?? 0) > 0 ||
    (s.active.events?.length ?? 0) > 0 ||
    Object.keys(s.active.notes).length > 0 ||
    Object.keys(s.active.completed).length > 0 ||
    s.active.name !== "Next cook" ||
    s.active.serveAt !== localDateTime(defaultServe) ||
    s.history.cooks.length > 0
  );
};
export const mergeHistory = (
  account: HistoryLibrary,
  guest: HistoryLibrary,
): HistoryLibrary => ({
  version: 1,
  cooks: [
    ...account.cooks,
    ...guest.cooks.filter((c) => !account.cooks.some((a) => a.id === c.id)),
  ].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)),
});
export function fingerprint(snapshot: LocalSnapshot) {
  let hash = 2166136261;
  for (const char of JSON.stringify(snapshot)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
