# Component census — what's used, what's reused, what's copied

**Date:** 2026-09-15
**Scope:** every `.tsx` under `apps/*/src/components/` and `packages/*/src/`.
**Method:** content hashing for exact duplicates, basename grouping for drift,
import parsing for adoption. Counts are mechanical, not estimates.

---

## Headline

| | |
|---|---|
| Component files in apps | **454** (~60,000 lines) |
| Component files in packages | **203** (~34,000 lines) |
| Distinct component paths across apps | **311** |
| …used in more than one app | **49** |
| …unique to one app | **262** |
| **Exact duplicate groups** | **56**, spanning **176 files** |
| **Redundant lines from exact duplication** | **10,816** |
| Same-name-but-drifted groups | **50** |

Roughly **one in six** app component files is a byte-identical copy of another
file in the repo.

---

## 1. What is genuinely shared (the layer that works)

Shared-package adoption, by number of apps importing:

| Package | Apps | Import sites | Notes |
|---|---:|---:|---|
| `@elkdonis/auth-server` | 17 | 235 | near-universal |
| `@elkdonis/db` | 13 | 194 | |
| `@elkdonis/auth-client` | 13 | 26 | |
| `@elkdonis/services` | 12 | 260 | the business-logic spine |
| `@elkdonis/cms-ui` | 10 | 86 | the UI spine |
| `@elkdonis/utils` | 10 | 61 | |
| `@elkdonis/commerce` | 8 | 45 | |
| `@elkdonis/types` | 6 | 32 | |
| `@elkdonis/nextcloud` | 6 | 22 | |
| `@elkdonis/forum-ui` | 4 | 14 | |
| `@elkdonis/ui` | 4 | 34 | **the Mantine one — dying** |
| `@elkdonis/live-editor` | 3 | 22 | artdirect, arts-collective, ifac |
| `@elkdonis/cms-bindings` | 3 | 10 | |
| `@elkdonis/silex-render` | 2 | 15 | arts-collective, hidden-enneagram |
| `@elkdonis/sky-ui` | 2 | 4 | arts-collective, elastrocal |
| `@elkdonis/three`, `studio-ui`, `payments`, `redis`, `hooks`, `reading-wizard`, `messaging`, `openclaw-bridge` | 1 each | 1–10 | single-consumer |

### `@elkdonis/cms-ui` by entry point

This is the real shared-UI story, and it's healthier than the raw duplication
numbers suggest:

| Entry | Apps | Consumers |
|---|---:|---|
| `/auth` | 7 | amrit-canada, arts-collective, danamccool, elastrocal, ifac, innergathering, pigeonshoot |
| `/surface` | 6 | amrit-canada, arts-collective, elastrocal, hidden-enneagram, ifac, innergathering |
| `/editor` | 5 | amrit-canada, art-auction, arts-collective, hidden-enneagram, innergathering |
| `/files` | 5 | amrit-canada, arts-collective, hidden-enneagram, ifac, innergathering |
| `/compose` | 4 | amrit-canada, arts-collective, ifac, innergathering |
| `/wizard` | 4 | amrit-canada, arts-collective, ifac, innergathering |
| `/article` | 4 | amrit-canada, arts-collective, hidden-enneagram, innergathering |
| `/gallery` | 3 | artdirect, danamccool, ifac |
| `/profile` | 3 | artdirect, arts-collective, elastrocal |
| `/hub` | 3 | amrit-canada, ifac, innergathering |
| `/center` | 3 | amrit-canada, arts-collective, innergathering |
| `/pens` | 2 | arts-collective, elastrocal |

### Most-imported shared components

```
19  RichTextEditor        8  MediaPicker           5  ArticleView
15  BaroqueSignup         7  SurfaceProvider       5  SurfaceFrame
10  ThemeStyle            7  SurfaceCard           4  LiveEditor / CalendarFace /
 6  RichText              6  buildComposeCatalogue    ProfileGallery / QuestionBuilder
```

`RichTextEditor`, `BaroqueSignup` and the surface system are the three
consolidations that genuinely took. They are the model for everything below.

