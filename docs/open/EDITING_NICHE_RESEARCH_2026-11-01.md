# Editing niche research: constrained visual editing over a design system

As of 2026-11-01. Research only. No code changed. Prepared for the direct-editing plan
(`DIRECT_EDITING_PANEL_PLAN_2026-11-01.md`).

## Conclusion

The niche is real but crowded at the "content only" end and thin at the "style, within limits" end. Almost every
product offers two modes: a designer who can change everything, and an editor who can change text, images and
CMS fields (Webflow, Framer, Wix Studio, Figma Sites, Storyblok, Sanity, Plasmic). The few products that let a
non-designer touch style do it with an on/off switch per property: Builder.io design tokens with strict mode,
WordPress `theme.json` settings, Plasmic "styling by section". I found no product that offers a graded dial
(Family / Borrow / Free) with out-of-range values flagged instead of blocked. I also found none that lets a tenant's
template or override be reviewed and promoted into a network-wide template with provenance, and none with a
group-curated font library that spans sites. The nearest neighbours are WordPress (patterns, a volunteer-moderated
public Pattern Directory, `theme.json`) and Plasmic (content-creator mode, MIT code with an AGPL platform).
"Not found" here means not found in this search, not proven absent. For the build, nothing needs to be adopted
wholesale. Puck stays as the page builder. Most of the useful parts are small MIT libraries, and two of them
(Tiptap, dnd-kit) are already inside Puck's dependency tree.

## 1. Comparison table

"Verified" means I opened a page that says it. Items marked *(snippet)* come from a search result only, because the
page was blocked or not opened. Items marked *(not verified)* I could not confirm at all.

