# How EAC should let people edit their own sites — a review of the Silex approach

Date: 2026-09-05
Scope: review of the current Silex usage, outside perspective on whether it's the right
shape for EAC's actual users, and a recommended setup (including where MCP pays).

---

## 1. Where things actually stand

EAC has ended up with **four** authoring paths. That is the finding that matters most.

| path | what it is | status |
|---|---|---|
| **Silex** (`:6805`) | Full freeform visual editor. Drag/drop, style manager, CSS classes | **Shipped and used** — hidden-enneagram, opt-in per-org layouts |
| **live-editor** (`@elkdonis/live-editor`) | In-place edit popovers on a rendered page, driven by `fieldRegistry` | **Shipped and used** — arts-collective (`WorkshopLiveEditor`, `AppearancePanel`, profile pages), artdirect |
| **cms-ui wizard** (`packages/cms-ui/src/wizard/`) | Step-by-step form derived from template manifests | **Built. Consumed by nothing.** No app imports it |
| **binding engine** (new, today) | Manifest-declared bindings resolved server-side | Shipped for workshop; other templates pending |

So the most constrained, least intimidating authoring path — the wizard — is the one nobody
can reach, while the most demanding one — Silex — is the one that's had the most engineering
attention. `arts_collective_cms_state` already recorded that the wizard "hasn't fully worked"
for five reasons; it has since been rebuilt (`workshop_wizard_foundations`) and still isn't
wired to a surface.

**Silex's own footprint is also narrower than the effort suggests.** It is: one dedicated site
(hiddenenneagram.com), plus `layout_mode='silex'` as an opt-in override on arts-collective org
pages. Four templates exist (workshop 10 sections, dossier 6, enneagram 20, portfolio 8), and
of those, only the enneagram one has a real published site behind it.

---

## 2. What outside perspective says

The consistent external critique of GrapesJS-based editors lands directly on EAC's audience —
spiritual communities, artists, small collectives:

