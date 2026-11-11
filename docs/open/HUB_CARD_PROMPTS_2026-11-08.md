# Hub card prompts for Claude Design (2026-11-08)

Context for both: each org on the platform has a shared **hub**, its back-office for coordinating
internal members and managing the site. Hub items are **cards**. A card opens a **pop-up** for quick
actions and has its own **detail page** for deep work. We are retiring every app's separate
`/manage` page by folding it into a handful of fundamental hub cards. These two prompts cover
the two heaviest ones. Design for the shared hub system, not for one app. Each org shows the
same card with different sections switched on.

---

## Prompt 1: Member Management card

Design the **Member Management** hub card: one place for an org to see and manage everyone who
touches it. It works as the org's admin, security and analytics panel. It replaces the People,
Access, Artists & dealers, Visitors and Cloud storage tabs in today's /manage pages.

**Who is in it** (one list, filterable):
- **Members** with a role. The roles are **owner, guide, member and viewer**. Owners can change any role below owner. Nobody can change their own role or another owner's.
- **Listed or unlisted**: whether a member shows publicly on the site (e.g. in an artist directory). This is a toggle per person.
- **Arrivals**: signed-in people who came over from another site on the network, ready to be welcomed or given a role.
- **Visitors**: anonymous traffic, as analytics rather than a people list (visits, top pages, where from, over time). Owners only.

**What you can do to a person:** change role, list or unlist, remove from the org, and see their status
for **cloud storage access** (synced, pending, or no access). Every role change queues a sync to the
org's shared storage, so show that it is in flight.

**States to design:**
1. **Card, collapsed on the hub**: counts (members by role, new arrivals, visitors this week) and one "needs attention" line.
2. **Pop-up**: a quick person lookup and role change, with the arrivals queue.
3. **Detail page**, with three sections, People / Arrivals / Visitors:
   - a people table (role chip, listed toggle, storage status, joined, last seen) with a row expand for actions
   - a visitors analytics view
4. **Permission view**: a compact matrix of what each role can do. This is read-only for now, but it makes access legible.
5. **Empty and small-org states**: an org with 3 people should not feel like an enterprise console.

**Constraints:**
- Destructive actions (remove, demote) need a confirm step.
- Visitors and storage controls are visible to owners only. Guides see people and arrivals.
- Leave out email invites and placeholder profiles for people who haven't signed up yet. A separate roster service comes later. Leave a hook for it ("+ invite" can be disabled).

Reference screenshots: the IFAC /manage People & access, Artists & dealers, Visitors and Cloud storage tabs (the most complete today), and the sunjay /manage People tab (the common template).

---

## Prompt 2: Site Builder card

Design the **Site Builder** hub card: one place to see and edit everything about the org's site
itself. It replaces the Page builder, Site copy, Appearance and landing-copy tabs in today's /manage
pages.

**What it holds:**
1. **Pages**: every page of the site as a **thumbnail grid or list**, each with:
   - title, slug, last edited, and an **Edit** button that opens the visual page editor
   - a **row expand** holding a notes/description box (what this page is for, copy notes for whoever edits next)
   - **site-copy fields** that belong to that page (hero text, banner image, about, mission, etc.). Some pages are built in the visual editor and some are fixed templates with editable copy slots. Show both kinds in the same list, and make it clear which kind each is.
2. **Theme / appearance**: site colours, fonts and skin, with an optional per-page override. A live preview strip is welcome.
3. **Site profile flags**: what this site *is*, e.g. **has a store** or **has practices**. These drive naming and which other hub cards appear. Make them simple toggles with a one-line explanation each.
4. **New page**: start from a template or blank.

**States to design:**
1. **Card, collapsed**: page count, last edited page, and the theme swatch.
2. **Pop-up**: jump to editing a page, and quick-edit a copy field.
3. **Detail page**: Pages / Theme / Profile.
4. **Page row, expanded**: notes plus copy fields.
5. **Page with no thumbnail yet**: thumbnails are new, so design a graceful placeholder.

