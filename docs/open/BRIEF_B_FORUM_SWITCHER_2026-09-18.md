# Brief B — Org `/forum`: scope switcher (layout follows scope)

Sprint board: `SPRINT_2026-09-18_onboarding.md`. You own `packages/forum-ui/**`,
`apps/forum/**`, `apps/*/src/app/forum/**`. Read memory *The Grand Forum* and
`GRAND_FORUM_PLAN.md` first.

## The ask (user's words, 2026-09-18)
The `/forum` page on each org site gets an embedded forum with a **switcher**:
- **Scope:** *This org* (default) ↔ *The collective* (network-wide).
- **View:** org scope shows **cards**; collective scope shows **classic** (the
  category/stream table). *(Originally "either can be switched" — superseded by the
  DECIDED block below: the view follows the scope.)*

## What exists
- Org sites already mount the forum **in-process**: `apps/<org>/src/app/forum/[[...segments]]/page.tsx`
  → `renderForumRoute({ connectors, segments, searchParams })`. It's org-scoped, uses
  the site's session, and is styled via custom properties in the host's `globals.css`.
  No JS in the package.
- `apps/forum` (forum.arts-collective.com, live) has `/embed` and `/embed/o/[org]`
  iframe routes with `frame-ancestors` + a `grand-forum:height` postMessage beacon.
- Skins (`forum-modern.css`) were **retired 2026-09-17** — one steel/silver design.

## Recommendation (PM) — confirm with the user before building
**Don't use the iframe on org sites.** Cross-site frames are anonymous (the cookie
never crosses), so an artist signed in on ifac would see the forum signed-out and
couldn't post. Instead extend the in-process mount:
- Add `scope: 'org' | 'collective'` to `renderForumRoute`, driven by searchParams
  (`?scope=collective`) so it stays JS-free and linkable. The layout is derived from it
  (org → cards, collective → classic). A small two-option control at the top of the
  shell writes the param. Keep the layout choice an internal value so a `view` param
  can be added later without a rewrite.
- "Cards" is a **layout** (topic cards: title, excerpt, author avatar, reply count,
  last activity, cover image if any) — not a colour skin. Same tokens, same design.
- Network scope on an org site: reading is fine; the "New topic" target select must
  still only offer boards the viewer can post to.
- Keep the iframe embed for *third-party* sites only.

**DECIDED (user, 2026-09-18):** ONE toggle — scope only (`?scope=org|collective`,
default org). The layout FOLLOWS the scope: org → cards, collective → classic. No
separate view switch (can be added later if asked for). Cards = a new tile layout
inside the current steel design, NOT the retired `forum-modern` skin.

## Watch out
- Forum queries select `kind` but don't filter it — keep `OFF_FEED_KINDS`
  (`wiki_page`, `writing`) out of both scopes (memory: *threads is a shared namespace*).
- The forum's own-author and admin clauses bypass `visibility`; network scope must not
  surface another org's INVITE_ONLY topics to a non-member.
- IFAC is dark; innergathering/amrit are light — check cards on all three, measure contrast.
- IFAC/amrit-canada are prod builds: rebuild (back up `.next`) to see it live.

## Done when
- Org `/forum` on IFAC, amrit-canada, innergathering renders both scopes (org = cards, collective = classic),
  signed-in and signed-out, phone + desktop screenshots.
- A leak probe: an org-INVITE_ONLY topic doesn't appear in network scope for a non-member.
- Log line on the sprint board.
