# Sophia on org websites — design note (2026-10-16, parked)

Goal: an org owner can switch on their courses on their own website, styled like that site, not only on
Sophia. Nothing is built yet. This note records the investigation so the work can resume.

## What already exists

- **The package is host-agnostic.** `@elkdonis/lms-ui` takes everything host-specific through
  `LmsConnectors` (hrefs, origin, viewer, mediaUrl, actionBase) — the same shape as `@elkdonis/forum-ui`,
  which five org sites already mount (sunjay, ifac, innergathering, amrit-canada, hidden-enneagram) with
  `src/lib/forum.ts`, `app/forum/[[...segments]]/page.tsx`, `app/api/forum/[action]/route.ts` and a CSS import.
- **Catalogue by org.** `listCatalogue({ orgId })` already filters.
- **Media.** Stored as `/api/media/<path>`; every org site already serves that with services' `serveMedia`.
- **Sign-in and progress.** Each site signs in through the network handoff. One enrolment per person per
  run, so progress follows a learner between Sophia and an org site.
- **Theming.** Every host imports `@elkdonis/cms-ui/surface.css` and sets `--eac-surface-*` → `--sf-*`.
  `site_themes` (migration 090) holds per-org/per-page overrides; subdomain sites inject them with
  `ThemeStyle` from `@elkdonis/live-editor/theme`. forum-ui reads `--sf-*` with `--forum-*` overrides
  (see `packages/forum-ui/src/forum-theme.css` for the scoping technique).

## What to build

1. **Stylesheet follows the host.** `lms.css` hardcodes the newsroom palette on `.so-root`. Make each
   `--so-*` resolve `var(--lms-X, var(--sf-Y, <newsroom default>))`, scoped like forum-theme.css. Sophia sets
   its newsroom values explicitly so it looks unchanged. Fonts likewise.
2. **One mountable route.** `renderLmsRoute({ connectors, segments, searchParams })` in lms-ui, like
   `renderForumRoute`: org course list, course, step, journal (scoped to the org's courses), guide's
   "to answer". Hub pages (Inner/Outer, guides, traditions, schedule) stay Sophia-only.
3. **Owner switch.** `site_config(org_id, 'lms')` `{ enabled, label }`, following the `center_layout`
   precedent (packages/services/src/center-layout.ts). Off ⇒ routes 404 and the nav link hides.
4. **One canonical home per course.** `getCourseHome(course)`: the owning org's site if its switch is on
   (primary `org_domains` row or `<org>.<network>`), else Sophia. Sophia's copy sets `rel=canonical` there;
   `notifyAcknowledged` links and sitemaps follow it.

## Hosts

- **Subdomain sites** (arts-collective `sites/[slug]`): one route serves every subdomain org.
- **Own-domain apps** (sunjay, ifac, innergathering, amrit-canada, hidden-enneagram, danamccool): the same
  three small files the forum uses, plus a nav link that reads the switch.

## Recommendations / open decisions

- Studio stays on Sophia only; org sites link "Edit in Sophia".
- Org sites list their own org's courses only, at first.
- Pilot on Jason's sunjay site (paratheater.arts-collective.com).
- **A course's org decides which site it can appear on, and there is no way to move a course between
  orgs yet** — courses meant for an org's site must be created under that org.

## Order

1. Tokens + mountable route + course-home helper (packages; Sophia unchanged). 2. Owner switch.
3. Pilot on sunjay. 4. Subdomain sites, then the other own-domain apps.

## 2026-10-30: item 2 built

`renderLmsRoute({ c, segments, searchParams, autoEnrol })` and `lmsRouteMetadata` exist in
`packages/lms-ui/src/route.tsx` and arts-collective mounts them at `/learn` (catalogue, course, step,
journal, care). Tokens (item 1), the owner switch (3) and the canonical home (4) are still open; the
network host imports `lms.css` as it is and wraps the pages in `.so-root`. Task steps and their host
connector: `docs/open/ONBOARDING_COURSE_BRIEF_2026-10-29.md`. (claude)