**Constraints:**
- Content (posts, articles, series) is NOT here. It lives in a separate Content card. Keep the line clear: Site Builder is the *site's structure and copy*, not its publishing stream.
- It must work for a 2-page site and a 20-page site.

Reference screenshots: the sunjay /manage Page builder and Site copy tabs (which should become one), the IFAC Appearance tab (theme), and the elkdonis-arts.org/books /manage landing tabs (The book, Structure of a meeting, Books ahead, Hero/banner/copy), which are copy slots on a fixed landing page.

---

## Prompt 3: Publish card + /content page

Design the hub's **Publish** card and its **/content** page. Together they are where an org starts new content and manages what it has made. They replace the old Content tables in /manage and the per-app "compose" pages.

**Card, collapsed:** "Publish", with a count of drafts and of scheduled items.

**Pop-up:**
1. **Top: what to publish.** One tile per kind: **Post** (article/writing), **Meeting**, **Series** (recurring meetings), **Artwork**. **Questionnaire** and **Poll** are secondary, in a "more" row. A site only shows the kinds it uses.
2. **Below: a short list of recent content** (5-6 small rows: thumbnail, title, kind, status chip draft/scheduled/live, date). Clicking a row opens that item's detail. "See all" goes to /content.

Clicking a kind tile does not open a form in the pop-up. It sends the person to the **Studio in focus mode** with that kind's form open.

**/content page:**
- The same kind tiles across the top as a "New" strip.
- Below: the full **content library** (search, filter by kind/status/series, sort, grid or list).
- Clicking any item opens the shared **content detail** (a side sheet on desktop, full screen on phone):
  - a header with media, title, kind and status
  - a timeline of its history, grouped Ahead / Now / Past (drafted, published, shared to socials, emailed, scheduled sessions)
  - actions: Edit in Studio, View on site, Open in Channel, Board
- The detail is one component used everywhere (hub pop-up, this page, Channel, Studio). Design it once.

**States:** an empty org ("Publish your first post"), an org with 200 items, an item mid-plan (has scheduled shares), and a phone layout.

**Constraint:** no forms here. This card is choose-a-kind plus the library. The forms are their own design pass (prompt 4).

---

## Prompt 4: Publication forms (one family, all kinds)

Design the **forms for creating each kind of publication** as **one family**: the same shell, field components, preview and actions, with kind-specific sections. They run inside the Studio's focus mode and must be built so the same form can also appear inline on a site page (quick compose) with fewer fields.

**Kinds and their distinctive parts:**
- **Post / writing**: title, body (rich text), cover, excerpt, tags, audience (public/members), schedule.
- **Meeting**: title, description, when (date, time, timezone, duration), where (place / online link / both), host(s), capacity and RSVP, cover.
- **Series**: a meeting that repeats. Switching **Repeat** on in a Meeting *turns it into* a Series. The form grows a **session planner** (cadence, number of sessions, per-session titles/notes, skip dates) instead of sending the person to a separate tool.
- **Artwork**: images (primary + gallery), title, maker/credit, medium, dimensions, year, price or "on request", edition/variants, availability.
- **Questionnaire / Poll**: small add-ons, either standalone or attached to a post or meeting.

**Shared shell, per kind:**
- **Essentials first** (3-5 fields to publish), then progressive "more" sections.
- A **live preview** of how it appears on the site.
- **Publish / Schedule / Save draft**, with a **"Share it"** step afterwards that hands off to Channel's routine suggestions.
- A spot for **presets** ("start from…", e.g. this org's usual meeting setup).

**Design:**
1. The shell, shown with Post.
2. Meeting, plus Meeting with Repeat on (series planner).
3. Artwork.
4. The **compact inline variant** of Meeting, for a quick compose on a page.
5. Validation and error states, and the after-publish "share it" step.
