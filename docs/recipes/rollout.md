# Personal recipes (#114): development review and rollout

This is an additive feature candidate, not an approved production rollout. Existing
cooks/history/plans use unchanged persistence. There is no automatic conversion,
historical import or My recipes population. Browns Brisket was not accessed.

## Development preview prerequisite

After reviewing it, the owner may apply the complete checked-in migration
`supabase/migrations/202611110001_personal_recipes.sql` to the **development**
Supabase project used by feature previews. It runs in a transaction and includes
PostgREST schema-cache reload. Do not run test/bootstrap SQL in a hosted project.
The agent has applied this migration only to disposable local PostgreSQL.

This creates owner-scoped personal_recipes and immutable operation receipts;
it does not modify cook tables or saved plans. Normal removal retains document,
identity, ownership, revision and a server-owned deleted_at. No direct client
insert/update/delete grants exist. Existing meal snapshots remain independent.
The per-owner mutation lock makes saves/removals serial and stale revisions fail.

The canonical JSON Schema is embedded in server validation and pinned by a unit
test against the checked-in schema. Server validation rejects unknown properties,
execution fields, unsupported versions, malformed shape/references, invalid timing
ranges and duplicate IDs. A separate authoring library boundary accepts only recipe
documents, never the compatibility/history envelopes from Phase 2.

After application, this read-only check in SQL Editor can confirm RPC installation:

```sql
select to_regprocedure('public.list_personal_recipes(uuid)'),
       to_regprocedure('public.mutate_personal_recipe(uuid,uuid,bigint,uuid,text,jsonb)');
```

Missing migration is capability-gated with an honest unavailable message; no fake
library success or browser-only substitute is used. Existing Add to meal still
works. The feature URL is reported separately after Cloudflare confirms it.

## Owner review

1. Sign in on the feature preview. Plan a cook and review a template/custom method.
   Save recipe is secondary; saving leaves the method open and meal unchanged.
2. Add to meal independently. It must not create another library entry.
3. Open My recipes, select Use recipe, adjust today's copy and Add to meal. The
   saved original and meal serving target remain unchanged.
4. Edit > Save changes, rename, Cancel and Save as new should have explicit outcomes.
5. Remove a recipe: dismiss to keep it, then confirm. Reload/sign in on another
   device; it stays hidden. Existing dishes, actuals, plans and history stay intact.
6. Save a meal-specific method via Dish settings > Save as new recipe. It extracts
   authored steps and excludes actuals/calendar history without changing the meal.
7. Guest Save recipe opens optional sign-in and preserves the review draft. It does
   not automatically import the guest meal or save the method after sign-in.

## Failure and rollback boundaries

Explicit saves/removals journal an immutable owner-scoped operation before RPC.
Lost replies reuse the same operation ID across reload. Failure is not success;
review inputs stay in place. Revision conflicts never become fresh overwrites or
resurrect deleted recipes. Explicit Use saved version protects the pending change
on the device before releasing its journal. Recipe controls do not write workspace,
upcoming-plan or history records.

An application rollback should retain the additive tables and receipts. Do not drop
recipe rows or reverse the existing cook migrations. Capability gating preserves
ordinary planning when the recipe RPC is absent. Production migration and release
need separate owner approval after development acceptance, full regression and
actual desktop/mobile/iPhone WebKit screenshot review.
