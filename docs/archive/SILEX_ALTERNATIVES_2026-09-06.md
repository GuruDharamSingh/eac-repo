# Open-source editors that could do what EAC needs — a survey

Date: 2026-09-06
Companion to `SILEX_AUTHORING_REVIEW_2026-09-05.md`. That review argued for *tiering* the
editors around one shared substrate (templates + manifest + binding engine). This asks: for
the tiers that matter — the default authoring path for non-technical owners — is Silex the
right tool, or is something else a better structural fit?

---

## What EAC actually needs (the rubric)

| # | Requirement | Why |
|---|---|---|
| R1 | **Self-hostable, no SaaS dependency** | Hard requirement — the whole project is self-hosted |
| R2 | **Non-technical owners** | Audience is spiritual communities, artists, small collectives |
| R3 | **Constrained editing** — fixed sections, declared fields, editable regions | The real need; freeform CSS is the thing the audience can't use |
| R4 | **Multi-tenant** — one instance, many orgs, org-scoped storage | 12 apps, per-org Nextcloud folders |
| R5 | **Custom / pluggable storage** | Content lives in per-org Nextcloud, not the tool's DB |
| R6 | **Live React islands** | Pages aren't static — `<eac-embed>` swaps to server components (feed, RSVP, forms) |
| R7 | **Integrates with the Next 16 / React 19 app** | Or a clean handoff; avoid a second stack to maintain |
| R8 | **Safe server-rendered output** | Published markup rendered with `dangerouslySetInnerHTML` today |
| R9 | **License compatible** | AGPL is fine (Nextcloud, Silex already are) |
| R10 | **Template authoring path** | New templates are the bottleneck (§4 of the review) |

---

## Scorecard

`●` strong · `◐` partial / with work · `○` weak or absent

| | R1 self-host | R2 non-tech | R3 constrain | R4 multi-tenant | R5 storage | R6 live React | R7 in-app | R8 safe output | R9 license | R10 templates |
|---|---|---|---|---|---|---|---|---|---|---|
| **Silex** (current) | ● | ○ | ◐ | ◐ built | ● built | ◐ via embeds | ○ separate svc | ◐ sanitize | ● AGPL | ◐ hand-authored |
| **Puck** | ● | ● | ● | ◐ you add | ◐ you add | ● native | ● same app | ● no HTML strings | ● MIT | ● config = template |
| **Webstudio** | ● | ○ | ○ | ◐ | ◐ CMS conn | ○ | ○ own app | ◐ | ● AGPL | ○ |
| **Craft.js** | ● | ◐ | ● | ◐ you add | ◐ you add | ● native | ● same app | ● | ● MIT | ◐ you build UI |
| **GrapesJS direct** | ● | ○ | ◐ | ◐ | ● | ◐ | ◐ | ◐ sanitize | ● BSD-3 | ◐ |
| **Payload CMS** | ● | ● | ● | ● | ○ own DB | ● | ◐ | ● | ● MIT | ◐ blocks |
| **Plasmic** | ○ studio needs cloud | ● | ● | ○ | ○ | ● | ◐ | ● | ◐ AGPL+cloud | ● |
| **VvvebJs** | ● | ◐ | ◐ | ○ | ◐ | ○ | ○ | ◐ | ● MIT | ◐ |
| **Builder.io** | ○ SaaS | ● | ● | ● | ○ | ● | ● | ● | ○ proprietary | ● |

---

## The three worth a real look

### Silex — the incumbent
**Model:** standalone GrapesJS app on `:6805`, publishes static HTML/CSS to a pluggable
storage backend (we wrote the Nextcloud connector). ~2.8k stars, AGPL, OW2 Best Project 2026.

- **Strengths for us, already paid for:** the Nextcloud connector, the one-time token bridge,
  `layout_mode='silex'` routing, the four templates, `mode=simple`. hiddenenneagram.com runs
  on it today.