---

## 2. The duplication census

### 2a. The shadcn primitives — the largest single problem

Copy-pasted into app after app. **No shared home is in use.**

| Primitive | Copies | Import sites | Apps |
|---|---:|---:|---|
| `ui/button` | 9 apps + 4 pkgs = **13** | 120 | amrit-canada, art-auction, arts-collective, blog-guru-dharam, elastrocal, hidden-enneagram, ifac, innergathering, pigeonshoot |
| `ui/input` | **11** | 45 | + pkg:chat, pkg:pipeline, pkg:ui |
| `ui/label` | **9** | 41 | + pkg:pipeline |
| `ui/card` | **8** | 29 | + pkg:ui |
| `ui/textarea` | **8** | 33 | + pkg:chat, pkg:pipeline |
| `ui/badge` | 7 | 21 | |
| `ui/dropdown-menu` | 7 | 4 | 257 lines each |
| `ui/dialog` | 7 | 2 | 158 lines each |
| `ui/tabs` | 7 | 8 | |
| `ui/select` | 5 | 9 | 190 lines each |
| `ui/sonner`, `separator`, `switch` | 5–6 | 5–11 | |
| `ui/form`, `popover`, `radio-group`, `sheet`, `tooltip`, `checkbox` | 4 | 2–14 | |

**364 import sites** across the monorepo resolve to a copy-pasted primitive.

Top redundancy by wasted lines: `dropdown-menu` (1,285), `select` (760),
`dialog` (632), `form` (501), `card` (460), `tabs` (455), `sheet` (429),
`button` (384).

**There is already a partial shared home nobody uses.** `packages/ui` contains
shadcn `button.tsx` (55 lines), `card.tsx` (78), `dialog.tsx` (131),
`input.tsx` (23) — all *older, drifted* variants of the 64/92/158/21-line
copies the apps carry. Its other 25 components are Mantine, for the dying
`inner-gathering`. So `@elkdonis/ui` cannot be the destination as it stands:
it is half a dead framework, and its shadcn quarter is stale.

### 2b. The amrit-canada ↔ innergathering pair

**42 byte-identical files, 4,697 lines.** Only three genuinely differ, and all
three are per-org chrome: `site-header` (194 vs 100), `site-footer` (52 vs 140),
`hub/HubSurfaces` (162 vs 139).

Beyond the primitives, the identical set is:

- **Editorial:** `manage/content-form` (488), `manage/member-row` (248),
  `manage/media-field` (213), `manage/content-row-actions` (202),
  `manage/feed-editor` (175), `manage/materials-field` (146),
  `manage/content-composer-body` (122), `manage/questionnaire-composer-body` (120),
  `manage/section-editor` (89), `manage/compose-launcher` (77),
  `manage/compose-workspace` (69)
- **Hub:** `hub/CalendarGrid` (245), `hub/CalendarPageView` (143)
- **Public/thread:** `rsvp-panel` (191), `thread-card` (116),
  `attendee-list` (68), `edit-thread-button` (55), `feed-banner` (53),
  `cycle-badge` (52)
- **Account/auth:** `profile-edit-form` (95), `login-form` (49),
  `sign-out-button` (29), `share-button` (57)

### 2c. The elkdonis-arts-collective ↔ inner-gathering pair

11 identical landing components: `Team` (144), `CurrentWorkQuestion` (128),
`ContactForm` (125), `BoardRow` (120), `FeaturedEventsTable` (101),
`Features` (77), `Hero` (70), `Philosophy` (66), `ArtistDirectoryCTA` (46),
`LandingNetworkChooser` (44), `QuestionOfInquiry` (33) — plus 6 more that have
drifted (`FundraisingGoal` 130 vs 236, `FeaturedGrantProgram` 117 vs 144,
`CitiesVision`, `FeatureInitiative`, `About`, `ImageSpaceBanner`).

