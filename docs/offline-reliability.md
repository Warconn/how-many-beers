# Offline cooking and local recovery (#10)

The app remains account-free and browser-local. Active cooks and archives retain their existing version-one JSON keys and backup format. No cloud outbox, login, background timer or notification service is introduced.

## Saving and recovery

- Every committed meal edit, checkbox, note and timestamped reading attempts a synchronous local write before the UI says **Saved on this device**. Notes are saved immediately rather than left in a debounce queue that could be lost when a phone suspends.
- A failed edit stays available in the current tab with a prominent **not saved** warning, **Retry saving**, and a downloadable normal backup containing the in-memory changes. The browser is asked to warn before leaving unsaved work. Browser/OS termination cannot be prevented.
- Malformed, unsupported or unavailable stored data opens a recovery screen. The app does not replace it with an empty cook. **Download recovery data** preserves exact readable bytes, journal information, prior recovery data and any read error. This is a troubleshooting/recovery file, not a normal importable cook backup.
- A known-good normal backup can restore from that screen after confirmation. Reset also requires confirmation and a successful write of a recovery copy before replacement. If storage cannot preserve that copy, reset fails safely. Users should still download the recovery file before resetting.
- Normal backups now accept up to 32 MiB, so pretty-printed exports of large local histories are not rejected by the prototype's previous 4 MB import cap. Nested cook, step, event and archive structures are validated before import.

### Multi-record transactions

`LocalCookStore` centralizes writes. Single-key changes use localStorage's atomic string replacement. Backup restore and Finish/Save archive transitions update active/history as a pair:

1. Write `how-many-beers:transaction:v1` with the original raw pair and `state: pending`.
2. Write the new history and active records.
3. Replace the journal with the small `state: committed` marker. This is the acknowledgement point.
4. Remove the journal when possible.

A failure before commit attempts to restore both original byte strings. If rollback also fails, writes are blocked and the pending journal remains for recovery. A crash with a pending journal restores the original pair on next writable load. A committed marker means both new records are valid even if cleanup was interrupted. Read-only tabs never recover another writer's in-progress journal.

The journal temporarily needs extra space for the original pair. Quota failure refuses the operation and preserves recovery instead of claiming success. Exporting and pruning old history can free space. IndexedDB was considered; adding an asynchronous migration and second source of truth was not necessary to fix the current failure paths. The adapter provides a boundary for a later migration if larger histories warrant it.

### Multiple tabs

Where Web Locks is available, one tab holds the origin's cooking write lock. Other tabs can inspect/export their copy but must close the writer and reload before saving. This prevents simultaneous check/write races. Compare-before-write checks and storage-event warnings also detect stale data, including changes made by older app versions. Browsers without usable Web Locks retain these stale-write checks; keep one cooking tab open rather than treating this as collaborative editing or cross-device sync.

## Offline shell and updates

`npm run build` generates a scoped, content-versioned `sw.js` after Next.js static export. Installation caches the complete HTML/JavaScript/CSS/manifest/brand asset set; an incomplete install never replaces the last working worker. No private cook data is put into CacheStorage or sent to a server.

Offline shell preparation runs in the background after an online visit. Install/offline help and routine readiness messages are intentionally absent from the app. An existing cook can then reopen, log actions, finish/archive and export backups offline in the same browser/site. A cold first visit while offline cannot install the app. Cleared/evicted browser data or caches can still remove local availability; the status check detects missing cache entries and attempts preparation again when connected.

Navigation tries the network, then uses the cached app after an error, unavailable response or four-second connection stall. Immutable assets are cached; other origins, API routes and non-GET requests are not intercepted. Root and supported GitHub Pages subpath builds each use their own scope and cache prefix.

An installed update waits. **Update app** is an explicit reload action and is disabled for unsaved edits/readings, pending custom steps, unfinished recipe entry or an open finish form. No other open tab is automatically reloaded. Old static assets are retained while old tabs might still need them; old caches are reclaimed on activation when no old tab remains. The service worker never clears cook storage. Cloudflare cache headers and `updateViaCache: none` keep the worker script updateable.

Installation uses the browser’s own controls; the app provides no install prompt or help section. The manifest uses the approved circle-highlighted 192/512 icons; Apple retains its touch icon. Browser installation prompts and storage durability vary by platform, and installation is not a cloud backup.

## Regression checks

- Unit fault injection: malformed/nested data, version-one compatibility, denial/quota, each transaction stage, crash recovery, rollback failure, stale writers, retained recovery copies and large-history export/import.
- Worker policy tests: failed installation, cached navigation, stalled network, scope boundaries, API/cross-origin exclusions, safe activation/old-cache retention, explicit update, cache eviction and quota.
- Desktop/mobile user journeys: raw recovery download, failed restore and finish/archive, recoverable unsaved checkboxes/backups/retry, confirmed reset/restore, blocked reads and stale tabs.
- Built-app offline tests: reopen and archive across an overnight DST change; log actual temperatures/notes while offline; manifest/icons; failed update; open step and custom-step drafts blocking reload.
- CI runs both Android Chromium and iPhone WebKit for the built-app suite, including the storage fault/recovery journeys. Local cloud testing uses installed Chromium because the Playwright browser-download destination is restricted; CI verifies WebKit.

Run `npm test`, `npm run typecheck`, and `npm run test:e2e`. Install Chromium and WebKit with `npx playwright install --with-deps chromium webkit`, then run `npm run test:offline`. The latter builds the real static export and starts a localhost-only test server. Its worker-update controls are test fixtures and are never deployed. Offline tests use separate output/report directories from the development-server suite.

Real iPhone/Android hardware suspension, storage-pressure eviction and outdoor usability remain hands-on alpha checks under #4. Automated engine tests and injected failures do not certify those device-specific conditions. Main/production promotion is separate from a feature preview or dev merge.

## Menu-based updates (October 28, 2026)

App updates are offered inside Account (Menu when accounts are disabled), never as a workspace banner. Worker registration and update detection stay mounted while the menu is closed. Updating is an optional explicit reload for an already-open app; normal service-worker activation after old tabs close needs no button. Open cook forms, pending saving and unfinished sign-in forms disable the action. Closing/reopening the menu retains the waiting update and cooking drafts.
