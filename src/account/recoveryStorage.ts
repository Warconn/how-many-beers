import { AccountConflict } from "./workspace";
export type RecoveryStorage = Pick<Storage, "getItem" | "setItem"> & {
  settled?: () => Promise<void>;
  rebase?: () => Promise<void>;
  close?: () => void;
};
/** Owner-keyed IndexedDB recovery with atomic compare/write across tabs. No Auth tokens. */
export async function recoveryStorage(key: string): Promise<RecoveryStorage> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("how-many-beers-accounts-v1", 1);
    let finished = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore("workspaces");
    };
    request.onblocked = () => {
      finished = true;
      reject(Error("Close other account tabs, then retry recovery storage."));
    };
    request.onerror = () => {
      finished = true;
      reject(
        request.error ?? Error("Account recovery storage is unavailable."),
      );
    };
    request.onsuccess = () => {
      if (finished) request.result.close();
      else {
        finished = true;
        resolve(request.result);
      }
    };
  });
  const read = () =>
    new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction("workspaces", "readonly"),
        request = tx.objectStore("workspaces").get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(typeof request.result === "string" ? request.result : null);
    });
  let durable = await read(),
    memory = durable,
    pending: string | null = null,
    inflight: Promise<void> | null = null,
    closed = false;
  const put = (expected: string | null, next: string) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspaces", "readwrite"),
        store = tx.objectStore("workspaces"),
        request = store.get(key);
      let conflict = false;
      request.onsuccess = () => {
        const current =
          typeof request.result === "string" ? request.result : null;
        if (current !== expected) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put(next, key);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          conflict
            ? new AccountConflict(
                "Another tab changed your recovery copy. Download a backup before loading the account version.",
              )
            : (tx.error ??
                Error(
                  "Account recovery storage is full or unavailable. Download a backup before closing this page.",
                )),
        );
      tx.onerror = () => {
        /* The abort handler reports the transaction failure. */
      };
    });
  const settled = async (): Promise<void> => {
    if (inflight) {
      await inflight;
      if (pending !== null) return settled();
      return;
    }
    if (closed) throw Error("Account recovery storage is closed.");
    inflight = (async () => {
      while (pending !== null) {
        const next = pending;
        pending = null;
        try {
          await put(durable, next);
          durable = next;
        } catch (error) {
          pending = memory;
          throw error;
        }
      }
    })();
    try {
      await inflight;
    } finally {
      inflight = null;
    }
  };
  return {
    getItem: () => memory,
    setItem: (_key, value) => {
      if (closed) throw Error("Account recovery storage is closed.");
      memory = value;
      pending = value;
    },
    settled,
    rebase: async () => {
      if (inflight) await inflight.catch(() => {});
      pending = null;
      durable = await read();
      memory = durable;
    },
    close: () => {
      closed = true;
      db.close();
    },
  };
}