- **Where it fights us:** (R2/R3) it's a *design tool* wearing a no-code label — the moment an
  owner opens the style manager they meet flex, classes, px/vh. Constrained editing in
  GrapesJS is a [years-old open request](https://github.com/GrapesJS/grapesjs/issues/263)
  with inconsistent `editable:false` support, so "give them Silex but locked down" isn't a
  reliable safety story. (R6/R8) live data means publishing HTML with `<eac-embed>`
  placeholders, sanitizing it, and swapping tags for React at request time — a whole pipeline
  and a class of bugs (the stored-XSS in the bind-order, fixed this session). (R7) it's a
  separate Node service on its own origin.
- **Verdict:** right for **Tier 3** (power users, the dedicated sites already on it). Wrong
  as the *default* for the audience.

### Puck — the closest structural match to what EAC is actually doing
**Model:** `@measured/puck`, MIT, 13.3k stars, pushed yesterday. It is **not a standalone app**
— it's a React component you render inside your own app. You register *your* components with a
schema of *your* fields; the user drags from that fixed set and fills declared fields, some
marked read-only. Data is a JSON tree `{ content: [{type, props}], root }`. Render with
`<Render config data />` — server-side, RSC-capable.

Map that onto EAC:

| EAC concept | Puck concept |
|---|---|
| template manifest (sections + declared fields) | Puck `config` (components + field schemas) |
| `data-trait` hook + `fieldRegistry` entry | a Puck `field` (text / select / number / custom) |
| `<eac-embed data-eac-component="rsvp">` | a Puck component that *is* `<RsvpEmbed>` — no placeholder, no swap, no sanitize |
| `mode=simple` | Puck's default — there is no "advanced mode" to fall out of |
| published HTML in Nextcloud | Puck data JSON (Nextcloud or Postgres, your call) |
| binding engine resolving published HTML | mostly unneeded — props *are* the data; the engine stays useful for formatters + any HTML-authored template |

- **What we'd add** (R4/R5): auth, permissions, multi-tenancy, storage — Puck ships none of
  these on purpose. EAC already has every one of them (`@elkdonis/auth-*`, `org-membership`,
  the Nextcloud clients). This is wiring, not building.
- **What disappears:** the second Docker service, the second origin, the token bridge, HTML
  sanitization of authored markup, the `<eac-embed>` split, the Express-5 connector surgery,
  the `silexlabs/silex` image problem. `<eac-embed>` components become ordinary React.
- **What we'd lose:** Silex's freeform canvas (fine — that's Tier 3), its publish-to-FTP/
  GitLab connectors (don't use them), its built-in data-source/11ty CMS (declined anyway),
  and the sunk cost of the connector.
- **Theming:** Puck 0.22 added CSS-variable theming — the same primitive Phase 2 wants.
- **Verdict:** the strongest candidate for **Tiers 1–2**. Its entire design premise —
  "users compose from components you define, constrained to your design system" — is the
  authoring model EAC has been hand-rolling.

### Webstudio — the "if we wanted design freedom" option, which we don't
**Model:** AGPL, self-host via Docker + Postgres, full Webflow-class visual CSS, connects to
~14 headless CMSs, exports as a Remix/React app. ~5k+ stars, well funded.

- Genuinely impressive, and the right call for a **design-heavy team** that wants Webflow
  without the pricing.
- But it maximises the exact axis (R2/R3) EAC needs to minimise: it hands owners *all* of CSS.
  It's also its own application, not an embed, and its content model is "connect a CMS," which
  would make EAC's Postgres the CMS behind yet another surface.
- **Verdict:** wrong audience fit. Worth knowing it exists if EAC ever serves agencies/
  designers rather than practitioners.

---

## The also-rans, briefly

- **Craft.js** (MIT) — React-native "framework to build an editor," like GrapesJS-for-React.
  Same constrain-ability as Puck but *you build the whole UI*. Puck is Craft.js with the UI
  already built. Only pick this over Puck if Puck's layout model proves too rigid.
- **GrapesJS directly** (BSD-3) — drop Silex, keep the engine, own the shell. More control,
  more maintenance, and it keeps the HTML-string + sanitize model. Only sensible if we're
  committed to a canvas editor but want off Silex specifically.
- **Payload CMS** (MIT core) — real in-context visual editing is **enterprise-gated**; OSS is
  iframe live-preview + block fields. It's a CMS, not a page builder. Could be a content
  backend, not the editing surface.
- **Plasmic** (AGPL) — the studio effectively requires their cloud; self-host is partial.
  Treat as SaaS.
- **VvvebJs** (MIT) — Bootstrap-coupled; EAC is Mantine. Static HTML out. Niche.
- **Builder.io** — SaaS, no self-hostable core. Out on R1.
- **Onlook** (AGPL) — "Cursor for design," edits your React *source*. Wrong model — that's
  developer tooling, not end-user content editing.

---

## Recommendation

**Don't rip out Silex. Do stop treating it as the default.**

1. **Substrate is the durable asset.** Templates as declared sections + typed fields + the
   binding engine + formatters survive any editor choice. Keep investing there (finish the
   binding migration, wire `validate:template` into CI). Everything below is a *consumer* of it.

2. **Tier 3 = Silex, unchanged.** Power users, the dedicated sites already on it, and the
   desktop-app path. The Phase 0 work stands.

3. **Tiers 1–2 = spike Puck.** Build one real template as a Puck `config` — the workshop
   sections as Puck components, `fieldRegistry` entries as Puck fields, two or three
   `<eac-embed>` components as native Puck components — rendered inside arts-collective, data
   in Nextcloud. A few days. It directly tests the claim that Puck *is* the authoring model
   EAC has been approximating, and it's cheap to abandon if it isn't.

4. **The wizard (`cms-ui/wizard`) is still worth wiring regardless** — it's the pure-form
   Tier 1 for owners who want zero canvas, and it reads the same manifest. Puck and the wizard
   are not exclusive; they're two renderers of one substrate, same as Silex.

5. **MCP:** unchanged from the review. Our server-side MCP over the substrate is the
   high-value build and is **editor-agnostic** — it composes sections/props, which is a Puck
   `config` or a Silex `website.json` or a wizard payload. Build it against the substrate, not
   against an editor.

The one-line version: **EAC's problem was never "which canvas" — it's that the constrained,
form-shaped path was never the front door. Puck is the tool whose defaults match that path;
Silex is the tool whose defaults fight it.**

---

---

## Appendix: "what if we went the GitLab + 11ty way?" (2026-09-06)

Silex's own blessed pipeline is: **GitLab storage** (project = a git repo, save = a commit) →
**GitLab Pages hosting** (publish writes a `.gitlab-ci.yml`, commits, tags; the tag triggers a
pipeline that runs `npx @11ty/eleventy` and deploys `public/`). Worth taking seriously — it is
what v3.silex.me and the CapRover app do.

### What EAC would gain
- **Real version history.** Every save a commit; diff, blame, rollback. Today an owner who
  wrecks a page has only in-editor undo, lost on reload. This is the single biggest win.
- **Transparent, reproducible publishes.** The CI file + 11ty input are inspectable artifacts.
- **A mature SSG.** 11ty already does pagination, collections, i18n — a superset of what the
  binding engine reimplements.
- **Free CDN/TLS/custom-domain static hosting**, and no request-time WebDAV fetch from Nextcloud.
- **Silex's data-source feature becomes usable** (visual GraphQL binding, loops, live preview).

### What breaks — the crux
EAC's premise is *static skeleton + live React islands*. GitLab Pages is pure static, and
11ty resolves data at **build** time. Of the 12 `<eac-embed>` components:

| can't be static (per-viewer / auth) | wants fresh data (would go stale) | genuinely static-safe |
|---|---|---|
| `login`, `media-upload` | `org-feed`, `workshop-cards`, `rsvp`, `community-feed`, `countdown`, `directory` | `poll`, `resources`, `live`, `inquiry`\* |

\* `inquiry` survives as a plain form POST to a Next route.

So the middle column — six embeds, including **RSVP counts and the next-session date** — only
updates when someone re-publishes or a scheduled pipeline runs. For orgs coordinating
gatherings, a stale calendar is a real failure, not a cosmetic one. You'd claw it back with
hourly rebuild pipelines: a lot of machinery to approximate what request-time rendering gives
for free.

Then the infra: **self-hosted GitLab is one of the heaviest things you can run** (Rails +
Postgres + Redis + Sidekiq + Gitaly + a registry + CI runners; ~4GB idle). On a stack that is
already ~12 Next apps + Postgres + Nextcloud + Redis + Supabase, that roughly doubles the
operational surface. Using gitlab.com instead puts org content on someone else's servers —
against the whole point. Publishing also goes from "~2s WebDAV write" to "commit, tag, wait for
a `node:20` container, npm, 11ty, deploy" — minutes, and fallible (the 3.10 canary release notes
are literally GitLab-publish reliability fixes).

### Recommendation: take the git, leave the GitLab

**Don't adopt the pipeline. Do adopt version control.**

1. **Git-backed storage, not GitLab.** Write a `GitStorage` connector alongside the Nextcloud
   one that commits `website.json` to a plain bare repo on the EAC box (or **Gitea** — a ~30MB
   Go binary, not GitLab's Rails stack). That buys history/diff/rollback — the biggest win —
   at near-zero infra cost. Note Silex 3.9 ships **GitLab-specific connectors only**, no generic
   git connector, so this is ours to write (like the Nextcloud one). Silex 3.10's
   "version websites with git on every save" is heading the same direction.
2. **Keep request-time rendering and the binding engine.** Live islands stay live, data stays
   fresh, no build step, no CI.
3. **11ty is not needed as a serving model.** `unstable_cache` already does the caching job
   with far less machinery.
4. **Keep the GraphQL/data-source path as a per-org opt-in** for orgs binding to a real external
   CMS — and note it does *not* require 11ty-in-CI: LiquidJS is an npm package, so
   `silex-render` could resolve those expressions at request time too, the same way it resolves
   manifest bindings today.

One-line version: **the GitLab+11ty pipeline is built for agencies shipping static client
brochures. EAC is building community apps with RSVP, feeds and per-viewer state — the opposite
of static. Borrow its version control; don't inherit its build model.**

---

## Sources

- [Puck — github.com/puckeditor/puck](https://github.com/puckeditor/puck) · [docs](https://puckeditor.com/docs) · [CSS-variable theming](https://puckeditor.com/blog/using-css-variables-to-create-dynamic-themes-in-puck)
- [Top 5 Page Builders for React in 2026 — DEV](https://dev.to/fede_bonel_tozzi/top-5-page-builders-for-react-190g)
- [GrapesJS vs Webflow vs Builder.io vs Puck — GJS.Market](https://gjs.market/blogs/grapesjs-vs-webflow-vs-builderio-vs-puck-which-visual-builde)
- [Self-Hosted Landing Page Builders: GrapesJS vs Silex vs VvvebJs — Pi Stack](https://www.pistack.xyz/posts/2026-06-18-self-hosted-landing-page-builders-grapesjs-silex-vvvebjs/)
- [Webstudio — github.com/webstudio-is/webstudio](https://github.com/webstudio-is/webstudio) · [review](https://aisotools.com/blog/webstudio-review-2026)
- [Payload CMS Review — The DXP Scorecard](https://www.dxpscorecard.com/platform/payload-cms) · [Live Preview docs](https://payloadcms.com/docs/live-preview/client)
- [Plasmic self-host thread — Plasmic forum](https://forum.plasmic.app/t/is-plasmic-studio-open-source-and-can-i-self-host/11224)
- [Best Open Source Website Builders 2026 — opensourcealternatives.to](https://www.opensourcealternatives.to/blog/best-open-source-website-builders)