| Product | How edits are constrained | Per-tenant templates / promotion / review | Versioning | Fonts | Licence |
|---|---|---|---|---|---|
| **Webflow** | Designer (classes, variables, components) vs a Content editor / "Can edit" role that has limited design permissions. The legacy Editor was retired 4 Aug 2026; content editing moves on-canvas *(snippet, secondary sources)*. Components expose variants, properties, slots *(snippet)*. | Not verified. | Not verified. | Google and Adobe integrations; custom upload TTF/OTF/WOFF/WOFF2, 4 MB per file; variable fonts need custom upload *(snippet)*. | Closed SaaS. |
| **Framer** | On-page editing for people with Content permission: text, rich text, images, component properties, CMS. Designers lock layers (Cmd+L). Editors can reorder and swap component variants (Apr 2026). Editors cannot edit layout templates, and need publish permission to publish. | Marketplace of free and paid templates (storefront; review process not verified). | Version History snapshots: 5-minute for 4 h, hourly for 24 h, then daily; staging with manual version pick *(snippet)*. | Not covered. | Closed SaaS. |
| **Builder.io** | Design tokens per CSS property; **strict mode** removes every style without a token; tokens can vary by model, space, role or permission. Components-only mode. Custom roles are an Enterprise add-on *(snippet)*. | Models limit where a component appears. Approval workflow is Enterprise *(snippet)*. | Not verified. | Via tokens (`fontFamily` can be tokenised). | Repo MIT (SDKs, examples); editor is hosted and closed. |
| **Plasmic** | **Content creator mode**: only existing components, free-form styling hidden, tokens and presets hidden. Each component is opt-in editable. Styling can be enabled "by section" per workspace. | Components are shared per project/workspace. No promotion pipeline seen. | Retention 14 to 180 days by plan (pricing page; mapping to plans inferred). | Not covered. | Repo MIT outside `platform/`; `platform/` is AGPL. Content creator mode is a paid tier (Scale per pricing page; docs disagree). |
| **Storyblok** | Visual editor with click-to-edit via a bridge. Edits content fields. Custom roles can allow or deny per folder, story, block, **block field**, asset and the Visual Editor itself. Deny wins. | Block library is per space. Not verified further. | Draft content; Releases app; preview can target a release. | Not covered. | Closed SaaS; SDKs MIT (npm). |
| **Sanity** | Presentation tool: live preview, click-to-edit overlays, drag to reorder content sections. Edits content, not style. | Not applicable (content model is yours). | Drafts; Releases exist. Detail not verified. | Not applicable. | Studio MIT (npm); hosted Content Lake is closed. |
| **TinaCMS** | Live site beside the editor, content hydrated with `useTina`. Content only. | Not verified. | Not verified. | Not applicable. | Apache-2.0 (npm). |
| **Payload** | Live preview in an iframe via `postMessage`. No click-to-edit on that page. A "Visual Editor" is listed as an Enterprise feature; no detail seen. | Not applicable. | Not verified here. | Not applicable. | MIT (npm). |
| **WordPress block editor** | `theme.json` switches controls on or off: `color.custom`, `typography.customFontSize`, `fontFamilies` presets, `spacing`, `border`, `layout.allowEditing`. Opt-in per feature, and a block must implement it. `template_lock` = `all` / `insert` / `contentOnly`; per-block `lock` (`move`, `remove`) overrides it. | **Patterns** and **synced patterns** (edit once, updates everywhere; "Detach" makes a local copy, unless locked). Public **Pattern Directory**, moderated by volunteers; theme-specific and trivial patterns discouraged. | Post revisions (not opened). | Presets in `theme.json`; Font Library since 6.5 installs and self-hosts fonts *(snippet)*. | GPL, open source. |
| **Squarespace Fluid Engine** | Free placement on a background grid (1000-row section limit). Mobile layout is arranged and sized separately from desktop. Site Styles for fonts and colours *(not opened)*. | Templates are Squarespace's own. | Not verified. | Not verified. | Closed SaaS. |
| **Wix Studio** | Clients get **Content mode** (text and media only) or **Full mode** limited by role; restricted areas are greyed out; permissions can be set per page. Site typography = 9 text styles (6 headings, 3 paragraphs). | An element override can be pushed to the site-wide text style with **Update Styles**. Within one site only. | Not verified. | Site Styles Typography tab; fallback-font option; custom upload not covered on that page. | Closed SaaS. |
| **Notion Sites / Super** | Notion Sites: theme light/dark, header links, favicon, share image, analytics. Very little visual control. Super: theme builder (colours, fonts, layout, navbar, footer) over Notion content; themes can be created, copied, previewed. | Super: themes reusable across your sites. | Not mentioned. | Part of Super's theme builder. | Closed SaaS. |
| **Figma Sites** | Layout "stays locked" while collaborators update content in a CMS view. | Not mentioned. | Not mentioned on the page. | Not covered. | Closed SaaS. |
| **GrapesJS / Silex** | GrapesJS StyleManager: sectors and typed properties (number, select, composite, stack, colour); a component can limit its properties with `stylable` / `unstylable`. Silex is a GrapesJS-based builder that outputs static HTML/CSS. | Silex binds components to WordPress, Strapi, GraphQL. No review pipeline. | Not covered. | Not covered. | GrapesJS BSD-3-Clause (npm; GitHub shows "other"); Silex AGPL-3.0. |
| **Puck** (ours) | `permissions` for `delete`, `drag`, `duplicate`, `edit`, `insert`: global, per component, or per instance via `resolvePermissions`; `resolveFields` makes fields dynamic. 0.24.0 (29 Oct 2026) adds field groups and tabs, `renderFields`, and hiding fields from overrides. | None built in. | None built in (we overwrite today). | None built in. | MIT. We are on 0.23; 0.24.0 is out. |
| **Craft.js** | Framework only, no UI. State serialises to JSON. Rules (`canDrag`, `canDrop`) not confirmed on the page I opened. | None. | None. | None. | MIT (npm). Last release 0.2.12, 2025-02-14. |

## 2. What is open, and what is not

**Not open (others do it, or are close):**
- Role-based "content only" editing. Every hosted builder has it. Do not pitch this.
- Click-to-edit overlays over a live site. Storyblok, Sanity, Framer and Webflow all ship it.
- Reusable components with exposed properties. Webflow, Plasmic, Framer, WordPress patterns.
- Per-property switches for style. Builder strict-mode tokens and `theme.json` already do this.

