# Where the MCP work goes next (2026-11-27)

Justin: "these rails arent all meant to be taken as a course, and the dock helps with obligations or tasks, or things have done... but then also just alot of things that can be tied together so agent might start understand layouts, and common uses or patterns".
Also: layout work will "likely be automated later anyways to templates or options, not frame of a window".

## The idea in one line

The rails are not courses. They are the platform's **map of verbs**: every capability, how it is done (a declared form, or a deep link), how we know it is done, and what usually comes next. A course is only one way of walking that map. The dock and the assistant need several more ways, all built on the same map.

## Ways of walking the map (dock tabs, and assistant tools)

| Walker | What the person sees in the dock | Built from (exists today) | New piece |
|---|---|---|---|
| **Course** | "Your next step" in a trail | lms courses, tracks, `dockData` | nothing new |
| **Due** | what they owe: booking requests waiting, orders to ship, RSVPs to answer, a guide reply, today's journal entry closing, payouts missing, a draft left half done | status checks (`server/status.ts`) already know most of these | a check may answer `due: { what, by, count }`; one reader collects them across orgs |
| **Routine** | the repeating things: daily practice, weekly letter, a channel slot | `repeat: 'daily'` on task steps, Channel routines | a cadence on any capability, not only on course steps |
| **Done** | what they did, newest first, with an undo where one exists | `action_events` records every action (who, via dock / app / assistant, which org, result) | a reader plus a tab; for the assistant it is memory of the person's history |
| **Here** | "Things you can do on this page" | atlas `address` (app + path) on every capability | invert it: path → capabilities. The dock lists them, and the assistant knows what a page is for |

Each row's actions are the same declared forms (`packages/actions/src/fields.ts`), so whatever a walker finds can be done in place.

## The patterns layer (what the assistant learns from)

1. **Use cases.** A use case is a named goal for a kind of person, e.g. "sell prints" for an artist or "run a reading circle" for a guide. It holds the capabilities in order, marked essential / optional / later. Justin's trail edits on /rails already store exactly that (`dev_versions`, subject `rail:*`). Promote them to first-class use cases. They become the assistant's front door: a goal in plain words → a use case → steps, each a form or a deep link.
2. **Sequences from real use.** `action_events` holds who did what in which order. A small nightly job finds chains that happen often ("published a work → shared it → set up payouts") per role and per kind of site. /rails shows them as suggested links ("seen together 14 times"). Justin accepts or rejects each one; accepted links become `leads_to` edges. The map is then partly learned and always curated.
3. **Layout patterns become templates and options.** This follows Justin's direction that layout is automated into templates, not hand-framed. Three things already exist: the block manifest (MCP `list_blocks`, `describe_block`), every org's stored pages (`read_page`), and the offer-template catalogue (`/development/offer-templates/catalogue.json`). From them a pattern library can say which page kinds use which block sequences, and which template suits which content. The assistant's job is to pick a template or option and fill its fields, never to place things on a canvas. That fits `propose_page_patch`, which saves drafts only.
4. **One vocabulary.** There is one plain name per capability and per field, plus a synonyms list ("bio" = "about" = "a line about what you do"), so the assistant maps a person's words to capability ids. The confirm-wording waves are already building this; the synonyms come out of the desk and the wording reviews.

## The assistant's tools, in stages

| Stage | Tools | Rule |
|---|---|---|
| now | `whats_next`, `routine_steps`, `org_summary`, `entry_status`, site reads, page drafts | read, or draft only |
| next | `list_actions({ here? })`, `describe_action(id)` (the declared form's JSON schema, `actionFormJsonSchema`) | read |
| then | `propose_action(id, values)` | the assistant fills the form; it shows as a **pending card in the person's dock**, and the person presses Confirm. The assistant never runs an action itself. Same confirm card, same audit row, `via: 'mcp'` |
| then | `whats_due`, `what_i_did`, `use_case(goal)`, `suggest_template(page)` | read; `suggest_template` returns a draft through `propose_page_patch` |
| always | tool groups by atlas `family` (profiles, studio, site, business, market, network, rails, directory) | each assistant sees about 10 tools, not 60 |

## Suggested order (one session each)

1. **Due and Done tabs** in the dock. The most useful to people, and no AI needed.
2. **Here**: path → capabilities in the dock, plus `list_actions` / `describe_action`.
3. **`propose_action`** → a pending dock card.
4. **Use cases** as first-class, from the /rails edits, with a Use cases view on /development.
5. **Patterns**: sequence suggestions on /rails, and the layout pattern library from pages plus templates.
6. Keep wiring the `where: dock` list (41 capabilities) in waves of 5 to 8, each with its wording wave.

## What Justin decides
- Which walkers first: Due, Done, Here.
- Whether an assistant may *propose* actions into the dock (it never runs them).
- The use-case names: a short list of goals per kind of person to start from.