**Low priority: both apps are being retired.** Worth mining for block ideas —
`Hero`, `Features`, `Philosophy`, `ContactForm`, `Team` are exactly the
marketing-page vocabulary a block library needs — but not worth deduplicating
in place.

### 2d. Drifted — same name, different code

| Component | Copies | Variants | Verdict |
|---|---:|---:|---|
| `site-header` | 8 | **8** | legitimate — chrome is per-org identity |
| `site-footer` | 6 | 6 | legitimate |
| `login-form` | 8 | **7** | **not** legitimate — auth should be one component |
| `hub/HubSurfaces` | 4 | 4 | wiring, expected to differ |
| `manage/content-form` | 3 | 2 | amrit/inner identical (488), hidden-enneagram forked (429) |
| `manage/content-row-actions` | 3 | 2 | same shape: 202/202/91 |
| `manage/media-field` | 3 | 2 | 213/213/204 |
| `compose-workspace` | 3 | 2 | ifac forked hard (398 vs 69) |
| `GallerySlider`, `JoinSection` | 3 | 3 | three landing variants |
| `gallery-page-view` | 2 | 2 | danamccool (31) vs ifac (83) |

`login-form` at 7 variants across 8 apps is the clearest unforced duplication
in the repo — especially since `BaroqueSignup` (the *signup* half) is already
shared and imported 15 times.

---

## 3. Inventory by category

### Primitives — 19 components, no shared home
`button` `input` `label` `textarea` `card` `badge` `dialog` `dropdown-menu`
`select` `tabs` `checkbox` `switch` `radio-group` `popover` `separator` `sheet`
`tooltip` `form` `sonner`

### Chrome — per-app by design
`site-header` (8) `site-footer` (6) `site-nav` `SiteNav` (3) `site-chrome`
`site-shell` (19 internal uses in arts-collective) `HubDrawer`

The most internally-reused components in the whole repo are chrome:
`arts-collective/site-shell` (19), `hidden-enneagram/site-nav` (10),
`ifac/site-chrome` (10).

### Auth — partly shared
Shared: `BaroqueSignup` (15 uses), `cms-ui/auth` (7 apps).
Duplicated: `login-form` (8 apps, 7 variants), `sign-out-button` (4),
`logout-button` (2), `auth-panel` (2), `signup-form`, `claim-prompt`.

### Public page / marketing — **the block-library target**
`Hero` `HeroBanner` `Features` `Philosophy` `About` `Team` `ContactForm`
`ArtistDirectoryCTA` `FundraisingGoal` `FeaturedGrantProgram` `CitiesVision`
`FeatureInitiative` `ImageSpaceBanner` `QuestionOfInquiry` `CurrentWorkQuestion`
`FeaturedEventsTable` `BoardRow` `GallerySlider` `JoinSection` `StickyBar`
`Reveal` `LandingNetworkChooser` `feed-banner` `hero-banner`

Mostly concentrated in the two dying apps — which is why this vocabulary has
never been shared.

### Threads & feeds
`thread-card` (2, identical) `cycle-badge` (2) `feed-banner` (2)
`attendee-list` (2) `rsvp-panel` (2) `rsvp-form` `edit-thread-button` (2)
`share-button` (3) `meeting-card` (2) `blog-card` `elkdonis-feed`
`workshop-view` `workshop-materials`

### Hub faces & surfaces — **already consolidated, the success case**
In `cms-ui/hub`: `CalendarFace` `GalleryFace` `ComposeFace` `ProfileFace`
`DocumentsFace` `IdeasFace` `PipelineFace` `StandingMeetingFace`
In `cms-ui/surface`: `SurfaceProvider` `SurfaceCard` `SurfaceCardGrid`
`SurfaceFrame` `SurfacePage` `ForumFace`
Still app-local: `hub/HubSurfaces` (4, wiring) `hub/CalendarGrid` (2, identical)
`hub/CalendarPageView` (2, identical) `hub/EmailFace` `hub/AppearanceCard`
`hub/FilesCard` `hub/PageSectionsCard` `hub/RsvpPanel` `hub/wide-surfaces`