- **"GrapesJS feels too advanced for non-technical users"** — flex properties, CSS classes, and
  units like px/vh are the specific blockers named
  ([Talentica](https://www.talentica.com/blogs/grapesjs-things-to-consider-before-using-it/)).
- **"The biggest mistake teams make with GrapesJS is treating it as a finished product when
  it's actually an engine."** Silex is a thin app around GrapesJS, so it inherits this
  ([GJS.Market guide](https://gjs.market/blogs/grapesjs-the-complete-guide-to-the-open-source-web-builder-f)).
- Silex itself reviews well (4/5, OW2 Best Project 2026) but with **"a steep learning curve for
  beginners"** ([NoCodeMentor](https://www.nocodementor.io/blog/silex-review),
  [SourceForge](https://sourceforge.net/software/product/Silex-Website-Builder/)).
- **Locking down editing is a known weak spot.** Restricting edits to designated regions has
  been an open request for years; `editable: false` reportedly works inconsistently
  ([#263](https://github.com/GrapesJS/grapesjs/issues/263),
  [#422](https://github.com/GrapesJS/grapesjs/issues/422),
  [#3192](https://github.com/GrapesJS/grapesjs/issues/3192)). This matters because "give them
  Silex but lock it down" is the obvious mitigation — and it's the thing the engine is worst at.
- **Performance**: past a few thousand DOM nodes, change tracking and undo history lag
  ([Mindful Chase](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/enterprise-grade-troubleshooting-for-grapesjs-front-end-framework.html)).
  The 20-section enneagram template is the one to watch.
- The 2026 landscape splits on SaaS vs self-hosted; GrapesJS is positioned as **"for teams
  building their own visual editor product"**, while Puck is the embeddable-into-your-React-app
  option ([GJS.Market comparison](https://gjs.market/blogs/grapesjs-vs-webflow-vs-builderio-vs-puck-which-visual-builde),
  [DEV: Top 5 React page builders](https://dev.to/fede_bonel_tozzi/top-5-page-builders-for-react-190g)).

**The central mismatch:** the tool everyone reaches for first is the one the audience is least
equipped to use, and the safety rail that would fix that (locked regions) is the part of the
stack with the weakest support.

**The reassuring part:** EAC has already independently built the right answer. Templates with
fixed sections, `data-trait` hooks as designated editable regions, a manifest-driven field
registry with typed inputs, in-place popovers, `mode=simple`. That *is* the constrained
authoring model the critique implies. It just isn't the default path.

---

## 3. Recommended shape: tier the editors, don't pick one

Rather than "is Silex right?", the question is "right for whom?". Three tiers, one shared
substrate (templates + manifest + binding engine).

### Tier 1 — Forms, not canvas *(the default; most owners)*
Wizard + live-editor over the manifest. No drag/drop, no CSS, no style manager. The owner
answers questions and edits text in place on the real page. Everything they can change is a
declared field.

*This tier is ~80% built and 0% wired.* `cms-ui/wizard` needs a surface, and it should be the
default when an org is created — Silex should be something you opt *into*, not the first thing
you meet.

### Tier 2 — Silex, constrained *(confident owners)*
Silex with the section blocks, `mode=simple`, style manager hidden, template sections
`draggable`/`droppable: false` (the connector already sets `droppable: false` on template
types). Owners rearrange and swap sections; they do not author CSS.

Given the locking weaknesses upstream, treat this tier as **"compose from our blocks"**, not
"free canvas with guardrails" — the guardrails are not reliable enough to be the safety story.

### Tier 3 — Silex, full *(power users, and us)*
What exists today. Fine as-is. This is also where the **desktop app** belongs — see §5.

---

## 4. Templates are the real bottleneck

A template is what defines what an org *can say*. Tiers 1 and 2 are only as good as the
template catalogue, and today that's four templates, one of which (portfolio) has no published
site and one (dossier) is bound to a single use case.

This is the strongest argument for MCP help: **not editing pages, but authoring templates.**
Each new template is currently a hand-written manifest + 6–20 HTML sections + namespaced CSS +
tokens, and every one of those has to stay in sync — which is exactly the drift the new
`validateBindings` now catches.

---

## 5. Where MCP pays, and the desktop idea

### Our own MCP (server-side) — the high-value one
Operates on `website.json` through the existing Nextcloud path. Two tool sets:

**Page composition** — closed vocabulary (44 sections, 11 embed components, ~70 traits, all
enumerable from manifests we already ship). A small local model does this reliably because it
selects from lists rather than generating markup.

**Template authoring** — `scaffold_template`, `write_section`, `validate_template`,
`preview_section`. `validate_template` is load-bearing twice over: it closes the
generate→check→fix loop that makes a small model viable, and it doubles as an **auto-scorer**
for an eval harness.

Honest expectation: a small model is reliable at *mechanical correctness* (hooks, bindings,
manifest wiring, fixing validation errors) and at *template variation* (workshop → a
restructured variant). It is weak at novel layout and aesthetic judgement. That division —
human or larger model decides design, small local model does the wiring — removes most of the
tedium, which is where the real cost sits.

### The desktop idea — storage question now answered (2026-09-06): it does NOT reach server sites

Silex Desktop is **built on a different server**: Tauri v2 + the `silex-server` **Rust** crate,
not the Node `@silexlabs/silex` package we run. The Rust server "drop[ped] the SaaS connector
abstraction" (v3.10 canary notes) and edits **local files only** — no `SILEX_SERVER_CONFIG`,
no Node connectors. Our Nextcloud connector cannot load into it. Its MCP (`localhost:6807`)
operates on whatever local project the desktop editor has open.

So option (1) below is **not available**. What remains:

1. ~~Desktop loads our Nextcloud connector~~ — **ruled out**: different (Rust) server, local files only.
2. **Nextcloud desktop sync.** Sync the org's `…/silex/` folder to the machine, open the local
   `website.json` in Desktop, edit (with its MCP), save, let sync carry it back; "Publish" in
   Desktop writes `published/*.html` locally, which also syncs. Works today, no code — but:
   the org's project is stored under the *owner's* Nextcloud account, so you need that
   account's credentials or a share on your machine; the folder layout must match what our
   renderer expects (`silex_published_path` on the org row); and simultaneous server-side
   edits conflict.
3. **Build our own server-side MCP** (§ below) — the clean answer.

**Desktop's real value** is therefore the full *offline* editor for power users editing a
local copy, not remote editing of live org sites. Keep it as a Tier 3 convenience; don't
design the MCP story around it.

Caveat: Silex's MCP speaks *generic GrapesJS* (selectors, styles, components). Ours would speak
*EAC* (sections, traits, embeds, templates). For helping someone edit their own site, ours is
the better fit precisely because it's narrower. They are complements, not substitutes.

---

## 6. What I'd do next, in order

1. **Wire the wizard.** `cms-ui/wizard` → a real surface, as the default authoring path for a
   new org. Highest value per hour; the work is already paid for.
2. **Finish the binding migration.** Port dossier/enneagram/portfolio manifests to `bindings`;
   add `list` hooks to schedule/gallery and delete `buildScheduleHtml`/`buildGalleryHtml`;
   put `validate:template` in CI. This is the substrate all three tiers stand on.
3. **Decide the two open template bugs** the validator surfaced: `roleTitle` / `websiteUrl`
   hooks with no backing column (add columns, or delete the hooks).
4. **MCP vertical slice** — `list_sections` / `add_section` / `set_text` / `validate` /
   `publish` against one real org. Enough to feel whether a local model is useful here.
5. **Desktop spike** — does Silex Desktop load `SILEX_SERVER_CONFIG`? Half a day, and it
   settles the whole Tier 3 story.
6. **Then** template-authoring tools, informed by 4 and 5.

Phase 2 (CSS variables) slots in alongside 2 — it's what lets one template serve many orgs, and
it reduces how much CSS a new template has to invent.

---

## Sources

- [GrapesJS: Things To Consider Before Using It — Talentica](https://www.talentica.com/blogs/grapesjs-things-to-consider-before-using-it/)
- [GrapesJS Complete Guide 2026 — GJS.Market](https://gjs.market/blogs/grapesjs-the-complete-guide-to-the-open-source-web-builder-f)
- [GrapesJS vs Webflow vs Builder.io vs Puck — GJS.Market](https://gjs.market/blogs/grapesjs-vs-webflow-vs-builderio-vs-puck-which-visual-builde)
- [Silex Review — NoCodeMentor](https://www.nocodementor.io/blog/silex-review)
- [Silex Reviews — SourceForge](https://sourceforge.net/software/product/Silex-Website-Builder/)
- [Enterprise-Grade Troubleshooting for GrapesJS — Mindful Chase](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/enterprise-grade-troubleshooting-for-grapesjs-front-end-framework.html)
- [Top 5 Page Builders for React in 2026 — DEV](https://dev.to/fede_bonel_tozzi/top-5-page-builders-for-react-190g)
- GrapesJS component-locking issues: [#263](https://github.com/GrapesJS/grapesjs/issues/263), [#422](https://github.com/GrapesJS/grapesjs/issues/422), [#3192](https://github.com/GrapesJS/grapesjs/issues/3192)