**Open (my reading of the evidence):**
1. **A graded constraint dial that flags rather than blocks.** Existing systems either hide a control or show it.
   None showed "this value is outside your family, here it is in amber, snap back with one click." Builder and
   WordPress are the closest, and both are on/off per property. Honest limit: this is a refinement of known ideas,
   not a new category.
2. **Review and promotion of tenant work into a shared catalogue.** WordPress has a moderated public directory,
   but it takes HTML block markup from individuals, not an organisation's reviewed override with provenance.
   Framer and Webflow have marketplaces, which are storefronts. Wix can promote an override to a style, but only
   inside one site. A network of small member sites, where a good local template becomes everyone's template, was
   not found. This is the strongest argument for EAC, because it needs a tenant network, which a single-site
   builder does not have.
3. **Edits stored as template + overrides, not HTML.** Silex outputs HTML/CSS. The headless CMS tools store
   content, not style. Puck stores props. Storing style overrides against a template inside a family, so that
   improving the template improves every page, was not found as a product behaviour. It is what makes promotion
   (point 2) possible, so the two belong together.
4. **A font library the group curates.** WordPress, Webflow and Wix handle fonts per site or per workspace.
   A shared, approval-gated library across member sites was not found.

**Risks to be honest about:**
- Plasmic is the closest commercial relative. Its content-creator mode already hides free-form styling and lets an
  admin switch styling on by section. If Plasmic's MIT/AGPL code were a better base than Puck, that would change
  the build-vs-adopt call. I did not evaluate that; our stack and tenancy model point away from it.
- Puck is moving toward more editor customisation (0.24 field groups, tabs, hide-fields override). Some panel work
  in Phase 5 may get easier by upgrading.
- Webflow's editor change (legacy Editor retired Aug 2026, on-canvas editing instead) shows the big vendors are
  also moving toward click-on-the-page editing for non-designers. The gap is the constraint model, not the click.

## 3. Reusable open-source parts

Dates are the latest npm release (checked 2026-11-01) unless noted. "Fit" is about our plain-DOM direct-edit package.