`CalendarGrid` (245 lines) and `CalendarPageView` (143) are identical in two
apps and belong in `cms-ui/hub` beside the faces that already moved.

### Editorial / manage — duplicated wholesale
`content-form` (3) `content-composer-body` (2) `questionnaire-composer-body` (2)
`content-row-actions` (3) `media-field` (3) `materials-field` (2)
`feed-editor` (2) `member-row` (2) `section-editor` (3) `compose-launcher` (2)
`compose-workspace` (3) `profile-edit-form` (2) `directory-manager`
`admin-dashboard`

**1,850+ redundant lines**, the second-largest cluster after primitives.
Partly superseded by `cms-ui/compose` (4 apps) — so the direction exists, the
migration just hasn't finished.

### Commerce
`artwork-gallery` `favorite-button` `message-artist-button` `message-composer`
`present-buttons` `store-section-toggle` `confirm-order-button`
plus `packages/commerce` (8 files), `checkout` (4), `payments`

### Media & galleries
Shared: `MediaPicker` (8 uses) `ProfileGallery` (4) `cms-ui/gallery` (3 apps)
`image-lightbox` `simple-lightbox` `media-player` `video-playlist`
`document-viewer` `file-browser` (all in `packages/ui`)
App-local: `gallery-editor` `gallery-panel` `galleries-section`
`gallery-page-view` (2) `image-upload-field` `multi-image-uploader`

### Domain-specific — legitimately unique (262 components)
`EnneagramDiagram` + triads (hidden-enneagram) · `pigeon-card` `map-panel`
(pigeonshoot) · `chart-form` `orbit-dial` `chart-wheel` `sky-*` (elastrocal,
`sky-ui`) · `DossierForm` (artdirect) · `kundalini-panel` (amrit-canada) ·
`WikiPageForm` `WikiBreadcrumbs` (arts-collective) · `three/` experiences

These are the honest majority. **84% of distinct component paths exist in
exactly one app**, and most of that is real domain code, not duplication.

---

## 4. Priority order for extraction

Ranked by redundant lines removed per unit of risk:

| # | Target | Lines recovered | Risk | Note |
|---|---|---:|---|---|
| 1 | **shadcn primitives** → a new `@elkdonis/primitives` | ~6,000 | low | pure copies; 364 import sites but mechanical. **Not** into `@elkdonis/ui` — that's half Mantine with a stale shadcn quarter |
| 2 | **`manage/*` editorial set** → `cms-ui/compose` | ~1,850 | medium | `cms-ui/compose` already serves 4 apps; finish the migration |
| 3 | **`CalendarGrid` + `CalendarPageView`** → `cms-ui/hub` | ~390 | low | identical; the faces beside them already moved |
| 4 | **thread/feed set** (`thread-card`, `rsvp-panel`, `attendee-list`, `cycle-badge`, `feed-banner`, `share-button`) → `@elkdonis/blocks` | ~540 | low | **started** — 4 blocks harvested 2026-09-14 |
| 5 | **`login-form`** → `cms-ui/auth` | ~430 | medium | 7 variants need reconciling; `BaroqueSignup` is the precedent |
| 6 | landing components from the two dying apps | ~1,000 | low value | mine for block *ideas*, don't dedupe in place |

Leave alone: `site-header` / `site-footer` / `site-nav` / `site-shell`. Eight
different headers across eight orgs is the product working correctly.

---

## 5. Caveats

- Counts cover `.tsx` only. `.ts` helpers (`lib/format.ts` is identical in
  amrit-canada and innergathering at 163 lines; `lib/auth.ts` 96;
  `lib/pipeline.ts` 145; `lib/color.ts` 41) add several hundred more
  redundant lines not tallied above.
- `apps/inner-gathering` and `apps/elkdonis-arts-collective` are being retired;
  their 96 component files inflate every total. Excluding them, app components
  drop from 454 to ~358 and redundant lines from 10,816 to roughly 9,700.
- "Drifted" does not always mean "wrong" — for chrome it means working as
  intended. The table in §2d marks which is which.
