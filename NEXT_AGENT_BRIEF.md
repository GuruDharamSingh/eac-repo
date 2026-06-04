# Next-Agent Brief — EAC ⇒ Inner-Gathering Merge + Nextcloud Media Pipeline

> Execution brief. You are picking up two pieces of work in the Elkdonis monorepo.
> **Repo root: `/mnt/pool1/home/guru/eac`** — every path in this document is given
> absolute from that root so there is no ambiguity about what to open.
> Read this whole document first, then use a
> TodoWrite list to track the parts. Do **Part B (Nextcloud media)** first if you
> want a quick win on production — it is independent of the merge — but both can be
> done in one branch. Do not commit or push unless the user asks. Branch off `main`
> before changing anything; there is uncommitted WIP in the tree, so confirm with
> the user whether to stash/commit it first so the diff stays readable.

---

## 0. Orientation

Two Next.js 16 apps in `/mnt/pool1/home/guru/eac/apps/` are being combined into **one**:

| App | Port | org_id | Role |
|---|---|---|---|
| `inner-gathering` (IG) | 3004 | `inner_group` | **HOST.** Authenticated web-portal: feed, forum, calendar, polls, workshops, meetings, profiles. Has full auth + Nextcloud + notifications + the larger dependency set. |
| `elkdonis-arts-collective` (EAC) | 3005 | EAC `site_config` org (marketing) | Public marketing one-pager + a few content routes. Dark theme, `Venture` font. |

**Decision (locked by the user):** IG hosts. EAC's public landing becomes the public
root `/`; the existing IG app moves behind the login wall. Both apps already share
`@elkdonis/ui`'s `EacAtmosphere` + `eac-theme.css`, so there is common visual ground.
The user wants **visual continuity** between the marketing surface and the portal.

Shared auth is already identical in both apps: every `app/api/auth/*` route is just
`export { handleLogin as POST }` (etc.) from `@elkdonis/auth-server`. The EAC
`featured-events` API already reads IG's `org_id = 'inner_group'` threads. So these
two apps are already coupled by data; this is mostly a structural/routing merge.

---

## Part A — Merge EAC landing into Inner-Gathering

### A.1 Locked decisions (do exactly these)

