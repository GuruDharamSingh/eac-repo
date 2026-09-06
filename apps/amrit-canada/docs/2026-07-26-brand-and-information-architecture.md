# Amrit Canada — brand and information architecture

**Date:** 2026-07-26
**Org:** `amrit_canada`
**Owner:** Guru Dharam Singh (`gurudharamsingh@gmail.com`)
**Status:** decision record for the rebuild off Mantine onto the EAC standard

This is not a design system. It is the reasoning behind the site, written down so the
next person working on it — and the next site cut from this template — inherits the
decisions rather than re-deriving them.

---

## 1. What this site is

Amrit Canada is Guru Dharam Singh's umbrella for several overlapping ventures that share
one community and one teacher. It promotes the practice of **Kundalini
Yoga** and **Sikh Dharma traditions** in Toronto.

It is deliberately a mish-mash held in one place. That is the point: rather than three
thin sites, one site with three feeds, one login, one mailing list, and one editorial
surface.

It is also the first site built deliberately on the Elkdonis Arts Collective standard
rather than drifting into it, so it doubles as the template for the sites that follow.

---

## 2. The three audiences

Each of the three pages exists because a distinct group of people needs a distinct
answer. Design decisions get settled by asking which of these three is being served.

### Amrit Vela — 4:00 AM Aquarian Sadhana

Committed practitioners. They already know what sadhana is; they do not need it
explained or sold.

**Note the venue split, which the rebuild initially got wrong:** the *daily* 4am
sadhana happens where Guru Dharam Singh lives; the *monthly gathering* is held "either
in a Church or on a Ski Hill in Etobicoke" — it moves. Never state a fixed address for
the monthly sadhana, and see §3 before naming any venue at all.

What they need, in order:

1. **Is it happening this month?** The recurring monthly gathering is confirmed or
   cancelled by the guide. This is the single most important piece of information on
   the site and it must be answerable above the fold.
2. **Who else is coming?** Showing up at 4am is easier when you can see five other
   people intend to. Attendance intent is social infrastructure, not a vanity metric.
3. **The materials.** Jap Ji Sahib, the Aquarian Sadhana song sheet, and the Peace
   Lagoon for hukam.

The daily practice runs every morning; the monthly gathering is the one that gets
confirmed, RSVP'd and emailed about.

### Yoga Classes

Casual and prospective students. Guru Dharam Singh's own classes plus classes he
teaches for others, plus promoted events from elsewhere — including communities beyond
the Elkdonis platform. Notably his **monthly Kirtan for Lotus Yoga**.

They need the schedule, the cost, how to find it, and what to bring. They do not need
lineage history before they can find the time of a class.

### Gurdwara & Langar

Sangat and visitors. The service is occasional rather than weekly — announced when it
is arranged. See §3: describe the gathering, not a hosting organisation. They need the date, how to find it, and enough etiquette guidance that a
first-time visitor is not anxious: head covering, shoes off, when langar is served.

---

## 3. Relationships to other organisations — and what may NOT be claimed

**This is a correction of an earlier version of this document, which was wrong in a
way that mattered.** That version described a "three-entity credit model" in which Guru
Ram Das Ashram was named as the *presenter* of the Amrit Vela and Gurdwara feeds, and
put the ashram's name under the site title on every page. Migration 075 removed all of
it.

The accurate position:

**Amrit Canada is Guru Dharam Singh's own project.** It speaks for him and for nobody
else. It has no official connection to any other organisation.

| Organisation | Actual relationship | What the site may say |
|---|---|---|
| **Guru Ram Das Ashram** | He lives there and practice happens there. **He has no mandate from their board.** | Nothing that presents the ashram as a host, sponsor, presenter or co-identity of this site. Describing where practice happens, in the first person, is fine. |
| **Lotus Yoga** | A business he is part of; they engage him to teach. **He does not speak for them.** | He may say he teaches a session for them. The site may not present Lotus as affiliated with, endorsing, or party to it. |