| Part | Licence | Last release | Status | Fit |
|---|---|---|---|---|
| **Tiptap** (`@tiptap/core`, `react`, `pm`, extensions `bubble-menu`, `text-style`, `color`, `font-family`, `text-align`, `link`) | MIT. Pro extensions (comments, AI, version history, collaboration) are paid; avoid them. | 3.32.2, 2026-10-30 | Very active | **Strong.** Headless, on ProseMirror. Puck 0.24 already depends on Tiptap, so one engine for both. Mount on demand over a text part. |
| **Lexical** | MIT | 0.53.0, 2026-10-28 | Very active, still 0.x | Alternative. Different engine from Puck's, so more weight for no gain. |
| **ProseMirror** (`prosemirror-view`) | MIT | 1.42.9, 2026-10-31 | Very active | Use through Tiptap, not directly. |
| **Floating UI** (`@floating-ui/dom`, `react`) | MIT | 1.8.0 / 0.27.20, 2026-07-11 | Active | **Strong.** Vanilla DOM package fits our plain-DOM code. Middleware (offset, flip, shift, size) and virtual elements suit a toolbar placed beside a selection and "labels outside the box". |
| **Moveable** | MIT | 0.53.0, 2023-12-03 (repo push 2024-06-03; ~450 open issues) | Quiet | Capable (drag, resize, rotate, snap, group; vanilla and React builds). Quiet for 2+ years. Only worth it for Free-level absolute/rotate handles; our own span handles already work. |
| **Selecto** | MIT | 1.26.3, 2023-12-03 (repo push 2024-06-17) | Quiet | Marquee select; we do not need it. |
| **interact.js** | MIT | 1.10.28, 2026-08-01 | Slow but alive | Lighter drag/resize primitive without UI. Optional. |
| **dnd-kit** | MIT | `@dnd-kit/core` 6.3.1 (2024-12-05, old line); `@dnd-kit/react` 0.5.3 (2026-10-31, new line, still 0.x) | New line active | Puck 0.24 already uses the new line. Use through Puck; do not add a second DnD library to Puck pages. |
| **Pragmatic drag and drop** (Atlassian) | Apache-2.0 (npm; the repo page I opened did not name it) | 4.0.0, 2026-09-24 | Active; GitHub is a one-way mirror, no code contributions | Framework-agnostic, ~4.7 kB core. Best fit for a reorderable layer tree in plain DOM. |
| **react-colorful** | MIT | 5.8.1, 2026-09-01 | Active | Good if the panel is React. Our panel is plain DOM, so keep `<input type=color>` + hex and add a Theme tab (already planned). |
| **colord / culori / color2k** | MIT | colord 2.10.0 (2026-08-20), culori 4.0.2 (2025-06), color2k 2.0.4 (2026-07) | Active | Colour maths for tints, OKLCH, hex parsing. Keep our own WCAG `contrastRatio`. Avoid `apca-w3` ("Limited W3 License"). |
| **css-tree** | MIT | 3.2.1, 2026-03-05 | Active | **Strong for sanitising declarations.** Parser, walker, and `lexer.matchProperty` checks a value against the property's real syntax. Use under our allow-list (`safeDecls`); keep the rule "no `url(`, `@import`, `image-set`". |
| **DOMPurify** | Apache-2.0 or MPL-2.0 | 3.4.17, 2026-10-12 | Very active | For rich-text **HTML** only (the Tiptap output). It is not a CSS value validator. |
| **Immer** (`produceWithPatches`, `applyPatches`) | MIT | 11.2.9, 2026-10-22 | Very active | **Strong.** Returns next state, patches and inverse patches: undo/redo and a compact change list per revision. Patches are correct but not minimal. |
| **Yjs** (`UndoManager`) | MIT | 13.6.33, 2026-09-23 | Active | Only worth it for live co-editing. UndoManager works on Yjs shared types, so we would have to model the doc as Y types. Hocuspocus 4.8.0 (MIT) is the server. Not needed now. |
| **Automerge** | MIT | 3.5.0, 2026-09-16 | Active | Same verdict as Yjs; heavier than we need. |
| **GrapesJS** | BSD-3-Clause | 0.23.8, 2026-10-15 | Active | Port ideas, not code (below). |
| **Craft.js** | MIT | 0.2.12, 2025-02-14 | Quiet | Skip. Puck covers the same ground. |
| **tldraw** | Custom licence ("see LICENSE.md") | 5.6.0, 2026-10-28 | Active | Skip; licence needs reading before any use. |
| **Fontsource** (`@fontsource/*`) | OFL-1.1 per package | 5.3.0, 2026-07-19 | Active | Self-hosted font files as npm packages. Useful source for the curated library. |
| **opentype.js / fontkit** | MIT | 2.0.0 (2026-05-06) / 2.0.4 (2024-08-09) | Active / quiet | Read the name table and OS/2 flags of an uploaded font to prefill the licence check and the family name. |
| **Google Fonts developer API** | Fonts are OFL or Apache; API terms not opened | n/a | Active | `webfonts` list gives family, variants, subsets, file URLs, category, `lastModified`; `capability=VF` adds axes. Needs an API key. We already generate our 503-family list. |

**GrapesJS internals worth porting (concepts, from the docs I opened):**
- StyleManager's **sector / property schema**: typed properties with a fallback type, and `extend` from a built-in
  registry. This maps directly onto our slot schema.
- **Composite** (shorthands such as margin, per-side padding) and **stack** (repeated values such as shadows)
  property types. We need both for per-side padding, per-corner radius and shadows.
- **Per-component `stylable` / `unstylable`** lists and hiding sectors that have no visible property. This is the
  same idea as "a member never sees z-index on an ad title".