1. **IG is the host app.** Everything lands in `/mnt/pool1/home/guru/eac/apps/inner-gathering`. `/mnt/pool1/home/guru/eac/apps/elkdonis-arts-collective` is deleted at the end (Part A.7).
2. **Public landing at `/`.** The EAC landing page (`/mnt/pool1/home/guru/eac/apps/elkdonis-arts-collective/src/app/page.tsx`) becomes IG's `/`. IG's current `/` (which just redirects to `/feed` or `/login`) is replaced.
3. **Use App Router route groups for the two visual identities** so we keep both themes without picking one:
   - `(marketing)` group → dark theme + `Venture` font + EAC `SiteNav` (its own `MantineProvider`).
   - `(app)` group → IG's existing light theme (Crimson/Cinzel + Basteleur) + `LayoutWrapper`/`TopNav`.
   - Root `app/layout.tsx` keeps only `<html>/<body>` + `EacAtmosphere`; **move the `MantineProvider` down into each group layout** (currently it lives in IG's root layout — see `/mnt/pool1/home/guru/eac/apps/inner-gathering/src/app/layout.tsx`).
4. **EAC `/workshops` collides with IG's real `/workshops/[id]` + `/workshops/create`.** Subjugate the EAC marketing page to IG by renaming it with an `EAC` suffix → route **`/workshops-eac`** (folder `app/(marketing)/workshops-eac/`). Update its metadata/links accordingly.
5. **EAC landing top-nav** (`SiteNav`) becomes exactly **two items**:
   - **"More About"** → `/about` (EAC's about page, carried over; the user says `/about` will be rewritten soon, so just wire it, don't polish content).
   - **"Web-Portal"** → behavior in A.4 below.
   The current EAC `SiteNav` "Meetings" external link (`https://meetings.elkdonis-arts.org`) is removed; its intent is folded into "Web-Portal" → `/feed`.
6. **EAC landing's "Meetings" CTA button** (on the page body, distinct from the nav — appears via `JoinSection`/hero CTAs and `StickyJoinBar`) → point at **`/feed`** (internal), same redirect-to-login behavior as Web-Portal.
7. **`/manifesto` and `/about`** are carried over but **low priority** and not currently linked prominently (only "More About" → `/about`). Keep `/manifesto` reachable by URL. EAC's `/manifest` is already just a redirect to `/manifesto` — keep it.

### A.2 Target structure

```
apps/inner-gathering/src/app/
  layout.tsx                  ← shared <html>/<body> + EacAtmosphere ONLY (no MantineProvider, no LayoutWrapper)
  (marketing)/
    layout.tsx                ← dark MantineProvider + Venture font + marketing SiteNav; wraps children in <div class="marketing-root"> for CSS scoping
    page.tsx                  ← EAC landing (was EAC /)
    about/page.tsx            ← EAC about (+ about.module.css)
    manifesto/page.tsx        ← EAC manifesto (+ manifesto.module.css)
    manifest/page.tsx         ← redirect → /manifesto
    workshops-eac/page.tsx    ← EAC workshops marketing (renamed from /workshops; + workshops.module.css)
  (app)/
    layout.tsx                ← IG light MantineProvider + Notifications + LayoutWrapper (TopNav + WelcomePopup)
    feed/ forum/ calendar/ polls/ workshops/ meetings/ live/ files/ profile/ account/ login/ home/ email-templates/ …  ← MOVE existing IG routes here UNCHANGED
```

> Route groups `(marketing)`/`(app)` do not affect URLs — `(app)/feed` still serves `/feed`. Moving the existing IG route folders into `(app)/` is a pure relocation; their internal imports use `@/` aliases so they keep working. Verify `tsconfig.json` path aliases still resolve.

### A.3 Bring EAC code across

- **Components:** copy `/mnt/pool1/home/guru/eac/apps/elkdonis-arts-collective/src/components/*` → `/mnt/pool1/home/guru/eac/apps/inner-gathering/src/components/marketing/`. Namespacing under `marketing/` avoids clashes (EAC has generic names like `About`, `Footer`, `Features`). Update imports in the moved pages.
- **CSS:** EAC's `globals.css` is **2,835 lines** with global class names (`landing-hero`, `gold-rule`, `landing-title`, etc.); IG's `globals.css` is 1,376 lines. **Do not blindly concatenate.** Append EAC's global rules under a scoping wrapper so they cannot bleed into the app surface: wrap the marketing layout's children in `<div className="marketing-root">` and prefix the migrated EAC global selectors (e.g. via a nested block or a build step). The EAC content pages (`about`, `manifesto`, `workshops`) already use **CSS Modules** (`*.module.css`) which are scoped — move those as-is, zero collision risk. The only globals you must scope are the ones the **landing `page.tsx`** uses.
- **Fonts + assets:** move `/mnt/pool1/home/guru/eac/apps/elkdonis-arts-collective/public/fonts/*` (`Venture-nRqOR.otf`, `RELIGATH-Demo.otf`) and the landing images into `/mnt/pool1/home/guru/eac/apps/inner-gathering/public/`. Re-point the `localFont` import in the marketing layout.
- **API routes:** move these EAC routes into IG `app/api/`:
  - `featured-events/` (already reads `inner_group` — keep as is)
  - `contact/`, `inquiries/` (write to `contacts` / `landing_inquiries` tables via shared `@elkdonis/db` — no schema change)
  - `admin/site-config/`, `admin/media-gallery/`, `admin/featured-events/options/`
  - `media/file/` (query-param Nextcloud proxy — **different route shape** from IG's `/api/media/[...path]`, so they coexist; but see Part B — consider consolidating later)
  - **Drop** EAC's `api/auth/*` (identical duplicates of IG's).
  - EAC `/admin` page → bring in as IG `app/(app)/admin/page.tsx` (it already gates on `is_admin`). IG currently has no `/admin` route, so no collision.

### A.4 "Web-Portal" nav behavior (the nuanced bit)

The user's spec: *Web-Portal → if logged in, go to `/feed`. If not logged in, still head to the portal but show a popup explaining the site, with a login/signup button that opens the shared **`BaroqueSignup`** component.*

`BaroqueSignup` is exported from `@elkdonis/ui` (`export { BaroqueSignup }` in `/mnt/pool1/home/guru/eac/packages/ui/src/index.ts`) and is already used on both the EAC landing and IG `/login`. It is Mantine-free, self-contained (handles signup/signin against the auth endpoints), and takes props incl. `initialMode` (`'signup' | 'signin'`), `showToggle`, and `onSuccess(result)`.

**Recommended implementation** (client component in the marketing `SiteNav`):
1. "Web-Portal" is a button, not a plain link.
2. On click, resolve session client-side (fetch `/api/auth/session`).
3. If `session.user` → `router.push('/feed')`.
4. If no session → open a **Modal** (reuse the pattern in `/mnt/pool1/home/guru/eac/apps/inner-gathering/src/components/welcome-popup.tsx`) with a short explanation of what the portal is, and a primary button "Log in / Sign up" that swaps the modal body to `<BaroqueSignup initialMode="signup" onSuccess={() => router.push('/feed?welcome=1')} />`.
5. On successful auth, route to `/feed?welcome=1` — IG's existing `WelcomePopup` already triggers on that query param, giving the new user the onboarding tour.

> Note the user's literal phrasing was "still redirect to /feed but give popup." The modal-on-click approach above is the clean equivalent (it avoids bouncing an unauthenticated user to `/login` with no context). If the user prefers a true navigation to `/feed` first, the alternative is to let `/feed` (unauthenticated) render the explanatory popup + `BaroqueSignup` instead of redirecting to `/login` — but that changes the app-side auth gate, so prefer the modal approach unless told otherwise.

### A.5 Dependencies & config

- Merge EAC-only deps into `/mnt/pool1/home/guru/eac/apps/inner-gathering/package.json`: `three`, `@types/three`, `radix-ui`, `@tabler/icons-react`, `class-variance-authority`, `tw-animate-css`. (IG already has the rest as a superset.)
- Merge `next.config.ts` `transpilePackages` to the **union** of both lists (IG: `@elkdonis/db, @elkdonis/email, @elkdonis/types, @elkdonis/ui`; EAC adds nothing new but verify). Keep IG's `output: 'standalone'` production block.
- `pnpm install`, then rebuild shared packages: `pnpm --filter @elkdonis/db build && pnpm --filter @elkdonis/ui build`.
- `pnpm check-types` and `pnpm --filter inner-gathering build` must pass.

### A.6 Verify (Part A)

Run IG on 3004 and click through: `/` landing renders dark/Venture; "More About" → `/about`; "Web-Portal" logged-out → explanatory modal → BaroqueSignup → `/feed?welcome=1`; logged-in → straight to `/feed`; `/workshops-eac` renders the marketing page; `/feed`, `/forum`, `/calendar` render the light-themed app with `TopNav`. Confirm no CSS bleed between marketing and app surfaces.

### A.7 Retire EAC

Only after verification: delete `/mnt/pool1/home/guru/eac/apps/elkdonis-arts-collective`, remove its service from `docker-compose.yml` (the 3005 entry), and update deployment/domain config so the EAC domain points at the merged IG app. Flag the domain/DNS change to the user — do not assume infra access.

---

## Part B — Nextcloud media upload alignment + production test (the sidequest)

**Goal:** make image/file upload **and display** solid for IG posts/meetings against the
**production** Nextcloud instance. The team just wired a Nextcloud app account named
**`eac_integration`** into `.env`.

### B.1 How the pipeline works today (already implemented, verify don't rewrite)

**Single source of truth for credentials:** `NEXTCLOUD_URL`, `NEXTCLOUD_ADMIN_USER`,
`NEXTCLOUD_ADMIN_PASSWORD` in root `.env`. The `eac_intergration` app account's
username/password are stored in `NEXTCLOUD_ADMIN_USER` / `NEXTCLOUD_ADMIN_PASSWORD`
(confirm with the user — the `.env` comment says *"eac_intergration (verified 207 via
PROPFIND); EAC_APP is not the owner"*). **That "not the owner" note is the crux of the
likely bug — see B.3.**

**Write path** — `/mnt/pool1/home/guru/eac/apps/inner-gathering/src/app/api/upload/route.ts` (used by posts/meetings media upload):
1. `getUploadPath(orgId, mediaType, filename, visibility)` from `@elkdonis/services` →
   `EAC-Network/inner_group/Media/Images/<timestamp>-<name>` (or `.../Private/Media/...` for non-public).
2. `uploadFile(path, buffer, mime)` → HTTP `PUT` to
   `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_ADMIN_USER}/<path>` with
   `Authorization: Basic base64(USER:PASS)`.
3. Inserts a row into the `media` table (`nextcloud_path`, `url`, `type`, …) where
   `url = getProxyFileUrl(path)` = **`/api/media/<path>`**.

**Read/display path** — `/mnt/pool1/home/guru/eac/apps/inner-gathering/src/app/api/media/[...path]/route.ts`:
- `GET /api/media/EAC-Network/inner_group/Media/Images/...` → fetches from
  `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_ADMIN_USER}/<path>` with the same
  Basic auth and streams it back (supports Range for audio/video). Public media needs no
  session; `/Private/` paths require an EAC session.

**So both upload and serve use the SAME Nextcloud user (`NEXTCLOUD_ADMIN_USER` =
`eac_integration`) and the SAME folder tree (`EAC-Network/inner_group/Media/...`).** The
design is internally consistent. Source of the upload/serve logic:
`/mnt/pool1/home/guru/eac/packages/services/src/nextcloud.ts` (`getUploadPath`, `getFileUrl`, `getProxyFileUrl`,
`uploadFile`, and `ensureOrgFolders`/folder-creation around lines 100–135).

**Second, parallel write path** (the inconsistency to reconcile): the **Library** tab of
the shared `MediaUpload` uses `/mnt/pool1/home/guru/eac/apps/inner-gathering/src/app/api/nextcloud/upload/route.ts`
and `.../nextcloud/files/route.ts`, which go through `getAdminClient()` from
`@elkdonis/nextcloud` (a `webdav` client) instead of the `@elkdonis/services` fetch path.
Same user, same `EAC-Network/inner_group` root, but a **different implementation** and it
does **not** write a `media` table row or return a proxy URL. Decide with the user whether
to unify on one path; at minimum make both use the same root + credentials (they currently do).

### B.2 Diagnostic steps (do these first — don't change code blind)

1. Confirm env: `NEXTCLOUD_URL`, `NEXTCLOUD_ADMIN_USER` (= `eac_integration`?),
   `NEXTCLOUD_ADMIN_PASSWORD`, `NEXTCLOUD_PUBLIC_URL` are set for the **running** IG
   container/process (not just root `.env` — check how IG receives env in `docker-compose.yml`).
2. PROPFIND the integration user's root (expect `207 Multi-Status`):
   ```bash
   curl -s -u "$NEXTCLOUD_ADMIN_USER:$NEXTCLOUD_ADMIN_PASSWORD" \
     -X PROPFIND "$NEXTCLOUD_URL/remote.php/dav/files/$NEXTCLOUD_ADMIN_USER/" -H "Depth: 1" -i | head -40
   ```
3. PROPFIND the target folder — does `EAC-Network/inner_group/Media/Images` exist **in
   `eac_integration`'s namespace**?
   ```bash
   curl -s -u "$NEXTCLOUD_ADMIN_USER:$NEXTCLOUD_ADMIN_PASSWORD" \
     -X PROPFIND "$NEXTCLOUD_URL/remote.php/dav/files/$NEXTCLOUD_ADMIN_USER/EAC-Network/inner_group/Media/Images/" -H "Depth: 0" -i | head
   ```
4. **Write test** — the real check (this is what `uploadFile` does):
   ```bash
   curl -s -u "$NEXTCLOUD_ADMIN_USER:$NEXTCLOUD_ADMIN_PASSWORD" \
     -X PUT --data-binary @/path/to/test.jpg -H "Content-Type: image/jpeg" \
     "$NEXTCLOUD_URL/remote.php/dav/files/$NEXTCLOUD_ADMIN_USER/EAC-Network/inner_group/Media/Images/diag-test.jpg" -i | head
   ```
   - `201 Created` / `204 No Content` → write works.
   - `409 Conflict` → parent folder missing (run folder creation, B.4 step 1).
   - `403 Forbidden` → permission problem: `eac_integration` is "not the owner" and the
     `EAC-Network` folder isn't writably shared into it (B.3).
5. **Read-back test** through the proxy: `curl -i "$IG_URL/api/media/EAC-Network/inner_group/Media/Images/diag-test.jpg"` — expect `200` with `content-type: image/jpeg`.

### B.3 The likely root-cause (the ".env says EAC_APP is not the owner")

`remote.php/dav/files/<user>/` only exposes files **in that user's home + folders shared
into it**. If `EAC-Network` is owned by a different Nextcloud user (e.g. `elkdonis`/admin)
and merely *shared* with `eac_integration`, then:
- It must be shared **with write permission** for PUT to work, and
- It appears under `eac_integration`'s home **at the share's mount name** (which may differ
  from `EAC-Network` — Nextcloud mounts a share at the recipient-chosen folder name). If
  the mount name ≠ `EAC-Network/inner_group/...`, every path in the code is wrong for this user.

**Resolution options (decide with the user):**
- **(a) Make `eac_integration` the owner** of `EAC-Network` (or create the tree directly in
  its home). Cleanest: the code's paths then "just work."
- **(b) Keep shared, ensure write perms + matching mount name.** Confirm the share lands at
  exactly `EAC-Network/inner_group/...` in `eac_integration`'s namespace, or adjust the code's
  base path to the actual mount.
- Whichever: the **same user** must own/serve, because the read proxy uses the same
  `NEXTCLOUD_ADMIN_USER`. Do not split upload-as-userA / serve-as-userB.

### B.4 Fix + harden

1. Ensure the org folder tree exists for `inner_group` (idempotent `MKCOL` via WebDAV, or
   run the existing folder-creation routine in `/mnt/pool1/home/guru/eac/packages/services/src/nextcloud.ts` ~line 100–135).
   It creates `EAC-Network/inner_group/Media/{Images,Audio,Videos,Documents}` and the
   `Private/Media/...` mirror.
2. Improve the failure surface: `uploadFile` currently logs and returns `false` on non-2xx;
   `/api/upload` then returns a generic 500. While debugging, surface the Nextcloud status +
   body to the server logs (already partially logged) and confirm you can see them in the IG
   container logs.
3. Reconcile the two upload code paths (B.1) per the user's preference — ideally route the
   Library/`/api/nextcloud/upload` flow through the same `@elkdonis/services` helpers so
   every upload also gets a `media` row + proxy URL, OR document why they stay separate.
4. Confirm `getProxyFileUrl` returns a **relative** `/api/media/...` URL (it does) so it works
   regardless of domain — important post-merge when everything is one origin.

### B.5 End-to-end verification (the actual acceptance test)

Use the `verify`/`run` skill or drive the running app:
1. Log into IG, create a **post** with an image attached → upload returns 200, a `media` row
   is written, and the image **renders** on the post card and detail view (served via
   `/api/media/...`).
2. Create a **meeting** with a cover image + an image attachment → same: uploads, displays on
   the meeting card and event page, and the lightbox opens (per existing `ImageLightbox`).
3. Attach a **PDF/document** → uploads to `Media/Documents`, downloads/opens via the proxy.
4. Test a **Private** (non-PUBLIC visibility) image → confirm it lands under `Private/Media`
   and the proxy requires a session (`401` when logged out, `200` when logged in).
5. Confirm in the Nextcloud web UI that the files actually appear under
   `EAC-Network/inner_group/Media/...` for the `eac_integration` account.

---

## Constraints & gotchas

- **Don't commit/push unless asked.** Branch first; there is uncommitted WIP in the tree.
- Shared packages must be **built** before apps run: `@elkdonis/db`, `@elkdonis/ui`,
  `@elkdonis/services`. After editing any package, rebuild it.
- This is **production** Nextcloud in Part B — diagnostic reads (`PROPFIND`, `GET`) are safe;
  the `PUT` write test creates a real file (`diag-test.jpg`) — delete it when done, and
  confirm with the user before writing to production storage.
- Keep `org_id = 'inner_group'` everywhere in IG (it's hard-wired in `lib/data.ts`,
  `lib/forum.ts`, `/api/upload`, and the EAC `featured-events` route). The EAC `site_config`
  rows use a different org key — don't conflate them.
- Theme isolation depends on each route group owning its own `MantineProvider`. Verify dark
  marketing styles don't leak into the light app and vice-versa after the move.

## Definition of done

- [ ] IG runs on 3004 serving the EAC landing at `/` (dark/Venture), app behind login (light theme).
- [ ] "More About" → `/about`; "Web-Portal" → `/feed` (logged in) or explanatory modal +
      `BaroqueSignup` → `/feed?welcome=1` (logged out); body "Meetings" CTA → `/feed`.
- [ ] `/workshops-eac` marketing page works; IG `/workshops/*` app routes unaffected.
- [ ] `pnpm check-types` + IG build pass; no CSS bleed between surfaces.
- [ ] `/mnt/pool1/home/guru/eac/apps/elkdonis-arts-collective` deleted + docker-compose 3005 service removed (domain change flagged to user).
- [ ] Image upload + display verified end-to-end for posts AND meetings against production Nextcloud (`eac_integration`), public and private visibility.
- [ ] The two upload code paths reconciled or their divergence documented.
</content>
</invoke>