The rule: **describe what he does; do not speak on anyone else's behalf.** "I hold
sadhana here" is his to say. "Presented by Guru Ram Das Ashram" is not — that asserts
a relationship a board would have to agree to.

The `org_feeds.presenter` field still exists, because a genuine co-presenter is a real
case for other sites in the network. For this site it is deliberately **NULL** on the
Amrit Vela and Gurdwara feeds. Only fill it in for someone who has actually agreed.

### 3a. The street address

The pre-rebuild site never published the street address; it was introduced during the
rebuild from a chat message and has since been removed again. It is a private
residence. Publishing it is a deliberate decision for the owner to make — not a default
— and it is doubly so while there is no arrangement with the building's board. If it
is ever wanted, it goes in editable copy via /manage/pages → Visiting, never hardcoded.

---

## 4. Voice

**Devotional and warm, with concrete logistics underneath.** This is the site's own
register, recovered from the pre-rebuild copy — not a style invented for the rebuild.
An earlier draft of this document argued for a flatter, "unmystified" voice; that was
wrong, and following it produced replacement copy that had to be reverted.

The actual register:

- Devotional language is the house style and should be kept: *"Crown yourself in the
  early hours of the morning"*, *"the ambrosial hours"*, *"come as you are, leave
  transformed"*. These are the site's own words.
- Sanskrit and Gurmukhi terms are used freely, not avoided.
- Underneath the devotional framing, logistics stay exact — 4:00 AM, 2.5 hours, which
  month, how to find it (see §3a on the address). Someone deciding whether to set a 3:30am alarm needs both.

**Do not paraphrase the practice itself.** The Aquarian Sadhana sequence and its
timings (Japji Sahib 20 min → Kundalini Yoga Kriya 30 → Savasana 5 → Long Chant
7 → Seven Aquarian Sadhana Chants 62 → Long Time Sun 3) are the practice, not
descriptive copy. Same for the attribution in §4a.

Editable copy lives in `org_site_sections` (see `/manage/pages`), so wording changes
belong in the database, not in a component rewrite.

### 4a. Attribution that must not be dropped

