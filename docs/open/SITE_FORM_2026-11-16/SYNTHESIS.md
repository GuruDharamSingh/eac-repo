# One plan: site form, package families, action base (2026-11-16)

Lead's synthesis of `A_SITE_FORM.md` (lane siteform) and `B_FAMILIES.md` (lane families), joined to the dock/MCP work (`docs/open/mcp-foundations/DOCK_RAILS_PLAN.md`). Read this first; the two docs hold the evidence and file paths.

## The idea in plain words

Today the same thing is often built several times: a page save in 7 apps, a profile edit in 18, a site-style save in 4. The plan is to make each thing exist **once** and be used everywhere at the weight a site needs.

Four layers, each with one job:

| Layer | Makes single | Built from | Doc |
|---|---|---|---|
| **Families** | each domain (profiles, business, directory, market, studio, network, site, rails) | a server package plus a `-ui` package; sites take `/lean`, `/standard` or `/full` | B |
| **Site form** | each site's shell (layout, header/footer, theme, Puck pages, studio routes) | the `org-site` kit: a site is `site.ts` + theme + content + feature flags | A |
| **Action base** | each action (one host per capability) | atlas capability → registry entry → dock card → MCP tool | atlas, DOCK_RAILS_PLAN |
| **Rails** | each guided path | tracks over capabilities; courses are paths through the tracks | rails-nexus (lane rails) |

## The join: one declaration, three renderings

The strongest finding sits between the two docs. artdirect's sidebar is not hand-built: it is **generated from a field declaration** (`packages/cms-bindings/src/dossier/field-registry.ts`) and saves through one action on blur (A §3.4). If every capability points at one field declaration, the same declaration renders as:

1. **the house editor's sidebar boxes** (record and site fields: name, tagline, nav, footer, chrome variant, features on or off);
2. **the dock's module form** (DOCK_RAILS_PLAN §5b: the dock offers its own form before routing; lane rails is adding `dockForm`);
3. **the MCP tool's input schema** (a tool is a capability; its inputs are the fields).

So one piece of work (declare the fields of a capability) feeds the editor, the dock and the AI at once. The condition: **one field vocabulary**. Four exist today (`DossierFieldMeta`, `SiteVar`, `PropDef`, `ContentFieldSpec`); A recommends `ContentFieldSpec`, which `studio-forms` already reads, with adapters for the other three. No fifth.

And the capability's `family` field (B §4, §5) picks its MCP tool group, its package home and its weight. The atlas becomes the index of all three.

Editor shape, settled by A §3.4: canvas (direct-edit) for page layout and words; Puck sheet for sealed blocks and page settings; the generated sidebar for fields. One sidebar, with layout left to the canvas.

## Order of moves

One session each. Nothing here is a production action; each app that takes a moved package needs its normal rebuild, on Justin's go.

| # | Move | Source | Needs from Justin |
|---|---|---|---|
| 1 | Atlas: optional `family` on Capability (done as a type by lane rails), the layers table, and a `fields` reference per capability (type only) | B1 | family names (D5) |
| 2 | Chrome variants on katie: `chrome`/`footer` select in Puck page settings, marker element, two CSS variants, proven on `/preview` | A1 | the header list for elktours (D1) |
| 3 | Declare katie's site field spec in `ContentFieldSpec`: name, tagline, nav, footer links, chrome variants. Read-only | A2 | none |
| 4 | Boundary script (layers, current violations as baseline) in `check-types`; `/lean` and `/standard` subpaths on `cms-ui/profile` and `studio-forms` | B2, B3 | none |
| 5 | Extract katie's `SiteShell` and site-style trio into `org-site`; hidden-enneagram drops its identical copies in the same pass | A3 (+ lane onelogic's lifts) | none |
| 6 | Extract the Puck catch-all and Studio routes; `page-save` gets one host | A4 | none |
| 7 | **The join, proven once**: the sidebar renders from the move-3 declaration on katie, and the dock renders the same group as a module form for one capability (`site-style-save` or site identity) | A5, A6, rails `dockForm` | artdirect review (D2) |
| 8 | Lift `profiles` out of `services`; `services` re-exports for one cycle | B4 | none (after onelogic finishes) |
| 9 | `business` family: businesses, offerings, booking, payouts. RSVP/booking one-logic lands here | B5, RSVP doc | RSVP answers (liaison item 3) |
| 10 | Split `commerce` into `commerce` and `market` (start with `./auctions` subpath) | B6 | D7 |
| 11 | Kit adoption: hidden-enneagram, then sunjay, then danamccool (site-style first), elktours shell only | A7–A9 | D4 |
| 12 | MCP: one endpoint, tools registered by `family`, read-only first | B8 | D10 |
| 13 | artdirect on top of the families (routes only) | B7 | after D2 |
| 14 | GPU worker on the existing job tables | B9 | D9 |
| 15 | `network` family out of `services` (largest; several sessions); shell orgs get whole-site pages on arts-collective | B10, A10 | none |

Moves 1–7 are the core: after them, one site runs on the kit, and one action is declared once and rendered in the editor and the dock.

## Decisions (the liaison asks these one at a time)

| # | Question | Recommendation |
|---|---|---|
| D1 | Which headers and footers do you want on elktours pages? (for example: normal, over a hero, tour page, minimal) | Name 3 to 5; they become the variant list |
| D2 | artdirect sidebar: which parts should the house editor keep? Section boxes, save on blur, section on/off switches, layout picker. Open `artdirect.arts-collective.com/<your slug>` signed in, tab "Your file" | Keep all four; layout stays with the canvas |
| D3 | New sites: shell orgs for sites with no code of their own, a copy of a starter app for the rest, no generator yet? | Yes |
| D4 | Order: katie, hidden-enneagram, sunjay, danamccool; elktours takes the shell only; artdirect takes the sidebar pattern only; amrit-canada and art-auction stay out? | Yes |
| D5 | Family names: profiles, business, directory, market, studio, network, site, rails? | Yes |
| D6 | Directory as a package in each site, not a separate service, for now? | Yes; revisit if a site runs off the box |
| D7 | Split auctions out of `commerce` into `market`, so selling art doesn't carry the auction engine? | Yes |
| D8 | The business suite as its own family, below directory, not inside artdirect? | Yes (katie and elktours need booking without the directory) |
| D9 | GPU worker reaches the job tables through a limited DB role over Tailscale? | Yes, first; a job API only for a second machine |
| D10 | MCP: one endpoint with tool groups by family, not a server per domain? | Yes |
| D11 | katie gets the canvas editor door: now, or after the shell extraction? | After |

## Pros and cons of the whole plan

- **For:** a fix lands once instead of in 7 or 18 places; new sites cost a config file; every declared action is usable by the editor, the dock and an AI without extra work; build memory and exposed server actions shrink on lean sites.
- **Against:** many apps are touched over many sessions, and there are no tests or CI. Mitigations: the atlas checks, the boundary script, behaviour-neutral moves with re-exports for one cycle, one app adopting at a time.
- **Risk to watch:** moves 5–6 and 8 change files other sessions also edit. Each move starts with a dirty-tree check and backups, as in this session.

## Corrections found on the way

- katie's site-style save does revalidate (A, against the atlas drift note); only sunjay and elktours lack it. Sent to lane rails for the atlas.
