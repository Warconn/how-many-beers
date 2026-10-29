# Test accounts on dev and feature previews

PR #58 is merged into `dev`. On October 28, 2026, the owner confirmed that the Cloudflare Pages project `how-many-beers` uses **main as its Production branch**. Both `dev` and feature deployments therefore use **Preview** build variables. Earlier notes describing `dev` as the Pages Production branch are superseded.

| Use | Branch / URL | Cloudflare variables | Supabase |
| --- | --- | --- | --- |
| Public site | `main` / https://howmanybeers.app | Production | Leave account rollout disabled until a separate production project is configured |
| Integrated testing | `dev` / https://dev.how-many-beers.pages.dev | Preview | Existing dev project `txwfjuolsuauzeridxkv` |
| Feature testing | `feat/19-account-foundation` / https://feat-19-account-foundation.how-many-beers.pages.dev | Preview | Same dev project |

The project's default `https://how-many-beers.pages.dev` follows its Production branch, `main`; use the `dev.` alias for integrated testing. Supabase's own main/production database-branch badge is a separate concept and does not choose the frontend Git branch.

## 1. Cloudflare Preview variables

Open **Workers & Pages → how-many-beers → Settings → Variables and Secrets**, select **Preview**, and retain/copy the working feature configuration:

```dotenv
DEPLOY_TARGET=cloudflare
NEXT_PUBLIC_ENABLE_ACCOUNTS=true
NEXT_PUBLIC_ENABLE_CLOUD_COOKS=true
NEXT_PUBLIC_AUTH_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://txwfjuolsuauzeridxkv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<same dev publishable key used by the feature preview>
NEXT_PUBLIC_ACCOUNT_ORIGINS=https://dev.how-many-beers.pages.dev,https://feat-*.how-many-beers.pages.dev
NEXT_PUBLIC_AUTH_PROVIDERS=
```

The key placeholder must be replaced with the existing `sb_publishable_…` value. Keep providers blank for the current email-only setup. The origin setting is one comma-separated value without trailing slashes. Dev stays exact; the supported feature pattern accepts one `feat-…` hostname label inside this Pages project, only when `NEXT_PUBLIC_AUTH_ENV=development`. Preserve any other intentionally trusted exact test origins. Broader wildcards are not supported.

Leave **Production** variables unchanged. In particular, do not enable the dev account configuration on `https://howmanybeers.app`. No new DNS entry, Supabase project, SMTP key or sending domain is needed for the dev alias.

## 2. Supabase URLs

Open [the existing dev project](https://supabase.com/dashboard/project/txwfjuolsuauzeridxkv) → **Authentication → URL Configuration**.

Set **Site URL** to:

```text
https://dev.how-many-beers.pages.dev
```

Allow these exact **Redirect URLs**:

```text
https://dev.how-many-beers.pages.dev/account/callback/
https://feat-*.how-many-beers.pages.dev/account/callback/
```

The feature pattern covers future branch aliases without adding each branch. Add `http://localhost:3000/account/callback/` only if local sign-in testing is intended. The Site URL is the default destination; it does not prevent explicitly allowed feature callbacks. Code entry finishes inside the requesting origin.

Keep the existing custom SMTP and code-only email templates. They are project-wide and serve dev and feature previews together. Changing frontend branches does not require reapplying migrations: if cloud saves already work on the feature preview, both builds use those same tables/RPCs. If setup is incomplete, apply the reviewed migrations once in order as described in [account cooks](account-cooks.md); do not rerun already-applied migrations or run the local Auth bootstrap on hosted Supabase.

## 3. Rebuild dev

After saving the Preview variables, open **Deployments**, locate the latest **dev** deployment and retry its build, or trigger a fresh build of `dev`. Environment changes are compiled into the static frontend; refreshing an older deployment does not pick them up.

Open https://dev.how-many-beers.pages.dev after the build succeeds. The footer should show `dev` and the intended commit. Save/cancel open forms before refreshing an existing tab; closing old tabs and reopening the URL also allows a waiting app update to activate normally.

## 4. Verify shared account storage

1. Sign in on dev with your usual test email/code.
2. Create a cook, add a dish and wait for the cloud/check save icon.
3. Open the feature preview in another tab/browser and sign in with the **same email**. The same active cook should appear.
4. Finish the cook on dev, then reload the feature preview. Find it under **Home → Past cooks and backups** and open its notes/outcome.

Sessions are separate per website origin, so signing in on a feature preview does not automatically sign you into dev. Account data is shared through Supabase: it is still one active/planning cook per account across both sites. Edits and deletes on either site affect that same account data. Use different test accounts if you want independent cooks; divergent edits on two open copies require explicit reload instead of automatic merging.

## Future feature branches

Create feature branches from updated dev, or merge/rebase updated dev into an older branch so it includes the wildcard matcher. Once the Preview origin pattern and Supabase redirect pattern above are saved, future `feat/*` branch builds connect automatically; no per-branch URL edits are needed. Use the stable `feat-…how-many-beers.pages.dev` branch alias shown by Cloudflare, not a commit-hash deployment URL.

Only `https://feat-*.PROJECT.pages.dev` is recognized by the frontend, and only in development configuration. It does not authorize unrelated projects, non-feature branches, nested hosts, insecure URLs or production. Supabase's `*` excludes `.` and `/`, so the backend redirect pattern also stays within one hostname label and the exact callback path. See [Supabase's redirect wildcard documentation](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/redirect-urls.mdx). Keep production redirects exact.

If Preview branch filters are enabled, ensure they include `dev` and the intended `feat/*` branches. The restricted feature pattern authorizes only matching feature aliases; it does not enable arbitrary preview origins. Future schema changes also need to remain compatible with dev and any feature builds sharing the dev project.

Dashboard changes are owner actions; this guide does not claim that Cloudflare variables, Supabase URLs or SMTP settings were changed from the coding workspace. Production account rollout remains a separate delivery using a separate Supabase project.