**Guru Fatha Singh Ji** ([gurufathasingh.com](https://gurufathasingh.com)) began this
sadhana; it has been carried on for about a decade. **Guru Dharam Singh** took
responsibility for ensuring its success in **2023**. This lineage was lost once in the
rebuild and restored by migration 074 — it is history, not marketing copy.

---

## 5. Palette and type

Carried forward from the pre-rebuild `globals.css` so the site stays recognisable to
people who already know it. Re-expressed as HSL shadcn tokens during the Tailwind
migration.

| Token | Hex | Use |
|---|---|---|
| Saffron bright | `#F4C430` | Primary accent, highlights |
| Saffron medium | `#E6B422` | Primary, buttons |
| Saffron light | `#F7D858` | Hover, washes |
| Terracotta bright | `#E67E50` | Secondary accent |
| Terracotta medium | `#D16B47` | Secondary |
| Terracotta light | `#F2A080` | Hover, washes |
| Cream | `#FDF5E6` | Page background |
| Linen | `#FAF0E6` | Card background |
| Charcoal | `#36454F` | Foreground text |

Per-feed accents distinguish the three sections at a glance:

| Feed | Accent | Hex |
|---|---|---|
| Amrit Vela | Saffron | `#E6B422` |
| Yoga | Green | `#5A8A6A` |
| Gurdwara | Crimson | `#8B2E2E` |

**Type:** Cinzel for headings, Lora for body — both loaded through `next/font/google`,
not raw `<link>` tags.

**The decorative layer is load-bearing to the site's identity** and was carried over
verbatim rather than redrawn with shadcn defaults. It lives in `globals.css`:

| Class | What it is |
|---|---|
| `.card-natural` | Cream gradient, 2px saffron border, warm glow, lift-and-scale on hover. The card everywhere. |
| `.bg-header-footer` | Charcoal → `#2C3E50` gradient. Header, footer, and section banners. |
| `.saffron-divider` | Saffron gradient rule, fading at both ends. |
| `.amrit-quote` | Pull-quote: saffron left bar, fading saffron wash, italic. |
| `.portal-tile` | Home page tiles; hover glow reads from the feed's own `--feed-glow`. |
| `.gradient-text` | Saffron → terracotta clipped text. |

Body background is the cream→linen gradient, not a flat fill. The one deliberate
change: the three hardcoded per-section tile gradients became one `color-mix()` on the
feed's accent, so a fourth section styles itself.

---

## 6. Information architecture

| Route | Serves | Notes |
|---|---|---|
| `/` | All three | Next Amrit Vela with live confirm/cancel status, three feed portals, latest from each |
| `/amrit-vela` | Practitioners | Feed page. Sadhana structure, materials, monthly gathering with RSVP |
| `/yoga` | Students | Feed page. Classes, kirtan, promoted events |
| `/gurdwara` | Sangat | Feed page. Service dates, langar, visiting etiquette |
| `/[feed]/[slug]` | — | Any single post or gathering. RSVP, attendee list, share link |
| `/about` | All | Teacher and guide roster |
| `/about/guru-dharam-singh` | All | The flagship teacher page — bio, links, and everything he's authored |
| `/resources` | Practitioners | Jap Ji Sahib, Aquarian Sadhana song sheet, Peace Lagoon |
| `/login`, `/account` | Members | Baroque login component; email/password and Google |
| `/manage/*` | Owner, guides | Editorial surface — content, feeds, people, page copy, attendees |

The three feed pages are **one dynamic route** driven by `org_feeds`, not three files.
Adding a fourth section is a row in a table, not a new page.

---

## 7. What makes this a template

Deliberately org-agnostic — should be copied or shared wholesale by the next site:

- **`org_feeds`** — per-org named feeds with tagline, presenter, accent and order. The
  replacement for `threads.section`'s hardcoded `('amrit_vela','yoga','gurdwara')`
  check constraint, which had this one app's structure baked into the shared schema.
- **Feed-driven routing** — `/[feed]` and `/[feed]/[slug]` read entirely from the table.
- **The `/manage` shell** — dashboard, content form with feed selector, people, page
  copy, feeds, attendees. Nothing in it names Amrit Canada.
- **Role gating via `packages/services`** — `hasAnyOrgRole(userId, orgId, ['owner','guide'])`.
  Replaces the hardcoded email allowlist this app used to run on. Email allowlists do
  not survive contact with a second site.
- **`org_site_sections`** for editable page copy, following the IFAC precedent.
- **The RSVP pair** — signed-in members into `thread_rsvps`, guests into
  `guest_submissions` + `contacts`, one combined count. Most 4am attendees will never
  make an account; a members-only RSVP would measure the wrong thing.

Amrit-specific — expected to be replaced per site:

- Copy, palette, fonts.
- The Aquarian Sadhana step list (Jap Ji 20 min → … → Long Time Sun 3 min).
- The three feed definitions and their presenters.
- Gurdwara visiting etiquette.

---

## 8. Accounts, and one constraint worth knowing

Authentication is a single self-hosted GoTrue instance shared by every site in the
monorepo, keyed on email. A login is a login everywhere; **there is no collision risk**
between this site's owner account and any other site's. Authorisation is per-org via
`user_organizations`, which is why the rebuild moved off email matching.

The separate org `guru-dharam` ("Guru Dharam's Practice Group", used by
`apps/blog-guru-dharam`) is a different org and does not interfere with `amrit_canada`.

**Constraint:** a teacher page hangs off `artist_profiles`, whose primary key is
`user_id`, and `users.auth_user_id` is `NOT NULL`. So a teacher page requires a real
account. The admin flow is therefore *promote an existing member to guide and publish
their profile*, not *invent a person*. Guests can be RSVP'd and mailed without an
account; they just cannot have a page. Creating accounts on someone's behalf would mean
writing into GoTrue from this app, which is deliberately not done here.
