# How Many Beers? brand identity (#45)

The approved identity is **01-A, Classic Dial (Beer Clock)**: a foamy pint with a clean clock inside. The canonical source is recorded in [issue #45](https://github.com/Warconn/how-many-beers/issues/45#issuecomment-6454495947) and committed unchanged as `public/brand/primary-mark.svg`. Do not substitute the earlier plate-clock exploration.

## Language and use

- Name: **How Many Beers?**
- Tagline: **From First Beer to First Bite.**
- Supporting line: **Plan every dish. Time your dinner. Enjoy the cook.**
- Public canonical domain: **https://howmanybeers.app/**
- Explain the utility with serving time, dishes, an adjustable schedule and guided cooking. Do not imply a precise beer countdown, guaranteed dinner time, cloud saving or automatic recipe intelligence.

Use the expressive serif heading on first-visit Home; use compact branding for returning cooks so their saved cook and Resume/Continue remain prominent. UI body text and actions retain the system sans-serif stack. No font download is needed. The artwork is original vector geometry, not a raster image embedded in SVG. No generated concept artwork is shipped.

## Palette

| Role | Color |
| --- | --- |
| Charcoal | `#282722` |
| Burnt orange | `#AF4F27` |
| Amber illustration fill | `#DEA15E` |
| Circle highlight | `#EEE4D5` |
| Ivory | `#F7F5F0` |
| Warm white | `#FFFDF9` |
| Dark orange for small text | `#873A1E` |
| Muted text on updated brand surfaces | `#6D675F` |

Amber is an illustration accent, not small body text. Muted text on the updated surfaces has 5.13:1 contrast against ivory; burnt orange has 4.85:1 and dark orange has 7.26:1. Icons without independent meaning are decorative and hidden from assistive technology; standalone brand images need a meaningful name. Reserve SVG dimensions before loading. Keyboard focus remains visible on Home actions.

## Assets

All sources/exports are in `public/brand/`:

- `primary-mark.svg`: unchanged transparent canonical geometry, retained as the original source.
- `badge-mark.svg`: preferred reusable 256-square identity, with the approved warm circle and tighter artwork spacing. Use this for brand appearances in the app and artwork.
- `mark-dark.svg`, `mark-monochrome.svg`: color variants. Use the dark variant on charcoal, monochrome on light backgrounds.
- `wordmark.svg`, `tagline-lockup.svg`: editable SVG text plus original mark. Text uses Georgia/serif and Arial/sans-serif fallbacks; installed font metrics can vary. Raster exports below have fixed typography.
- `favicon.svg`: circle-highlighted mark; `favicon-16.png`, `favicon-32.png`, `favicon-48.png` are raster exports. `/favicon.ico` contains those three sizes.
- `app-icon.svg`: circle-highlighted identity on an opaque ivory icon source; `apple-touch-icon.png` is 180-square, with additional `icon-192.png` and `icon-512.png`. These icons do not imply offline/PWA support.
- `social-card.svg`: editable 1200 × 630 composition. `social-card.png` is the fixed PNG used by both Open Graph and X large-image metadata. Retain readable text and ample margins.

Raster assets were rendered from the SVG sources using Sharp (already used by Next.js); the multi-size ICO was assembled from the PNGs with ImageMagick. When changing typography, regenerate the social PNG and inspect it rather than relying on the SVG's font fallback alone. The primary mark and icons contain no font dependency. No third-party icon art or web font was added.

Preserve the source viewBox/geometry of the primary mark. The preferred badge and favicon scale the original geometry inside a circular highlight for small-size recognition. Test at native 16/32/48 px and 180/192/512 px before changing details. Leave clear space around the mark; do not stretch it or use the clock to imply an exact finish prediction.

## Implementation and review

All brand appearances use the circle-highlighted identity: shared header, Beerometer emblem, README wordmark, tagline lockup, dark/monochrome variants, favicon and Apple/app icons. The social card already uses the same warm circle. Header and Beerometer share `badge-mark.svg`, so the circle is part of the reusable vector asset rather than a CSS-only treatment. The original source geometry remains unchanged. `NEXT_PUBLIC_BASE_PATH` follows the existing deployment target so local brand assets work both at Cloudflare's root and GitHub Pages' `/how-many-beers` path. No route or deployment workflow changes are required. Canonical/Open Graph/X URLs intentionally identify the public custom domain, even on a preview build.

README, Home/header/footer and Next.js metadata share the approved wording. Existing localStorage keys, backup formats, scheduling and cooking behavior stay intact. Broader decorative UI replacement remains #21.

Review desktop/phone Home and returning-cook screenshots, the brand asset sheet and social card. Run TypeScript, unit tests, browser journeys and static builds for both deployment targets. After an approved deployment, verify the public URLs and social preview through link inspectors; preview caches may require refreshing. Local checks cannot certify that deployed step.

### Implementation verification

- TypeScript and 77 unit tests passed.
- All 90 desktop/mobile Playwright checks passed, including new first-visit branding, metadata/assets and non-destructive resume journeys. Acceptance tests were first run against the old UI and failed on its missing tagline.
- Static production builds passed for both GitHub Pages and Cloudflare. Exported brand/icon paths were checked against the output files; canonical/social URLs point to the public custom domain.
- The local environment used installed system Chromium with video disabled because the Playwright browser download is restricted. The repository's CI browser configuration remains unchanged.
- Native-size icons, the 512 px export, social composition and desktop/phone layouts were visually inspected. The accompanying screenshots are review evidence, not approved pixel-test goldens.
- The circle-highlight rollout across all identity assets passed 18 targeted desktop/mobile branding and Cooking Mode checks, 77 unit tests, TypeScript and both static build targets. Brand/icon paths and the client reference to the reusable badge were verified in each export.
- Public-domain asset loading and social link inspectors remain post-deployment acceptance. This feature does not deploy or change account configuration.