- The **custom UI hook** (`custom: true` plus events). Confirms that the model should be separate from the panel UI.
- LayerManager: `custom` mode with events, `sortable` and `hidable` flags, and a configurable root so the tree can
  show a subtree. The per-layer fields (locked, open, names) were not on the page I opened, so check the source.

### Short list to adopt

1. **Tiptap** (MIT parts only) for rich text and the floating text toolbar, on the same engine Puck already ships.
2. **Floating UI** (`@floating-ui/dom`) for toolbar, context menu, popover and font-picker placement.
3. **Immer patches** for undo/redo and for storing each revision as a patch list beside the full doc.
4. **css-tree** for validating style values under the existing allow-list; **DOMPurify** for rich-text HTML.
5. **Pragmatic drag and drop** for the layer tree only (if built); leave Puck's dnd-kit alone.
6. Upgrade **Puck 0.23 to 0.24** when Phase 5 starts.
7. **Not now:** Moveable, Selecto, Craft.js, Yjs, Automerge, tldraw.

## 4. Font licensing for a group-curated library

- **Google Fonts are OFL (or Apache 2.0).** The OFL FAQ says fonts can be used on websites through `@font-face`
  and hosted on your own site, and used in print, logos and graphics. They may not be sold alone; they must come
  bundled with software or other fonts. Copyright notices and licence text should travel with the files.
- **Modification matters.** Per the OFL FAQ, converting to WOFF without other changes is fine, but subsetting and
  conversion to EOT and similar formats count as modification, and then a font with a Reserved Font Name must not
  keep that name. Safest route: serve the unmodified files (or Google's own CSS) and do not subset ourselves for
  fonts that declare an RFN.
- **Self-host rather than call Google.** Loading from Google's servers sends the visitor's IP to Google. A Munich
  court (LG Munich, 20 Jan 2022) awarded EUR 100 over this. Reports I read are commentary, the point is disputed,
  and I did not check later CJEU outcomes. It is still a cheap risk to remove for EU visitors. Our public
  classifieds page currently uses Google's CSS URL; switching to files copied into our own storage (Fontsource or the
  `google/fonts` repo) removes it.
- **Uploads need a licence gate.** A commercial desktop licence is not a web licence. Require: a licence field
  (OFL / Apache / commercial-web / other), who uploaded it and the file source, an attestation that they may
  distribute it, WOFF2 only, a size cap (Webflow uses 4 MB), and admin approval before it appears in the shared
  library. Keep the licence file with the font. Read the name table and OS/2 embedding flags to prefill and
  to warn. Provide a removal path, because a licensor can complain.
- **Adobe and similar subscription fonts cannot be re-hosted** by us; leave them out of a shared library.
- **Record per font:** family, source, licence id, licence file, RFN flag, added by, approved by, date. This is the
  table behind `font_library` in the plan.

## Not verified (say so if asked)

Webflow classes/components/backups; Builder versioning; Squarespace version history and Site Styles; Wix versioning;
TinaCMS storage model; Payload's Visual Editor; Google's current Fonts terms page (the pages I opened did not show
them); plan prices change often and were read only where cited.

## Sources

