import { migrateMeal } from "../domain/cookState";
import { newMeal, type Meal } from "../domain/meal";
import {
  isMeal,
  readHistory,
  type HistoryLibrary,
} from "../domain/cookHistory";
import type { LocalSnapshot } from "../domain/localPersistence";
import {
  AccountConflict,
  decode,
  encode,
  equal,
  parseRemote,
  type Document,
  type Remote,
  type WorkspaceAPI,
} from "./workspace";
import type { RecoveryStorage } from "./recoveryStorage";
type StoragePort = RecoveryStorage;
type Operation = {
  id: string;
  revision: number;
  document: Document;
  snapshot: LocalSnapshot;
  critical: boolean;
};
type Cache = {
  version: 1;
  owner: string;
  base: Remote;
  desired: LocalSnapshot | null;
  operation: Operation | null;
};
export type AccountState = {
  snapshot: LocalSnapshot | null;
  backup: LocalSnapshot | null;
  phase:
    | "loading"
    | "load-error"
    | "saved"
    | "syncing"
    | "unsaved"
    | "conflict"
    | "saving"
    | "blocked";
  error: string;
};
export const accountCacheKey = (owner: string) =>
  "how-many-beers:account:v1:" + owner + ":workspace";
const validSnapshot = (s: LocalSnapshot) => {
  if (!s || !isMeal(s.active)) throw Error("Invalid recovery cook.");
  readHistory(s.history);
  return s;
};
/** One recoverable snapshot plus an immutable in-flight request, not a multi-device outbox. */
export class AccountCookStore {
  readonly key: string;
  private base: Remote | null = null;
  private desired: LocalSnapshot | null = null;
  private operation: Operation | null = null;
  private visible: LocalSnapshot | null = null;
  private empty = migrateMeal(newMeal());
  private phase: AccountState["phase"] = "loading";
  private error = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inflight: Promise<void> | null = null;
  private disposed = false;
  private baseline: string | null = null;
  private recoveryRawAllowed = true;
  private storageBlocked = false;
  private criticalRequested = false;
  constructor(
    readonly owner: string,
    private api: WorkspaceAPI,
    private storage: StoragePort,
    private emit: (state: AccountState) => void,
    private maySend: () => boolean = () => true,
    private readonlyMode = false,
  ) {
    this.key = accountCacheKey(owner);
    try {
      this.baseline = storage.getItem(this.key);
      if (this.baseline) {
        const c = JSON.parse(this.baseline) as Cache;
        if (c.owner !== owner) {
          this.recoveryRawAllowed = false;
          throw Error("Recovery owner mismatch.");
        }
        if (c.version !== 1) throw Error("Unsupported recovery format.");
        this.base = parseRemote(c.base);
        this.desired = c.desired ? validSnapshot(c.desired) : null;
        if (c.operation) {
          if (
            typeof c.operation.id !== "string" ||
            !Number.isSafeInteger(c.operation.revision) ||
            c.operation.revision < 0 ||
            typeof c.operation.critical !== "boolean"
          )
            throw Error("Invalid recovery operation.");
          validSnapshot(c.operation.snapshot);
          const data = parseRemote({
            ...c.operation.document,
            revision: c.operation.revision,
            writeId: c.operation.id,
          });
          // An inconsistent journal is protected rather than replayed.
          if (
            !equal(encode(c.operation.snapshot, this.base), {
              active: data.active,
              history: data.history,
            })
          )
            throw Error("Invalid recovery request.");
          this.operation = c.operation;
        }
        this.visible = this.desired ?? decode(this.base, this.empty);
      }
    } catch {
      this.phase = "load-error";
      this.error =
        "Saved recovery data could not be read safely. It has not been replaced.";
      this.storageBlocked = true;
    }
  }
  state(): AccountState {
    let backup = this.desired ?? this.visible;
    if (
      this.operation?.critical &&
      this.visible &&
      this.desired &&
      !this.desired.history.cooks.some((c) => c.id === this.visible!.active.id)
    ) {
      backup = {
        active: this.visible.active,
        history: {
          version: 1,
          cooks: [
            ...this.visible.history.cooks,
            ...this.desired.history.cooks.filter(
              (c) =>
                !this.visible!.history.cooks.some((old) => old.id === c.id),
            ),
          ],
        },
      };
    }
    return {
      snapshot: this.visible,
      backup,
      phase:
        this.criticalRequested &&
        !["blocked", "conflict", "unsaved", "load-error"].includes(this.phase)
          ? "saving"
          : this.phase,
      error: this.error,
    };
  }
  private publish() {
    if (!this.disposed) this.emit(this.state());
  }
  private persist() {
    if (this.readonlyMode)
      throw new AccountConflict(
        "Another tab is editing this account cook. Close it and reload here.",
      );
    if (this.storageBlocked) throw Error(this.error);
    if (this.storage.getItem(this.key) !== this.baseline)
      throw new AccountConflict(
        "Another tab changed this cook. Download a backup before reloading.",
      );
    const raw = JSON.stringify({
      version: 1,
      owner: this.owner,
      base: this.base!,
      desired: this.desired,
      operation: this.operation,
    } satisfies Cache);
    this.storage.setItem(this.key, raw);
    this.baseline = raw;
  }
  private failed(error: unknown, critical = false) {
    this.phase =
      error instanceof AccountConflict
        ? "conflict"
        : critical
          ? "blocked"
          : "unsaved";
    this.error =
      error instanceof Error
        ? error.message
        : "Account saving failed. Keep this page open and download a backup.";
    this.publish();
  }
  async connect() {
    if (this.disposed || this.storageBlocked) return;
    if (this.inflight) await this.inflight.catch(() => {});
    if (this.disposed) return;
    try {
      const remote = await this.api.read();
      if (this.disposed) return;
      // A read begun before a save can arrive after its acknowledgment. It must
      // not replace the newer acknowledged cook with its older snapshot.
      if (this.base && remote.revision < this.base.revision) return;
      if (this.readonlyMode) {
        this.visible = decode(remote, this.empty);
        this.phase = "conflict";
        this.error =
          "Another tab is editing this account cook. Close it, then reload saved cooks here.";
        this.publish();
        return;
      }
      if (this.operation && remote.writeId === this.operation.id) {
        const done = this.operation;
        this.base = remote;
        this.operation = null;
        if (equal(this.desired, done.snapshot)) this.desired = null;
        this.visible = this.desired ?? decode(remote, this.empty);
      } else if (
        this.desired &&
        this.base &&
        remote.revision !== this.base.revision
      ) {
        this.failed(
          new AccountConflict(
            "Your account cook changed on another device. Download a backup before loading the latest version.",
          ),
        );
        return;
      } else {
        this.base = remote;
        this.visible = this.desired ?? decode(remote, this.empty);
      }
      this.phase = this.operation?.critical
        ? "blocked"
        : this.desired
          ? "unsaved"
          : "saved";
      this.error = "";
      this.persist();
      await this.storage.settled?.();
      if (this.disposed) return;
      this.publish();
      if (this.desired && !this.operation?.critical) this.schedule();
    } catch (error) {
      if (this.disposed) return;
      if (!this.base || !this.visible) {
        this.phase = "load-error";
        this.error =
          "Could not load your account cooks. Reconnect and retry before making changes.";
        this.publish();
      } else this.failed(error, !!this.operation?.critical);
    }
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(() => {});
    }, 500);
  }
  edit(fn: (meal: Meal) => Meal) {
    if (
      this.criticalRequested ||
      !this.visible ||
      !this.base ||
      ["conflict", "blocked", "saving", "load-error"].includes(this.phase)
    )
      throw Error("Resolve the saving warning before editing this cook.");
    const next = {
      active: migrateMeal(fn(this.visible.active)),
      history: this.visible.history,
    };
    validSnapshot(next);
    this.desired = next;
    this.visible = next;
    try {
      this.persist();
      this.phase = "syncing";
      this.error = "";
      this.publish();
      void this.storage.settled?.().catch((error) => {
        if (!this.disposed) this.failed(error);
      });
      this.schedule();
    } catch (error) {
      this.failed(error);
    }
  }
  async save(change: { active?: Meal; history?: HistoryLibrary }) {
    if (
      this.criticalRequested ||
      !this.visible ||
      !this.base ||
      ["conflict", "blocked", "saving", "load-error"].includes(this.phase)
    )
      throw Error("Resolve account saving before continuing.");
    this.criticalRequested = true;
    this.publish();
    try {
      // Finish a prior automatic request before beginning a critical transition.
      if (this.inflight) await this.inflight;
      if (this.desired) await this.flush();
      if (this.disposed) throw Error("Account changed.");
      const next = {
        active: migrateMeal(change.active ?? this.visible.active),
        history: change.history ?? this.visible.history,
      };
      validSnapshot(next);
      this.desired = next;
      this.operation = {
        id: crypto.randomUUID(),
        revision: this.base.revision,
        document: encode(next, this.base),
        snapshot: next,
        critical: true,
      };
      this.phase = "saving";
      this.error = "";
      try {
        this.persist();
        this.publish();
        await this.flush(true);
      } catch (error) {
        this.failed(error, true);
        throw error;
      }
    } finally {
      this.criticalRequested = false;
      this.publish();
    }
  }
  async flush(explicit = false): Promise<void> {
    if (this.inflight) {
      await this.inflight;
      if (this.desired && explicit) return this.flush(true);
      return;
    }
    if (this.disposed || !this.desired) return;
    if (this.phase === "conflict" || this.storageBlocked)
      throw new AccountConflict(this.error || "Account data needs recovery.");
    if (this.operation?.critical && !explicit) return;
    if (!this.maySend()) {
      this.failed(
        Error("Reconnect to save your latest changes to your account."),
        !!this.operation?.critical,
      );
      throw Error(this.error);
    }
    if (!this.base) throw Error("Account cooks have not loaded.");
    if (!this.operation)
      this.operation = {
        id: crypto.randomUUID(),
        revision: this.base.revision,
        document: encode(this.desired, this.base),
        snapshot: this.desired,
        critical: false,
      };
    const operation = this.operation;
    // Own the whole request, including asynchronous recovery writes. Otherwise a
    // timer and an explicit Save can both enter before IndexedDB has committed.
    const sending = (async () => {
      try {
        this.persist();
        await this.storage.settled?.();
        if (this.disposed) return;
        this.phase = operation.critical ? "saving" : "syncing";
        this.error = "";
        this.publish();
        const remote = await this.api.write(
          operation.revision,
          operation.id,
          operation.document,
        );
        if (this.disposed) return;
        this.base = remote;
        this.operation = null;
        if (equal(this.desired, operation.snapshot)) this.desired = null;
        this.visible = this.desired ?? decode(remote, this.empty);
        this.phase = this.desired ? "syncing" : "saved";
        this.error = "";
        // The server has acknowledged this operation. A subsequent recovery-cache
        // failure must not turn a committed Finish into an unconfirmed transaction.
        try {
          this.persist();
          await this.storage.settled?.();
        } catch (error) {
          if (error instanceof AccountConflict) {
            this.phase = "conflict";
            this.error = error.message;
          } else {
            this.phase = this.desired ? "unsaved" : "saved";
            this.error = this.desired
              ? "Recovery storage is unavailable. Download a backup before closing this page."
              : "Your account saved this cook, but recovery storage is unavailable. Download a backup before cooking offline.";
          }
        }
        this.publish();
      } catch (error) {
        if (!this.disposed) this.failed(error, operation.critical);
        throw error;
      }
    })();
    this.inflight = sending;
    try {
      await sending;
    } finally {
      if (this.inflight === sending) this.inflight = null;
    }
    if (!this.disposed && this.desired && this.state().phase !== "conflict") {
      if (explicit) await this.flush(true);
      else this.schedule();
    }
  }
  async retry() {
    if (this.phase === "load-error" || !this.desired) return this.connect();
    await this.flush(true);
  }
  async reload() {
    if (this.inflight) await this.inflight.catch(() => {});
    const remote = await this.api.read();
    if (this.disposed) return;
    this.base = remote;
    this.desired = null;
    this.operation = null;
    this.visible = decode(remote, this.empty);
    this.phase = "saved";
    this.error = "";
    // Explicit user recovery is the only place that accepts another tab's baseline.
    await this.storage.rebase?.();
    this.baseline = this.storage.getItem(this.key);
    this.storageBlocked = false;
    this.persist();
    await this.storage.settled?.();
    this.publish();
  }
  recoveryExport() {
    return JSON.stringify(
      {
        format: "how-many-beers-account-recovery",
        version: 1,
        owner: this.owner,
        cache: this.recoveryRawAllowed ? this.baseline : null,
        pending: this.desired,
      },
      null,
      2,
    );
  }
  dirty() {
    return !!this.desired || !!this.operation;
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.storage.close?.();
  }
}
