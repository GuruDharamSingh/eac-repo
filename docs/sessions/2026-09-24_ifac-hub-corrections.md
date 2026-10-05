# 2026-09-24 — IFAC hub corrections (session "IFAC code corrections")

Five developer-requested changes to the IFAC hub page layout and roster
onboarding. All uncommitted; live in the ifac build of 2026-09-24 17:57
(backup of the previous build: `~/eac-backups/next/ifac-20260924-1756.tgz`).

## Changes
- `packages/cms-ui/src/center/ProfileFlipCard.tsx` + `center.css`: optional
  `frontAction` prop — a large button on the card's front plate. When set,
  hover no longer turns the card (the ✎ still does). Other callers unchanged.
- `apps/ifac/src/app/hub/site-view.tsx`: `frontAction` "See profile" (opens the
  profile popup); "Open Nextcloud" band (`.ifac-hs-cloud`, CSS at the end of
  `hub-site.css`) under the meeting banner, linking to Nextcloud's sociallogin
  entry `/apps/sociallogin/custom_oauth2/elkdonis` (read from the NC login page's
  `alternativeLogins` state).
- `apps/ifac/src/lib/cms/payout-actions.ts`: popup "Where you show" lists
  `POPUP_SECTIONS` = Writing, Store. "Blog feed" (`elkdonisFeed`) remains in
  `KNOWN_SECTIONS`, so existing settings (1 user) and the card hub still work.
- `apps/ifac/src/app/api/center/profile/route.ts`: popup "Your page" is
  `/artists/<slug>` or `/dealers/<slug>` via `getDirectoryProfile`; null when
  there is no published IFAC roster row. Was ArtDirect.
- Roster → Nextcloud: `apps/ifac/src/lib/directory-admin.ts` `assignProfile`
  now, after `adminAssignProfile` succeeds, sets the target account's ifac role
  to `member` when it is null or `viewer` (never lowers guide/owner) and calls
  the new `queueNextcloudSync` (`requestNextcloudSync`, reason `roster-assign`).
  `apps/ifac/src/lib/manage.ts` `setMemberRole` queues a sync (`role-change`).
  `api/manage/directory/route.ts` passes the actor id.

## For the planned mergeProfile/approveClaim fix
The assign change does not alter merge direction or what `mergeProfile`
carries. It runs after the merge and acts on `memberId` (the surviving
account by design). If a merge ever deletes `memberId` instead, the
`setOrgRole` insert fails its FK and the route returns an error after the merge
has already happened.

## Verified
- Signed-in render of `/hub` (session minted for the developer's account),
  screenshots: See profile opens the popup; "Where you show" lists Writing and
  Store; "Your page" → `/artists/jg`; Nextcloud band present. No page errors.
- After the 17:57 rebuild, through the edge: `/hub` carries both new elements;
  `/manage/people` and `/manage/directory` return 200 with no error markup.
- `check-types` passes for ifac and `@elkdonis/cms-ui`.

## Not verified
- The assign → member → sync path was not exercised (it writes live data).
- The Nextcloud link for someone with no elkdonis-arts.org session: expected to
  ask for sign-in there once (**assumed** from `api/oidc/authorize`).
- Eric Brummel (owner) has no linked Nextcloud account; he gets one on first
  use of the banner.
