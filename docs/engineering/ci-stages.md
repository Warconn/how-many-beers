# Risk-based test stages

The intent is fast iteration without losing release confidence.

| Trigger | Required suites |
| --- | --- |
| Draft feature PR to dev | Types, unit, real-browser critical smoke |
| Ready feature PR to dev | Types, unit, smoke, authentication, offline; account browser matrix if relevant paths changed |
| Push to dev | Types, unit, smoke, authentication, offline; account matrix if relevant paths changed |
| PR to main (dev → production) | **Full coverage**: types/unit/smoke, auth/offline, account desktop and two iPhone WebKit shards, three general regression shards, screenshots, and aggregate `playwright` |
| Push to main or manual workflow dispatch | Same full coverage |

### Automatic scope classification

The job `scope` compares the exact base and head SHAs with `git diff`.
Missing or invalid history selects the **entire** full suite (fail closed).

Account tests automatically run for changes under `src/account/`,
`src/auth/`, `src/domain/`, `src/app/`, account-related components,
`supabase/`, `e2e/auth/`, account test files, Playwright account/auth
configuration, dependency changes or workflows. Non-account feature work
does not spend ~7 minutes running unrelated account suites.

Full general regression is always mandatory when targeting `main`, when
pushing `main`, or when manually dispatching the workflow. On the Dev
branch it is intentionally deferred to the release gate. Developers must run
focused tests for the feature they're changing. The always-on smoke cases
cover guest home/resume, phantom-plan discard and protected recipe reload.

### Gate semantics

The existing `playwright` aggregate check runs on ready PRs and pushes.
It requires every suite selected by the scope job to pass. A skipped account
job is valid **only** when classification says account testing is not needed.
A skipped general regression is valid **only** outside the full release gate.
A failed, canceled or unexpected skipped required job fails the aggregate.

GitHub Actions CPU time is not ChatGPT token usage. Repeated agents polling
CI, inspecting logs, editing code and restarting suites consume the tokens.
Use one focused local test cycle per increment, then CI once on a stable
candidate. The fast smoke takes about a minute; previous full green
regression took 8m59s (PR #142).

### Production protection

Cloudflare still independently deploys the `main` branch. This workflow
does not prove GitHub required checks or Cloudflare deployment gating are
configured. Ensure the `main` branch requires the successful aggregate
`playwright`, build verification and any applicable database security checks
**before merging**. Running full tests *after* a main push does not itself
prevent a bad release from deploying.

No tests were removed, and this is a workflow/docs change only.