**Pages opened (fetched), as of 2026-11-01**
- Webflow, "Webflow Editor roles now more powerful" (Red Shark Digital): https://redsharkdigital.com/news/webflow-editor-roles-now-more-powerful
- Flow Ninja, Designer vs Editor: https://www.flowninja.com/blog/webflow-designer-webflow-editor-cms-whats-the-difference
- Webflow Designer API intro: https://developers.webflow.com/designer/reference/introduction
- Framer on-page editing help: https://www.framer.com/ja/help/articles/on-page-editing/
- Framer layer locking and reordering (CreateWith, 17 Apr 2026): https://www.createwith.com/tool/framer/updates/framer-enhances-on-page-editing-with-drag-and-drop-reordering-and-layer-locking
- Framer Marketplace templates: https://www.framer.com/marketplace/
- Builder.io design tokens: https://builder.io/c/docs/design-tokens
- Builder.io repo: https://github.com/BuilderIO/builder
- Plasmic pricing: https://www.plasmic.app/pricing
- Plasmic repo: https://github.com/plasmicapp/plasmic
- Plasmic content creator mode: https://docs.plasmic.app/learn/content-creator-mode/
- Storyblok Visual Editor: https://www.storyblok.com/docs/concepts/visual-editor
- Storyblok roles: https://www.storyblok.com/docs/concepts/roles
- Sanity visual editing: https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing
- TinaCMS visual editing: https://tina.io/docs/tinacms-context/
- Payload live preview: https://payloadcms.com/docs/live-preview/overview
- WordPress block templates and locking: https://developer.wordpress.org/block-editor/reference-guides/block-api/block-templates/
- WordPress global settings and styles: https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/
- WordPress theme.json reference: https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/theme-json-living/
- WordPress synced patterns: https://wordpress.org/documentation/article/reusable-blocks/
- WordPress Pattern Directory about: https://wordpress.org/patterns/about/
- Squarespace Fluid Engine help: https://support.squarespace.com/hc/articles/6421525446541
- Wix Studio, how clients edit: https://support.wix.com/en/article/studio-editor-understanding-how-clients-edit-their-site
- Wix Studio site typography: https://support.wix.com/en/article/studio-editor-working-with-site-typography
- Notion Sites customise: https://www.notion.com/help/edit-and-customize-your-notion-sites
- Super features: https://super.so/features
- Figma Sites: https://www.figma.com/sites
- Silex repo: https://github.com/silexlabs/Silex
- GrapesJS repo: https://github.com/grapesjs/grapesjs
- GrapesJS Style Manager: https://grapesjs.com/docs/modules/Style-manager.html
- GrapesJS Layers: https://grapesjs.com/docs/modules/Layers.html
- Puck releases: https://github.com/puckeditor/puck/releases
- Puck permissions: https://puckeditor.com/docs/api-reference/permissions
- Puck component config: https://puckeditor.com/docs/api-reference/configuration/component-config
- Craft.js overview: https://craft.js.org/docs/overview
- Tiptap introduction: https://tiptap.dev/docs/editor/introduction
- Floating UI: https://floating-ui.com/docs/getting-started
- Moveable repo: https://github.com/daybrush/moveable
- Pragmatic drag and drop repo: https://github.com/atlassian/pragmatic-drag-and-drop
- DOMPurify repo: https://github.com/cure53/DOMPurify
- CSSTree repo: https://github.com/csstree/csstree
- Immer patches: https://immerjs.github.io/immer/patches
- Yjs UndoManager: https://docs.yjs.dev/api/undo-manager
- SIL OFL FAQ: https://openfontlicense.org/ofl-faq/
- Google Fonts Developer API: https://developers.google.com/fonts/docs/developer_api
- Google Fonts getting started: https://developers.google.com/fonts/docs/getting_started

**Data queried directly (2026-11-01)**
- npm registry (`registry.npmjs.org/<package>`) for version, release date and licence of every package in section 3,
  and for Puck's dependency list.
- GitHub REST API (`api.github.com/repos/...`) for last push date, licence and archive status of the repos in section 3.

**Search results only (page not opened; used where marked *(snippet)*)**
- Webflow legacy Editor deprecation: https://webflow.com/blog/legacy-editor-deprecation (blocked on fetch), plus secondary summaries
- Webflow variable fonts: https://help.webflow.com/hc/en-us/articles/33961307448979 (403 on fetch)
- Webflow components overview: https://help.webflow.com/hc/en-us/articles/33961303934611 (403 on fetch)
- Framer version history: https://www.framer.com/academy/lessons/version-history
- WordPress Font Library and self-hosting commentary: https://make.wordpress.org/themes/2022/06/18/complying-with-gdpr-when-using-google-fonts/
- Munich Google Fonts ruling commentary: https://www.activemind.legal/guides/ruling-google-fonts/ and https://kpmg-law.de/en/?p=25292
- Builder.io Visual Copilot (Figma-to-code, not an editing-constraint feature): https://www.builder.io/blog/figma-to-code
