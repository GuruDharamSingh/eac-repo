# Brief E — Hub first-steps checklist ("the tour")

Sprint board: `SPRINT_2026-09-18_onboarding.md`. Split out of Brief C phase 4 so it
can run alongside C. **You own:** a new `packages/cms-ui/src/hub/FirstStepsFace.tsx`
(+ its CSS in `hub.css` or its own file), a new `packages/services/src/first-steps.ts`,
one migration if needed, and the few lines that mount it in `apps/ifac/src/app/hub/page.tsx`
and `apps/innergathering/src/app/hub/page.tsx`. **Don't touch:** C's auth/claim/manage/
Nextcloud work, `app/center` (A), `app/forum` (B).

## What it is
The first thing a newly promoted member sees on `/hub`: one card at the top, a short
checklist that **ticks itself off from real data** as they do each thing. Not a modal
tour that walks the page — a checklist that stays until done or dismissed.

**Voice (user's call):** one line of why — *this is about artist sovereignty; it's open
source and not-for-profit; your work and your files stay yours* — then just the steps.
No platform jargon ("threads", "org", "surface", "instance").

## The steps (in this order)
| # | Step | Done when (derive it — don't ask them to tick) | The button opens |
|---|---|---|---|
| 1 | **Join the weekly meeting** — add your video link or use the Talk room | viewer is host on any occurrence (`meeting_hosts`) or authored a meeting thread in this org — PM suggests; pick what's reliable and say which | the `StandingMeetingFace` / Plan-ahead surface already on the hub |
| 2 | **Start your blog** | `users.profile_sections->>'blog'` is on | the Page sections face / profile popup |
| 3 | **Open your store & list a piece** | a `store` row with `owner_user_id = viewer` (step half-done) + ≥1 artwork (done) | art-auction studio (market.arts-collective.com/studio). Copy: "list your work" — never "sell", Stripe isn't live |
| 4 | **Your cloud** — team folder, your own folder, calendar | `users.nextcloud_user_id` is set | the Nextcloud sign-in; copy says folders appear **within about 10 minutes** (C's cron). If not linked, explain in one line what it is: "cloud storage you can use from these sites or in Nextcloud directly" |
| 5 | **Go deeper at /center** | manual tick on click (the only non-derived step) | `/center` — your profile across the network, your store, your directory listing; you on the platform stands behind you in IFAC |

Innergathering is not an art org: make steps a **list the host passes in** (ids + copy
+ href), with the derivations in the service keyed by id. IFAC passes all five;
innergathering probably drops "store" — ask the user.

## Who sees it
- `member`, `guide`, `owner` only. A `viewer` sees instead a one-line note:
  "You're signed in. An organiser will add you as a member — then this page opens up."
  (Viewers are waiting on a manual promotion — Brief C.)
- Hidden when all steps are done, or when dismissed. Re-openable from a small
  "First steps" link in the hub's errands strip.

## State
Derive everything you can. Store only **dismissed** and the **/center** tick —
per user per org. Options: a tiny table (`user_first_steps(user_id, org_id, step,
done_at)` — take the next free migration number at write time, `ls packages/db/migrations`;
others are writing migrations today) or a key in an existing per-user JSONB. Not
localStorage (must follow them across devices). Tell PM which you chose.

## Build notes
- Plain CSS on custom properties — **no Tailwind** in the shared package (memory:
  *@source shared packages*). Match the existing faces in `packages/cms-ui/src/hub/`.
- IFAC hub is dark (`.ifac-hub-scope` tokens), innergathering light: measure every
  colour pair; tick/progress colour in marks, not body text. Remember IFAC's
  `a { color: inherit }` — style links.
- Sections return `null` when there's nothing to show — no empty-state apologies.
- Service in `@elkdonis/services` exports source — a broken file breaks every app's tsc.
- Both hosts are live prod builds: back up `.next`, `NEXT_BUILD_CPUS=2`, check
  `git status` first (other sessions' uncommitted work compiles in).

## Done when
- Rendered as: a fresh member (0/5), a partly-done member, a viewer, signed out — on
  IFAC and innergathering, desktop + phone screenshots.
- Each auto-tick verified by making the real change on a test account, then cleaned up.
- Log line on the sprint board.
