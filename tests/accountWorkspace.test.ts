import { afterEach, describe, it, expect, vi } from "vitest";
import {
  AccountCookStore,
  accountCacheKey,
} from "../src/account/AccountCookStore";
import {
  AccountConflict,
  decode,
  encode,
  type Remote,
  type WorkspaceAPI,
} from "../src/account/workspace";
import { newMeal, createDish } from "../src/domain/meal";
import { migrateMeal } from "../src/domain/cookState";
import { archiveCook, emptyHistory } from "../src/domain/cookHistory";
const owner = "00000000-0000-4000-8000-000000000001";
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const stores: AccountCookStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.dispose());
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function fixture() {
  let remote: Remote = {
      revision: 0,
      writeId: null,
      active: null,
      history: [],
    },
    writes = 0,
    failStorage = false,
    lostResponse = false;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failStorage) throw Error("Storage full. Download a backup.");
      values.set(key, value);
    },
  };
  const api: WorkspaceAPI = {
    read: async () => clone(remote),
    write: async (revision, id, document) => {
      if (remote.writeId === id) return clone(remote);
      if (revision !== remote.revision)
        throw new AccountConflict("Newer account version");
      writes++;
      remote = { ...clone(document), revision: revision + 1, writeId: id };
      if (lostResponse) {
        lostResponse = false;
        throw Error("Response lost");
      }
      return clone(remote);
    },
  };
  const store = (who = owner, custom = api) => {
    const s = new AccountCookStore(who, custom, storage, () => {});
    stores.push(s);
    return s;
  };
  return {
    store,
    api,
    storage,
    values,
    get: () => clone(remote),
    set: (v: Remote) => {
      remote = clone(v);
    },
    writes: () => writes,
    fail: (v: boolean) => {
      failStorage = v;
    },
    lose: () => {
      lostResponse = true;
    },
  };
}
describe("account snapshot recovery", () => {
  it("acknowledges only after the account write and recovers in a new instance", async () => {
    const f = fixture(),
      s = f.store();
    await s.connect();
    s.edit((m) => ({
      ...m,
      name: "Friday brisket",
      dishes: [createDish("brisket")],
    }));
    expect(s.state().phase).toBe("syncing");
    expect(
      JSON.parse(f.storage.getItem(accountCacheKey(owner))!).desired.active
        .name,
    ).toBe("Friday brisket");
    await s.flush(true);
    expect(s.state().phase).toBe("saved");
    expect(f.writes()).toBe(1);
    s.dispose();
    const next = f.store();
    await next.connect();
    expect(next.state().snapshot?.active.name).toBe("Friday brisket");
  });
  it("keeps a critical server acknowledgment truthful if the recovery cache then fails", async () => {
    const f = fixture();
    const s = f.store(owner, {
      read: f.api.read,
      write: async (...args) => {
        const response = await f.api.write(...args);
        f.fail(true);
        return response;
      },
    });
    await s.connect();
    const active = {...s.state().snapshot!.active, name: "Acknowledged plan"};
    await s.save({active});
    expect(s.state().phase).toBe("saved");
    expect(s.state().snapshot!.active.name).toBe("Acknowledged plan");
    expect(s.state().error).toContain("account saved this cook");
    expect(f.get().active!.meal.name).toBe("Acknowledged plan");
    s.dispose();
    f.fail(false);
    const restored = f.store();
    await restored.connect();
    expect(restored.state().phase).toBe("saved");
    expect(restored.state().snapshot!.active.name).toBe("Acknowledged plan");
    expect(f.writes()).toBe(1);
  });
  it("ignores a stale reconnect read that arrives after a newer save acknowledgment", async () => {
    const f = fixture();
    let release: (() => void) | undefined;
    let delay = false;
    const s = f.store(owner, {
      read: async () => {
        const snapshot = await f.api.read();
        if (delay) await new Promise<void>(resolve => {release=resolve;});
        return snapshot;
      },
      write: f.api.write,
    });
    await s.connect();
    delay = true;
    const reconnect = s.connect();
    await Promise.resolve();
    s.edit(m => ({...m,name:"Newly acknowledged"}));
    await s.flush(true);
    release!();
    await reconnect;
    expect(s.state().phase).toBe("saved");
    expect(s.state().snapshot!.active.name).toBe("Newly acknowledged");
  });
  it("reconciles a committed write whose response was lost without duplicating it", async () => {
    const f = fixture(),
      s = f.store();
    await s.connect();
    s.edit((m) => ({ ...m, name: "Keep me" }));
    f.lose();
    await expect(s.flush(true)).rejects.toThrow("Response lost");
    expect(s.state().phase).toBe("unsaved");
    s.dispose();
    const next = f.store();
    await next.connect();
    expect(next.state().snapshot?.active.name).toBe("Keep me");
    expect(next.state().phase).toBe("saved");
    expect(f.writes()).toBe(1);
  });
  it("keeps edits entered while an earlier request is in flight", async () => {
    const f = fixture();
    let resume: (() => void) | undefined;
    const custom: WorkspaceAPI = {
      read: f.api.read,
      write: async (...args) => {
        await new Promise<void>((r) => {
          resume = r;
        });
        return f.api.write(...args);
      },
    };
    const s = f.store(owner, custom);
    await s.connect();
    s.edit((m) => ({ ...m, name: "First" }));
    const sending = s.flush();
    await Promise.resolve();
    s.edit((m) => ({ ...m, name: "Last keystroke" }));
    resume!();
    await sending;
    expect(s.state().snapshot?.active.name).toBe("Last keystroke");
    expect(s.state().phase).toBe("syncing");
    const last = s.flush(true);
    await Promise.resolve();
    resume!();
    await last;
    expect(f.get().active?.meal.name).toBe("Last keystroke");
    expect(s.state().phase).toBe("saved");
  });
  it("never overwrites a newer device and keeps the pending cook exportable", async () => {
    const f = fixture(),
      s = f.store();
    await s.connect();
    s.edit((m) => ({ ...m, name: "My pending notes" }));
    const other = migrateMeal({ ...newMeal(), name: "Other device" });
    f.set({
      revision: 1,
      writeId: crypto.randomUUID(),
      active: { meal: other, serveInstant: null },
      history: [],
    });
    await expect(s.flush(true)).rejects.toBeInstanceOf(AccountConflict);
    expect(s.state().phase).toBe("conflict");
    expect(s.state().backup?.active.name).toBe("My pending notes");
    await expect(s.retry()).rejects.toThrow();
    expect(f.get().active?.meal.name).toBe("Other device");
    await s.reload();
    expect(s.state().snapshot?.active.name).toBe("Other device");
    expect(s.state().phase).toBe("saved");
  });
  it("keeps new edits visible and unsaved when recovery storage is full", async () => {
    const f = fixture(),
      s = f.store();
    await s.connect();
    f.fail(true);
    s.edit((m) => ({ ...m, name: "Unsaved but recoverable" }));
    expect(s.state().phase).toBe("unsaved");
    expect(s.state().backup?.active.name).toBe("Unsaved but recoverable");
    expect(f.writes()).toBe(0);
    f.fail(false);
    await s.retry();
    expect(s.state().phase).toBe("saved");
    expect(f.get().active?.meal.name).toBe("Unsaved but recoverable");
  });
  it("does not show an unconfirmed finish as completed, and retries the same transition", async () => {
    const f = fixture(),
      s = f.store();
    await s.connect();
    s.edit((m) => ({ ...m, dishes: [createDish("brisket")] }));
    await s.flush(true);
    const before = s.state().snapshot!,
      history = archiveCook(
        before.active,
        before.history,
        "Delicious",
        "2026-10-28T22:00:00Z",
      );
    f.lose();
    await expect(s.save({ active: newMeal(), history })).rejects.toThrow();
    expect(s.state().phase).toBe("blocked");
    expect(s.state().snapshot?.active.id).toBe(before.active.id);
    expect(s.state().backup?.history.cooks[0].feedback).toBe("Delicious");
    const writes = f.writes();
    await s.retry();
    expect(f.writes()).toBe(writes);
    expect(s.state().phase).toBe("saved");
    expect(s.state().snapshot?.history.cooks[0].meal.id).toBe(before.active.id);
  });
  it("hides a recovery cache bearing a different owner and never replaces it implicitly", async () => {
    const f = fixture();
    const raw = JSON.stringify({
      version: 1,
      owner: "other",
      base: {
        ...f.get(),
        active: {
          meal: migrateMeal({ ...newMeal(), name: "PRIVATE OTHER COOK" }),
          serveInstant: null,
        },
      },
      desired: null,
      operation: null,
    });
    f.storage.setItem(accountCacheKey(owner), raw);
    const s = f.store();
    await s.connect();
    expect(s.state().snapshot).toBeNull();
    expect(s.state().phase).toBe("load-error");
    expect(s.recoveryExport()).not.toContain("PRIVATE OTHER COOK");
    expect(f.storage.getItem(accountCacheKey(owner))).toBe(raw);
  });
  it("uses isolated cache keys for separate verified accounts", async () => {
    const f = fixture(),
      a = f.store();
    await a.connect();
    a.edit((m) => ({ ...m, name: "A private cook" }));
    await a.flush(true);
    const b = f.store("00000000-0000-4000-8000-000000000002", {
      read: async () => ({
        revision: 0,
        writeId: null,
        active: null,
        history: [],
      }),
      write: f.api.write,
    });
    await b.connect();
    expect(b.state().snapshot?.active.name).toBe("Next cook");
    expect(accountCacheKey(owner)).not.toBe(b.key);
  });
  it("preserves serving instants, actual event times and immutable archives across time zones", () => {
    vi.stubEnv("TZ", "America/New_York");
    const meal = migrateMeal({
      ...newMeal(),
      serveAt: "2026-10-28T18:00",
      dishes: [createDish("brisket")],
    });
    meal.events = [
      {
        id: "legacy:prep",
        taskId: "prep",
        kind: "completed" as const,
        occurredAt: "2021-04-04T03:07:00Z",
      },
    ];
    const history = archiveCook(
        meal,
        emptyHistory(),
        "Great",
        "2026-10-28T23:00:00Z",
      ),
      raw = encode(
        { active: migrateMeal(newMeal()), history },
        { revision: 0, writeId: null, active: null, history: [] },
      );
    expect(raw.history[0].serveInstant).toBe("2026-10-28T22:00:00.000Z");
    vi.stubEnv("TZ", "America/Los_Angeles");
    const remote = { ...raw, revision: 1, writeId: crypto.randomUUID() },
      read = decode(remote);
    expect(read.history.cooks[0].meal.serveAt).toBe("2026-10-28T15:00");
    expect(read.history.cooks[0].meal.events?.[0].occurredAt).toBe(
      "2021-04-04T03:07:00Z",
    );
    expect(encode(read, remote).history[0]).toEqual(raw.history[0]);
  });
});
it("waits for an in-flight write before reconnecting and reconciles its lost response", async () => {
  const f = fixture();
  let release: (() => void) | undefined;
  const s = f.store(owner, {
    read: f.api.read,
    write: async (...args) => {
      const committed = await f.api.write(...args);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      throw Error("Lost response after commit " + committed.revision);
    },
  });
  await s.connect();
  s.edit((m) => ({ ...m, name: "Committed once" }));
  const send = s.flush().catch(() => {});
  await Promise.resolve();
  await Promise.resolve();
  const reconnect = s.connect();
  release!();
  await send;
  await reconnect;
  expect(s.state().phase).toBe("saved");
  expect(s.state().snapshot?.active.name).toBe("Committed once");
  expect(f.writes()).toBe(1);
});
it("serializes automatic and explicit saves while asynchronous recovery is committing", async () => {
  const f = fixture();
  let release: (() => void) | undefined,
    block = false;
  const storage = {
    ...f.storage,
    settled: async () => {
      if (block)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    },
  };
  const s = new AccountCookStore(owner, f.api, storage, () => {});
  stores.push(s);
  await s.connect();
  s.edit((m) => ({ ...m, name: "One durable request" }));
  block = true;
  const auto = s.flush(),
    explicit = s.flush(true);
  await Promise.resolve();
  block = false;
  release!();
  await auto;
  await explicit;
  expect(f.writes()).toBe(1);
  expect(s.state().phase).toBe("saved");
});
