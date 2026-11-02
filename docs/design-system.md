# How Many Beers application design system (#21)

Use the approved [Classic Dial identity](brand-identity.md), existing warm palette
and restrained functional layouts. The app's primary task is reading the next
action and checking it off. This is visual consistency, not a new cooking flow.

## Foundations

`src/app/design-system.css` defines the shared tokens and functional-view rules.
It follows existing `globals.css`; it does not replace the approved brand artwork
or Beerometer rules. Reuse the small `Icon` component for interface iconography.

| Role | Token or value | Use |
| --- | --- | --- |
| Page / surface | `--bg` #F7F5F0 / `--surface` #FFFDF9 | Warm ivory and quiet cards |
| Main / secondary text | `--ink` #22211E / `--text-secondary` #6D675F | Instructions / supporting context |
| Primary action | `--accent` #AF4F27 | Start, Save, Finish; keep clear text |
| Action text / focus | `--accent-dark` #873A1E | Secondary links and keyboard focus |
| Secondary action | `--accent-light` #FBEDE3 | Review, edit, back, cancel a form |
| Success / warning / error | #48613C / #79521B / #963C2D | Always pair color with explicit wording |
| Field boundary | `--field-border` #948779 | Visible form-control boundary |
| Spacing | `--space-1`…`--space-6`: 4, 8, 12, 16, 24, 32 px | Consistent gaps, padding and groups |
| Controls / surfaces | 10 / 16 px radius | Understated, rounded utility |
| Small / body text | 14 / 16 px | Supporting text / instructions and inputs |
| Functional headings | 24 px; cook title 32 desktop / 28 phone | System sans-serif, short line lengths |
| Metadata | 12 px | Dates and secondary dish context only |

Retain the established Arial/Helvetica/system sans-serif interface. The expressive
serif identity remains on Home/header as specified by #45. Do not download another
font or substitute a logo. Body instructions need room and 1.5–1.6 line height;
functional headings use 1.2–1.45. Avoid tiny text to make a busy view fit.

## Controls and information hierarchy

Keep one primary action per decision group. Secondary actions use the warm pale
surface; destructive actions remain separate, plainly labeled and confirmed. A
visual pass must not change event meanings or make Cancel mean Finish. Planning
retains its short editor, duration controls and collapsed advanced options.

Controls and disclosures have at least 44 px targets. Native checkboxes sit inside
44 px labels; do not shrink that target to the visible check square. Inputs use
16 px text to avoid iPhone zoom. All actionable controls show a 3 px dark-orange
focus ring. Disabled controls remain identifiable. On phones stack action groups
where needed, allow names/instructions to wrap and respect the existing safe-area
footer. Never hide a meaningful action just to fit a screenshot.

Use one quiet round-stroke SVG icon family, a 24-unit viewBox with 1.75-unit strokes.
Icons supplement text, retain named buttons and are hidden from assistive technology.
An icon-only control requires its existing specific accessible label. Use the same
family for navigation, step moves/removal, account/save status and Cook History.
Decorative emoji and platform-dependent pictograms do not belong in app chrome.
Recipe/user-authored content and temperature-stage notation are not decorative UI.
No additional illustrations are needed for this pass.

Warnings and recovery states use semantic text and color, without repeating generic
instructions. Empty states explain the next real action and use the same surfaces,
type and buttons as populated states. Preserve actual save failures and safety
instructions. Reduced-motion mode disables cosmetic transitions and animation.

## Protected boundaries

The Beerometer component, metrics, colors, type sizes, artwork and responsive design
remain intact. Functional type selectors explicitly exclude its descendants.
Domain timing, storage schemas, authentication, history, guest behavior and recipe
parsing are unchanged. The #84 layout/progress/finish delivery remains the base.

Visible physical Start/logging controls remain a known interaction gap tracked in
[#97](https://github.com/Warconn/how-many-beers/issues/97). Resolve that in a separate
focused functional PR; hiding controls without defining actual-start semantics
would undo #86. The visual pass does not claim checklist-first behavior is complete.

## Evidence

Run the design-system browser spec on desktop, Android-sized Chromium and iPhone
WebKit. Review real planning, active cooking and history screenshots before/after;
verify focus, target sizes, overflow, text contrast and untouched stored records.
Capture the Beerometer separately to compare the protected design. Run full unit,
browser, account/auth and production/offline checks before declaring the PR ready.
