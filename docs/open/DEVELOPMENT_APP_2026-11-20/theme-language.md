# Theme language, 2026-11-20

Worker L. A proposal for Justin to react to. Nothing here has been built; no code outside this folder was touched. Machine-readable twin: `theme-roles.json` (regenerate with `python3 build-theme-roles.py`). Evidence: C's `themes.json` and `catalogue.md`, D's `design-system.md/.json`, `packages/direct-edit/src/site/style.ts`, the six `site-style-schema.ts` files, `packages/fonts/src/roles.ts`, ifac `theme-tokens.ts`, danamccool `theme.ts`, `packages/tokens`, HOUSE_EDITOR_ONE PLAN H5, and the action atlas (`theme` query).

## 0. The idea in six lines

1. A **theme** is the whole look of one site. It is built from a **preset**, plus the site's own **role** values, plus **fonts**, plus **chrome** (header and footer) styling, plus an optional **dark mode**.
2. A **role** is a job a value does ("Page background", "Main accent"). There are 36 of them. 12 are shown to owners by default.
3. Every app already has these jobs; they are spelled many ways (`--background`, `--paper`, `--violet`, `--oad-paper`, `--ig-c-paper`). The old spellings stay forever as **aliases** that point at the role.
4. We do not invent a second schema. `SiteStyleSchema` stays the shape; `defineTheme` is a thin builder that produces it from roles, so the existing editor, saves and sanitiser keep working.
5. Hex is the one colour format. Legacy hsl triplets are converted at the edge.
6. A script lists every hard-coded colour and every undeclared variable, atlas-style, so the mess shrinks without a big-bang rename.

## 1. Glossary: say X, not Y

| Say | Meaning, in one sentence | Instead of |
|---|---|---|
| **theme** | The whole look of a site: preset, role values, fonts, chrome styling and optional dark mode. | skin, style (when meaning the whole), appearance, scheme, theme vars |
| **palette** | Only the colours of a theme. | colour scheme, colour panel, colours (as a noun for the whole set) |
| **role** | One job a value does in a theme, with a plain owner name ("Page background"). | semantic token, hook, theme variable (to owners) |
| **variable** | The CSS name that carries a role (`--eac-accent`); developer word. | token, custom property, CSS var, hook |
| **swatch** | A raw colour with no job yet (`--ig-c-gold`, `--color-indigo-600`); a developer says "primitive". | primitive (to owners), palette step, base colour |
| **alias** | An old variable name kept alive by pointing at a role (`--primary` points at Main accent). | legacy var, bridge, shim, compat variable |
| **chrome** | The header, footer and phone menu around a page's content; styled per part, never moved. | shell, layout, frame (frame stays ifac's border), site furniture |
| **part** | A named piece of chrome (or of a block) an owner can restyle: `brand`, `links`, `legal`. | element, slot (slot stays Puck's), section |
| **look** | The style of one element or block (fill, colour, size, padding...), set on the canvas. It is not the theme. | theme override, inline style, per-block theme |
| **kind colour** | The tint a kind of thing wears (event, poem, place) from `data-kind`; chosen by the system, not by the owner. | category colour, type colour |
| **mode** | Light or dark. | scheme, dark theme, colour mode, night |
| **font role** | The job a font does: body, title, nav, caption, reading, record. | heading font / display font / kicker font (title and record replace them) |
| **site style** | The code name for the schema and the shared editor (`SiteStyleSchema`, `SiteStyleEditor`). Owners see the button "Theme". | (no change in code yet) |
| **preset** | A named complete starting theme ("EAC dark", "EAC light", "Test theme", "Katie"). | skin, hub skin, look preset, template, base theme |

Two clashes to know about: "part" already means the same thing inside blocks (100 blocks declare `parts`); that is fine, it is one idea. "Look" is also the name of hidden-enneagram's `--he-look` presets and the Look panel; rename the former to preset.

## 2. Format decision: hex

Every colour role stores `#rrggbb` (lowercase), or `#rrggbbaa` when translucent (`scrim` only, and extras that must be translucent).

Why hex, not the hsl triplet (`40 50% 57%`) that six apps store today:
- Owners pick colours with a picker and read hex. The editor already holds `hslToHex` / `hexToHsl` just to talk to it.
- A triplet is not a colour until wrapped in `hsl(...)`, so it cannot go into `color-mix()`, a gradient stop, an SVG attribute, or a role that must be translucent. Hex works everywhere unwrapped. That is also what lets the ~100 hard-coded `--ig-a-b79a55-35` colours become `color-mix(in srgb, var(--eac-accent) 35%, transparent)` later.
- ifac, danamccool and the DTCG importer (`@elkdonis/tokens`, sRGB to hex) are already hex.
- The sanitiser already has `HEX_RE`, `HEX_ALPHA_RE`; only the triplet branch becomes conversion-only.

Conversion rules (all lossless enough: round to the nearest 8-bit channel):
- **Stored triplet to hex** (read time): `hslToHex(triplet)`. `40 50% 57%` becomes `#c8a45b`.
- **Role to legacy shadcn alias** (emit time): `--primary: hexToHsl(accent)` as a bare triplet, because existing CSS reads `hsl(var(--primary))`. Aliases declare their `as`: `hsl-triplet`, `hex`, `rgb` or `raw`.
- **Alias that wraps** (`--eac-control-bg: hsl(var(--background))`): becomes a plain `var(--eac-ground)`.
- **rgba(...)** stored by Site style today: kept as accepted input, normalised to `#rrggbbaa` on save.
- **Gradients and bands** keep kind `background`: a hex or a `linear-gradient(<deg>, #hex n%, ...)`. Only the `band` role uses it.
- **oklch/color-mix/var()** are allowed in a preset's code defaults and in component CSS, never in stored owner values (the sanitiser stays strict).
- A round trip hex to triplet to hex can move a channel by one step; so a stored triplet is never rewritten until the owner next edits that role.

## 3. The role list (36)

Group, plain name (what the owner sees), variable, format, and one line of meaning. Bold names are the **12 core** roles owners see open; the other 24 sit behind a fold ("More colours", "More"). The same list is in `theme-roles.json`, `roles[]`, with a `core` flag.

**Colour (18)**

| id | Owner sees | Variable | Format |
|---|---|---|---|
| ground | **Page background** | `--eac-ground` | color |
| panel | **Cards and panels** | `--eac-panel` | color |
| ground-soft | **Soft panels** | `--eac-ground-soft` | color |
| ink | **Text** | `--eac-ink` | color |
| ink-muted | **Quiet text** | `--eac-ink-muted` | color |
| ink-faint | Faint text | `--eac-ink-faint` | color |
| line | **Lines** | `--eac-line` | color |
| rule | Strong rules | `--eac-rule` | color |
| accent | **Main accent** | `--eac-accent` | color |
| on-accent | **Text on the accent** | `--eac-on-accent` | color |
| accent-ink | Accent as text | `--eac-accent-ink` | color |
| accent-soft | Hover wash | `--eac-accent-soft` | color |
| accent-2 | Second accent | `--eac-accent-2` | color |
| danger | **Warning red** | `--eac-danger` | color |
| ok | Done green | `--eac-ok` | color |
| warn | Attention amber | `--eac-warn` | color |
| scrim | Popup backdrop | `--eac-scrim` | rgba |
| band | Section banners | `--eac-band` | background |

**Type (7)**: font-body (**Body text font**, `--eac-font-body`), font-title (**Headings font**, `--eac-font-title`), font-nav (Menu font), font-caption (Caption font), font-reading (Reading font), font-record (Label font: kickers, datelines), text-scale (Text size, a number, 1 = as designed). Format `font` is one of the stacks the site declares in `fonts`.

**Shape (5)**: radius (**Corners**, `--eac-radius`), radius-control (Field corners), radius-mark (Small-mark corners), shadow-panel, shadow-pop.

**Space (4)**: gap (Spacing step; the scale `--eac-gap-1..5` = 4, 8, 12, 18, 24 px), width-standard (Page width; the four widths `--eac-width-compact/standard/wide/full`), measure (Reading width), header-h (Header height).

**Motion (2)**: ease (Easing), dur-base (Speed; `--eac-dur-fast/base/slow` = 120, 180, 320 ms).

Scales count once: the full variable count is 44. Owners edit a role; the scale steps derive from it.

Deviations from D's proposal, on purpose: `--card` becomes its own role **panel** (D folded it into ground, but every shadcn app sets card and background apart, and a "page" and a "panel" are what owners say); `accent-2` is added (ifac gold, danamccool orange, katie celadon, hidden-enneagram and sunjay secondary tints); `band` becomes a role (it exists in 7 apps with 7 values); kind colours are **not** roles (section 5).

### 3.1 How well each app maps (generated)

Counts out of 36 roles (exact = same job under another name; near = similar job, check by eye; none = the app has nothing). Orphans are variables the app's editor exposes that fit no role.

| App | Exact | Near | None | Orphans (editor-declared, no role) |
|---|---|---|---|---|
| elktours | 22 | 2 | 12 | `--m-screen`, `--radius-sheet` |
| sunjay | 22 | 2 | 12 | none (rust, gold ride as second accents) |
| katie-the-potter | 16 | 2 | 18 | none |
| hidden-enneagram | 16 | 2 | 18 | `--gut`, `--heart`, `--head`, `--stress`, `--he-look` |
| art-auction | 14 | 3 | 19 | `--wall` |
| innergathering | 13 | 2 | 21 | `--smoke`; plus ~100 `--ig-a-*` hard-coded translucents (not editor-declared) |
| arts-collective | 14 | 3 | 19 | none (own `CssVarDef` panel) |
| ifac | 15 | 3 | 18 | `--blue`, `--moss`, `--frame-soft`, `--frame-width` (`--frame` rides as the strong rule, near) |
| danamccool | 12 | 3 | 21 | 13: the `--dm-nav-*`, `--dm-caption-ink`, `--dm-sidebar-bg` menu set, plus 8 `--color-*` Tailwind-kit fan-outs of the same roles (which become aliases, not extras) |
| artdirect | 10 | 7 | 19 | none (one person colour, `--oad-page-bg`) |
| admin, amrit-canada, blog-*, elastrocal, forum, fourthwayBookreaders, pigeonshoot | 5 to 16 | 1 to 3 | 17 to 30 | none (shadcn only, no editor) |

The full per-app tables are in Appendix A. Reading them:
- **Near matches worth a look**: shadcn `--accent` to accent-soft (it is a hover wash); shadcn `--secondary` to accent-2 (a true second brand colour only in katie, a tint elsewhere); ifac `--oxide`, danamccool `--cyan`, artdirect `--oad-gold` to accent (each app has several accents; the choice is the owner's); `--ink-soft` to ink-muted.
- **The two bronzes**: elktours accent `#c8a45b` (`40 50% 57%`) and sunjay accent `#c9ae78` (`40 43% 63%`) are the same idea, hand-copied, six points of lightness apart. The role list lets them stay different and become two presets, or merge into one "Bronze" preset; that is Decision 2.
- **Orphans are site-specific on purpose**: hidden-enneagram's gut/heart/head/stress, art-auction's wall, danamccool's menu parts. They become **extras** (section 4), named `--<site>-<job>`.
- **Gaps are mostly the system tail**: warn, font-nav, text-scale, shadows, gap, motion are declared nowhere in app CSS today. The role list supplies preset defaults, so no app has to declare them.

## 4. How a site declares its theme

One declaration, in code, per site; the stored data only fills in values. It extends `SiteStyleSchema` rather than replacing it.

```ts
// apps/katie-the-potter/src/lib/theme.ts (proposed shape; types are illustrative)
export const THEME = defineTheme({
  id: "katie",
  preset: "eac-light",                         // base: role defaults for every role
  roles: {                                     // this site's brand: overrides + owner-facing labels
    ground:  { default: "#f6f1e9", label: "Page" },
    accent:  { default: "#b5573b", label: "Terracotta", hint: "Buttons, marks." },
    "accent-2": { default: "#819c8f", label: "Celadon" },
    "font-title": { default: FRAUNCES }, "font-body": { default: KARLA },
    radius: { default: "10px" },
  },
  extras: [                                    // site-specific variables, namespaced
    { name: "--ktp-tile-gap", label: "Product tile gap", group: "Shop", kind: "length", default: "18px" },
  ],
  fonts: [ /* same SiteFont[] as today */ ],
  chrome: { header: {...}, footer: {...} },    // same ChromeRegion shape, with the shared part names
  dark: { ground: "#16161a", ink: "#f1ede4", accent: "#c98a6e" },   // optional; absent = single-mode
  aliases: "shadcn",                           // which alias set to emit: shadcn | none | { "--paper": "ground", ... }
});
// THEME.schema is a SiteStyleSchema: <SiteStyleEditor schema={THEME.schema} .../> and cleanSiteStyle() are unchanged.
```

What `defineTheme` does, in order:
1. Takes every role from the preset, overrides the ones the site lists, and writes each as a `SiteVar` (`name: "--eac-accent"`, `kind` from the role format, `group` from the role group, `fold` for the non-core roles, `on` for contrast pairs). That list is `schema.vars`, plus `extras`.
2. Adds an optional `role` field to `SiteVar` (the only edit to `style.ts`: one optional string) so the editor, the Test theme and T's preview can show "Main accent" whichever site they look at.
3. Emits CSS: `:root { --eac-accent: #b5573b; ...aliases }`, and for dark `.dark, [data-mode="dark"] { ... }`. Aliases are generated from the alias map, so `--primary: 14 51% 47%;` appears without any hand-written bridge.
4. Reads a stored `SiteStyle` and accepts old keys: `{"--primary": "14 51% 47%"}` is looked up in the alias map, converted to hex, and treated as role `accent`. No data migration is needed to start.

**Layers (the research.md model, in this repo's words)**: *preset* (system defaults) → *site declaration* (brand, in code, today's `default`) → *stored owner values* (`site_themes`) → *per-page and per-person exceptions* (more `site_themes` rows). A role nobody sets still has a value from the preset. A preset can be chosen by the owner (a `choice` variable, which is what H5 wants for "hub skin").

**Where it is stored.** `site_themes`, with the scope ladder H5 already asks for: **org** (site default, `page_key ''`) → **page** (exception, `page_key '<slug>'`, exists today) → **person** (the signed-in person's own profile theme; `users.theme` folds in, ifac and arts-collective only). Resolution is person over page over org; writes are diff-only (store only what differs from the layer below). The fourth step of H5's ladder, "row", is a block's **look**, not a theme, and stays in Puck data. Chrome part styles stay in `site_config key site-style:chrome` until H5 moves them; the shape does not change.

**Stored shape (v2, additive).** `{ v: 2, preset?: "eac-dark", theme: { accent: "#b5573b", "--ktp-tile-gap": "20px" }, dark?: { ground: "#16161a" }, chrome: {...} }`. Role values are keyed by role id; extras by their variable name. v1 data (`theme` keyed by variable name) keeps loading.

**Saves.** One door. The atlas shows three theme-save paths today (`site-style-save` on 8 hosts, near byte-identical copies in sunjay, elktours and katie; `site-theme-save` ifac via services and danamccool by raw SQL; `user-theme-save` ifac and arts-collective). The target is `site-style-save` with the scope as an argument; the other doors become wrappers and later retire. This matches H5 and needs no new action, only more hosts on the shared one.

**Old names as aliases.** `design-system.json` already holds 152 alias rows (surface, forms, blocks, wizard, shadcn, control, fonts, danamccool, innergathering, sunjay). The alias map becomes data (`theme-roles.json maps` is its per-app view) consumed by `defineTheme`. An alias is never deleted by this work; an app moves at its own pace, and a CSS rule reading `hsl(var(--background))` keeps working because `--background` is still emitted.

## 5. Naming rules

For a **new variable**:
1. A role is `--eac-<job>`, lowercase kebab, from the list in section 3 or added to it by deciding it here first. No app, family or component word, no colour or place word: `--eac-accent`, never `--eac-brass`, `--eac-header-blue` or `--katie-accent`.
2. Say the job, then the degree: `ink`, `ink-muted`, `ink-faint`. Text on a fill is `on-<fill>` (`on-accent`). A tint of a role is `<role>-soft`. Scales are numbered (`gap-1..5`). The only numbered colour is `accent-2`.
3. A site-only variable is `--<siteid>-<job>` (`--he-gut`, `--dm-nav-active`) and must be declared in that site's `extras` to be editable. The site id is the app's short id (`he`, `dm`, `ktp`, `ig`, `pts`).
4. A component's own hook is `--eac-<component>-<role>` (`--eac-form-accent`) and its default must be `var(--eac-<role>)`; hooks resolve to private `--sf-*`, `--frm-*`, `--blk-*` names that apps never set.
5. Colours are hex (section 2). Lengths carry a unit or are `0`. Never a bare number except `text-scale`.
6. Dark values live under `dark`, never in a differently named variable (`--background-dark`).
7. A new palette step is a swatch, and a swatch is not a theme variable: it is a constant in the preset or in code.

What must **never** be a theme variable:
- **Layout and geometry** that restructures content (grid columns, breakpoints, z-index, header position, a side pane's width ratio).
- **Content and data**: copy, URLs, images, ids, a block's props. Those are props, not theme.
- **Per-element style**: if two elements on one page need different values, it is a look, not a theme variable.
- **Computed or state values**: `--sf-kind`, `--tx`, `--progress`, pointer position; set by code per element.
- **One-off opacity steps** such as `--ig-a-b79a55-35`: write `color-mix(in srgb, var(--eac-accent) 35%, transparent)` in the stylesheet.
- **Font files and loading**: a font role picks from the declared list; the faces and `next/font` stay in the app.
- **Anything needing server logic or secrets** to apply (a markup switch hidden behind a variable; a `choice` that must be read server-side stays a documented exception).

## 6. Migration path

Principle: additive first (no site changes), then site by site, newest and simplest first. Each site step is: declare the theme with `defineTheme`, point its schema at it, check that an untouched site renders pixel-identical, then remove nothing. Effort: S under an hour of changes, M a session, L several.

| # | Step | Effort | Risk | Why here |
|---|---|---|---|---|
| 0 | **Roles as the last fallback** in surface.css, fields.css, forms theme and blocks.css (D's step 4); the preset files (`eac-light`, `eac-dark`); the optional `role` field on `SiteVar`; `defineTheme` builder. | M | low, additive | Needs the surface owner's uncommitted edits committed first. |
| 1 | **katie-the-potter** | S | low | Newest, single-mode, 12 variables, no dark rows, no extras. The pilot. |
| 2 | **sunjay** | S | low | Katie's twin (12 variables, one extra, `--eac-block-band`); settles the two-bronze question. |
| 3 | **hidden-enneagram** | M | medium | Four figure orphans become extras; `--he-look` becomes a preset; rebuild lock is held, so wait for it. |
| 4 | **art-auction** | M | medium | 46 dark rows to map, `--wall` and `--live` extras; its header is Tailwind code with no site variables (PLAN decision 5). |
| 5 | **innergathering** | L | medium | 141 `--ig-*`: declare the 12 core roles first and leave `--ig-*` alone; the ~100 translucents become `color-mix` only when the site is next redesigned. |
| 6 | **elktours** | L | high | 382 variables, 15 prefixes, phone layout vars, busiest site: go once the pattern is proven; move only the 20 editable variables, nothing else. |
| 7 | **arts-collective, then ifac** | L | medium | Their `AppearancePanel`/`CssPanel` move to Site style with H5 (ifac already writes the same `site_themes` row); ifac keeps its own aliases (`--ink`, `--paper`, `--oxide`) and gains `person` scope; hub skin becomes a preset choice. |
| 8 | **danamccool** | M | medium | Separate store (`site_config theme:palette/fonts`) needs a one-time data move; its palette roles already map (ground, panel, ink, link to accent, mark to accent-2; menu and caption as extras). |
| 9 | **artdirect, amrit-canada, no-editor apps** | S each | low | Adopt the role list by alias only; no editor. amrit-canada is being left behind: do not let its shape become canonical. |

The Development app's token matrix (rows = roles, columns = apps, from `theme-roles.json`) is the progress board: a cell turns green when the app declares the role itself.

### 6.1 A lint and "unclaimed" check

A script (`scripts/theme-lint.mjs`, reusing C's `extract-themes.js` parser) run as `pnpm theme:lint`, warn-only at first, in the atlas style with a `theme:q` listing:

1. **Hard-coded colours**: every `#hex`, `rgb(`, `hsl(` and named colour in app CSS, TSX style props and Tailwind arbitrary values that is not inside a variable declaration in a preset, `globals.css` `:root`/`.dark` block or `theme.ts`. Reported per file with a count; a baseline file (`theme-lint.baseline.json`) makes it a ratchet: the number may fall, not rise.
2. **Undeclared**: `var(--x)` reads with no declaration anywhere in the app's reach (package CSS included). These render as nothing.
3. **Dead**: declared variables nothing reads, and nothing in a schema exposes.
4. **Unclaimed**: the atlas idea for variables. A variable is *claimed* if it is a role, an alias in the alias map, an extra in its site's `defineTheme`, a private resolved name (`--sf-*`, `--frm-*`, `--blk-*`) declared in its package, or a computed value on a short allow-list. Everything else is listed under its app: today that list is the 141 `--ig-*` families and the like. Each line says who owns it, which makes "who owns this variable" answerable.
5. **Role drift**: the same role set to different values by two paths in one app (elktours maps surface, block and control to the same shadcn values by hand); flags the duplicate.
6. **Contrast**: for every `on` pair the preset and each site declare, computed ratio under 4.5:1 is a warning (the editor already warns live; this covers defaults).

It prints the same table T's preview and the Development app can show. It never rewrites anything.

## 7. Decisions for Justin

1. **Colour format.** a) Hex, `#rrggbb` / `#rrggbbaa` (my pick). b) Keep the hsl triplet. c) OKLCH. *Pick a: owners read hex, it works everywhere unwrapped, and four systems already use it.* OKLCH is better for generated ramps but the picker, sanitiser and importer would all change; revisit if we ever generate palettes.
2. **Do shared names get shared values?** Elktours and sunjay both say `--primary` with near-identical bronzes; 13 apps say `--primary` with 13 values. a) Leave every site's own values; offer presets (my pick). b) Merge the bronzes into one "Bronze" preset. c) One accent for the whole network. *Pick a now, b only if Justin prefers one bronze.*
3. **What owners call it.** a) "Theme" for the site-wide look, "Look" for one element, "preset" for a starting point (my pick). b) "Style" for both. c) "Appearance". *Pick a; hidden-enneagram's "look presets" become presets.*
4. **Code names.** a) Keep `SiteStyleSchema`, add `defineTheme`, rename nothing (my pick). b) Rename to `ThemeSchema` across 8 hosts. *Pick a: a rename is churn with no owner benefit.*
5. **How many roles owners see.** a) 12 core, the rest behind "More" (my pick). b) All 36. c) 8. *Pick a; the 12 are the Page, Cards, Soft panels, Text, Quiet text, Lines, Main accent, Text on the accent, Warning red, Body font, Headings font, Corners that every site already offers.*
6. **Dark mode.** a) Optional per site, declared in the theme, preset supplies a default (my pick). b) Every site must have both. c) Derived automatically from light. *Pick a: katie, sunjay, hidden-enneagram and danamccool are single-mode today and would not look right derived.*
7. **Stored keys.** a) Role id with read-time alias lookup (my pick). b) Keep variable names forever. *Pick a: it makes "Main accent" mean one thing in the database, and v1 data keeps working.*
8. **danamccool's separate store.** a) Move into `site_themes` after the pilot (my pick, step 8). b) Leave it. c) Move now. *Pick a: one door for saves is the point.*
9. **Hard-coded colours.** a) Warn-only ratchet (my pick). b) Block CI at once. c) Ignore. *Pick a.*
10. **Kind colours as roles?** a) Not roles; the system's, per D's Q1 pick (b: kinds default to the site accent) (my pick). b) Offer them as extras per site later. *Pick a for now.*

## 8. Not verified

Values and variable names come from C's static parse of each app's CSS and schema file; I did not render any site. Counts of exact and near matches are by my candidate table (`build-theme-roles.py`, `C`), which is a judgement on the names, not a visual check; `near` entries need an eye. Several surface files carry another session's uncommitted edits. The `defineTheme` code above is a shape, not working code. I did not read every app's `lib/` for theme code beyond the six schemas, ifac and danamccool.

## Appendix A. Per-app role maps (generated by build-theme-roles.py)

Role, variable the app uses today, its value, and the match. Roles an app has nothing for are listed as gaps. hsl triplets are shown raw; the hex in brackets is what the theme record would store.

### elktours (exact 22, near 2, none 12)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 216 12% 19% (#2b2f36) | exact |
| panel | `--card` | 216 11% 23% (#343941) | exact |
| ground-soft | `--muted` | 216 10% 25% (#393e46) | exact |
| ink | `--foreground` | 40 33% 92% (#f1ede4) | exact |
| ink-muted | `--muted-foreground` | 37 12% 69% (#b9b2a6) | exact |
| ink-faint | `--sf-faint` | var(--faint) | exact |
| line | `--border` | 216 9% 49% (#727b88) | exact |
| rule | `--sf-rule` | var(--hair-3) | exact |
| accent | `--primary` | 40 50% 57% (#c8a45b) | exact |
| on-accent | `--primary-foreground` | 216 13% 12% (#1b1e23) | exact |
| accent-ink | `--eac-control-accent-ink` | #dcc08a | exact |
| accent-soft | `--accent` | 216 10% 30% (#454b54) | near |
| accent-2 | `--verdigris` | 160 26% 63% (#88b9a9) | near |
| danger | `--destructive` | 17 75% 64% (#e8855e) | exact |
| ok | `--eac-block-ok` | hsl(var(--primary)) | exact |
| scrim | `--sf-scrim` | rgba(20, 40, 75, .45) | exact |
| band | `--eac-block-band` | linear-gradient(135deg, #1f2227 0%, #2a2e35 .. | exact |
| font-body | `--site-font-body` | "Basteleur", Georgia, serif | exact |
| font-title | `--eac-font-title` | "Brothers", "Venture", Georgia, serif | exact |
| font-record | `--eac-font-record` | "Venture", Georgia, serif | exact |
| radius | `--radius` | 0rem | exact |
| radius-control | `--eac-control-radius` | var(--radius) | exact |
| radius-mark | `--sf-radius-sm` | 0px | exact |
| shadow-panel | `--sf-shadow` | none | exact |

Gaps: warn, font-nav, font-caption, font-reading, text-scale, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

Orphans (editor-declared, no role): `--m-screen`, `--radius-sheet`.

### sunjay (exact 22, near 2, none 12)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 204 8% 12% (#1c1f21) | exact |
| panel | `--card` | 200 8% 15% (#232729) | exact |
| ground-soft | `--muted` | 200 7% 19% (#2d3234) | exact |
| ink | `--foreground` | 40 21% 89% (#e9e5dd) | exact |
| ink-muted | `--muted-foreground` | 40 5% 62% (#a3a099) | exact |
| ink-faint | `--eac-surface-faint` | hsl(var(--muted-foreground)) | exact |
| line | `--border` | 203 7% 23% (#373c3f) | exact |
| rule | `--eac-surface-rule` | #8E8B85 (#8e8b85) | exact |
| accent | `--primary` | 40 43% 63% (#c9ae78) | exact |
| on-accent | `--primary-foreground` | 204 8% 12% (#1c1f21) | exact |
| accent-ink | `--eac-control-accent-ink` | #c9ae79 | exact |
| accent-soft | `--accent` | 40 20% 28% (#564c39) | near |
| accent-2 | `--gold` | var(--ifs-gold-text) | near |
| danger | `--destructive` | 0 58% 62% (#d66666) | exact |
| ok | `--eac-block-ok` | hsl(var(--primary)) | exact |
| warn | `--eac-form-warn` | #D9895A (#d9895a) | exact |
| band | `--eac-block-band` | #2B3134 | exact |
| font-body | `--site-font-body` | var(--font-spectral), Georgia, serif | exact |
| font-title | `--eac-font-title` | var(--font-fraunces), Georgia, serif | exact |
| radius | `--radius` | 0rem | exact |
| radius-control | `--eac-control-radius` | var(--radius) | exact |
| shadow-panel | `--eac-form-shadow-panel` | 0 14px 30px rgba(0, 0, 0, 0.55) | exact |
| shadow-pop | `--eac-form-shadow-pop` | 0 24px 60px -20px rgba(0, 0, 0, 0.7) | exact |
| header-h | `--pts-header-h` | 60px | exact |

Gaps: scrim, font-nav, font-caption, font-reading, font-record, text-scale, radius-mark, gap, width-standard, measure, ease, dur-base.

### katie-the-potter (exact 16, near 2, none 18)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 36 43% 94% (#f6f1e9) | exact |
| panel | `--card` | 36 50% 97% (#fbf8f4) | exact |
| ground-soft | `--muted` | 36 33% 89% (#ece5da) | exact |
| ink | `--foreground` | 22 15% 15% (#2c2521) | exact |
| ink-muted | `--muted-foreground` | 25 11% 39% (#6e6259) | exact |
| ink-faint | `--eac-surface-faint` | hsl(var(--muted-foreground)) | exact |
| line | `--border` | 35 25% 80% (#d9cebf) | exact |
| accent | `--primary` | 14 51% 47% (#b5573b) | exact |
| on-accent | `--primary-foreground` | 36 50% 97% (#fbf8f4) | exact |
| accent-ink | `--eac-control-accent-ink` | #8f3f28 | exact |
| accent-soft | `--accent` | 33 27% 86% (#e5dcd2) | near |
| accent-2 | `--secondary` | 150 12% 56% (#819c8f) | near |
| danger | `--destructive` | 0 55% 42% (#a63030) | exact |
| band | `--eac-block-band` | #2b2420 | exact |
| font-body | `--site-font-body` | var(--font-karla), system-ui, sans-serif | exact |
| font-title | `--eac-font-title` | var(--font-fraunces), Georgia, serif | exact |
| radius | `--radius` | 10px | exact |
| radius-control | `--eac-control-radius` | var(--radius) | exact |

Gaps: rule, ok, warn, scrim, font-nav, font-caption, font-reading, font-record, text-scale, radius-mark, shadow-panel, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

### hidden-enneagram (exact 16, near 2, none 18)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 240 9% 4% (#09090b) | exact |
| panel | `--card` | 240 14% 9% (#14141a) | exact |
| ground-soft | `--muted` | 240 13% 8% (#121217) | exact |
| ink | `--foreground` | 40 28% 90% (#ede8de) | exact |
| ink-muted | `--muted-foreground` | 40 12% 70% (#bcb6a9) | exact |
| ink-faint | `--eac-surface-faint` | var(--he-ink-faint) | exact |
| line | `--border` | 40 4% 16% (#2a2927) | exact |
| accent | `--primary` | 173 49% 45% (#3bab9e) | exact |
| on-accent | `--primary-foreground` | 240 9% 4% (#09090b) | exact |
| accent-ink | `--eac-control-accent-ink` | hsl(var(--primary)) | exact |
| accent-soft | `--accent` | 240 8% 15% (#232329) | near |
| accent-2 | `--secondary` | 240 8% 15% (#232329) | near |
| danger | `--destructive` | 0 62% 68% (#e07b7b) | exact |
| band | `--eac-block-band` | hsl(var(--card)) | exact |
| font-body | `--site-font-body` | var(--font-eb-garamond), Garamond, Georgia, .. | exact |
| font-title | `--eac-font-title` | var(--he-font-display) | exact |
| radius | `--radius` | 0.375rem | exact |
| radius-control | `--eac-control-radius` | var(--radius) | exact |

Gaps: rule, ok, warn, scrim, font-nav, font-caption, font-reading, font-record, text-scale, radius-mark, shadow-panel, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

Orphans (editor-declared, no role): `--gut`, `--he-look`, `--head`, `--heart`, `--stress`.

### art-auction (exact 14, near 3, none 19)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 36 22% 97% (#f9f8f6) | exact |
| panel | `--card` | 0 0% 100% (#ffffff) | exact |
| ground-soft | `--muted` | 30 14% 94% (#f2f0ee) | exact |
| ink | `--foreground` | 24 14% 11% (#201b18) | exact |
| ink-muted | `--muted-foreground` | 28 6% 38% (#67615b) | exact |
| line | `--border` | 28 12% 86% (#e0dbd7) | exact |
| accent | `--primary` | 6 70% 44% (#bf3122) | exact |
| on-accent | `--primary-foreground` | 36 30% 98% (#fbfaf8) | exact |
| accent-soft | `--accent` | 38 70% 88% (#f6e6cb) | near |
| accent-2 | `--live` | 152 58% 30% (#20794f) | near |
| danger | `--destructive` | 0 72% 42% (#b81e1e) | exact |
| ok | `--live` | 152 58% 30% (#20794f) | near |
| band | `--eac-block-band` | hsl(var(--foreground)) | exact |
| font-body | `--eac-font-body` | var(--font-inter), ui-sans-serif, system-ui,.. | exact |
| font-title | `--site-font-heading` | var(--font-fraunces), Georgia, "Times New Ro.. | exact |
| font-record | `--eac-font-record` | var(--font-inter), ui-sans-serif, system-ui,.. | exact |
| radius | `--radius` | 0.625rem | exact |

Gaps: ink-faint, rule, accent-ink, warn, scrim, font-nav, font-caption, font-reading, text-scale, radius-control, radius-mark, shadow-panel, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

Orphans (editor-declared, no role): `--wall`.

### innergathering (exact 13, near 2, none 21)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 42 60% 96% (#fbf7ef) | exact |
| panel | `--card` | 43 100% 99% (#fffefa) | exact |
| ground-soft | `--muted` | 40 45% 92% (#f4eee1) | exact |
| ink | `--eac-ink` | var(--ig-c-navy-deep) | exact |
| ink-muted | `--eac-ink-muted` | var(--ig-c-navy-soft) | exact |
| line | `--border` | 42 40% 76% (#dacca9) | exact |
| rule | `--eac-surface-rule` | hsl(var(--gold)) | exact |
| accent | `--eac-accent` | hsl(var(--gold)) | exact |
| on-accent | `--primary-foreground` | 43 100% 98% (#fffcf5) | exact |
| accent-soft | `--accent` | 42 40% 53% (#b79a57) | near |
| accent-2 | `--gold` | 42 40% 53% (#b79a57) | near |
| danger | `--destructive` | 4 55% 42% (#a63830) | exact |
| font-body | `--eac-font-body` | var(--site-font-body) | exact |
| font-title | `--eac-font-title` | var(--site-font-heading) | exact |
| radius | `--radius` | 0.375rem | exact |

Gaps: ink-faint, accent-ink, ok, warn, scrim, band, font-nav, font-caption, font-reading, font-record, text-scale, radius-control, radius-mark, shadow-panel, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

Orphans (editor-declared, no role): `--smoke`.

### arts-collective (exact 14, near 3, none 19)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 38 30% 96% (#f8f6f2) | exact |
| panel | `--card` | 40 34% 98% (#fcfaf8) | exact |
| ground-soft | `--muted` | 36 18% 92% (#eeebe7) | exact |
| ink | `--foreground` | 24 14% 14% (#29231f) | exact |
| ink-muted | `--muted-foreground` | 28 10% 40% (#70655c) | exact |
| ink-faint | `--sf-faint` | var(--ch-faint) | exact |
| line | `--border` | 30 18% 82% (#d9d1c9) | exact |
| rule | `--sf-rule` | var(--ch-line) | exact |
| accent | `--primary` | 18 54% 38% (#954c2d) | exact |
| on-accent | `--primary-foreground` | 40 36% 97% (#faf8f5) | exact |
| accent-soft | `--accent` | 30 58% 86% (#f0dbc7) | near |
| accent-2 | `--secondary` | 34 22% 90% (#ebe6e0) | near |
| danger | `--destructive` | 4 70% 45% (#c32d22) | exact |
| scrim | `--sf-scrim` | rgb(34 32 29 / 0.3) | exact |
| font-body | `--font-sans` | var(--font-inter) | near |
| font-title | `--sf-font-title` | var(--ch-font) | exact |
| radius | `--radius` | 0.625rem | exact |

Gaps: accent-ink, ok, warn, band, font-nav, font-caption, font-reading, font-record, text-scale, radius-control, radius-mark, shadow-panel, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

### ifac (exact 15, near 3, none 18)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--background` | 40 39% 95% (#f7f4ed) | exact |
| panel | `--card` | 43 100% 99% (#fffefa) | exact |
| ground-soft | `--muted` | 38 22% 80% (#d7cfc1) | exact |
| ink | `--foreground` | 30 5% 9% (#181716) | exact |
| ink-muted | `--muted-foreground` | 33 7% 29% (#4f4a45) | exact |
| ink-faint | `--eac-surface-faint` | #8a857f | exact |
| line | `--border` | 38 22% 50% (#9c8763) | exact |
| rule | `--eac-surface-rule` | #4f4c48 | exact |
| accent | `--primary` | 9 53% 39% (#983f2f) | exact |
| on-accent | `--primary-foreground` | 43 100% 99% (#fffefa) | exact |
| accent-ink | `--eac-control-accent-ink` | var(--gold) | exact |
| accent-soft | `--accent` | 40 54% 52% (#c79b43) | near |
| accent-2 | `--gold` | #c79a42 | near |
| danger | `--destructive` | 9 53% 39% (#983f2f) | exact |
| font-record | `--sf-font-record` | Arial, Helvetica, sans-serif | exact |
| radius | `--radius` | 0.5rem | exact |
| radius-control | `--eac-control-radius` | 2px | exact |
| shadow-panel | `--shadow` | 0 18px 55px rgba(23, 22, 21, 0.12) | near |

Gaps: ok, warn, scrim, band, font-body, font-title, font-nav, font-caption, font-reading, text-scale, radius-mark, shadow-pop, gap, width-standard, measure, header-h, ease, dur-base.

Orphans (editor-declared, no role): `--blue`, `--frame-soft`, `--frame-width`, `--moss`.

### danamccool (exact 12, near 3, none 21)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--violet` | #795ff0 | exact |
| panel | `--violet-panel` | #6f54e8 | exact |
| ink | `--ink` | #060606 | exact |
| ink-muted | `--ink-soft` | #1a1a1a | near |
| line | `--border` | 1px | exact |
| accent | `--cyan` | #48d0ed | near |
| on-accent | `--eac-block-on-accent` | var(--ink) | exact |
| accent-2 | `--orange` | #ef4926 | near |
| band | `--eac-block-band` | var(--ink) | exact |
| font-body | `--dm-font-body` | "Helvetica Neue", "Segoe UI", Arial, -apple-.. | exact |
| font-title | `--dm-font-heading` | var(--dm-font-body) | exact |
| font-nav | `--dm-font-nav` | var(--dm-font-body) | exact |
| font-caption | `--dm-font-caption` | var(--dm-font-body) | exact |
| radius | `--eac-block-radius` | 0px | exact |
| measure | `--eac-block-measure` | 52rem | exact |

Gaps: ground-soft, ink-faint, rule, accent-ink, accent-soft, danger, ok, warn, scrim, font-reading, font-record, text-scale, radius-control, radius-mark, shadow-panel, shadow-pop, gap, width-standard, header-h, ease, dur-base.

Orphans (editor-declared, no role): `--color-accent`, `--color-background`, `--color-base-100`, `--color-base-content`, `--color-foreground`, `--color-muted-foreground`, `--color-primary`, `--color-secondary`, `--dm-caption-ink`, `--dm-nav-active`, `--dm-nav-hover`, `--dm-nav-ink`, `--dm-sidebar-bg`.

### artdirect (exact 10, near 7, none 19)

| Role | Variable | Value | Match |
|---|---|---|---|
| ground | `--oad-paper` | var(--paper, #121413) | exact |
| panel | `--oad-panel` | #1a1c1b | exact |
| ground-soft | `--blk-bg-soft` | var(--oad-panel) | exact |
| ink | `--oad-ink` | var(--ink, #f7f1e3) | exact |
| ink-muted | `--oad-ink-soft` | var(--ink-soft, #a9a293) | near |
| ink-faint | `--blk-faint` | var(--oad-ink-soft) | exact |
| line | `--oad-line` | var(--line, #35322c) | exact |
| accent | `--oad-gold` | var(--gold, #c79a42) | near |
| on-accent | `--oad-on-gold` | #121413 | near |
| accent-ink | `--blk-accent-ink` | var(--oad-gold) | exact |
| danger | `--oad-status-no` | #e08a8a | near |
| ok | `--oad-status-yes` | #7fb07f | near |
| font-body | `--oad-font-body` | 'Courier Prime', 'Courier New', Courier, mon.. | exact |
| font-title | `--oad-font-display` | 'UnifrakturMaguntia', 'Courier Prime', serif | near |
| radius | `--blk-radius` | 0px | exact |
| radius-mark | `--blk-radius-sm` | 0px | exact |
| width-standard | `--oad-width` | 1000px | near |

Gaps: rule, accent-soft, accent-2, warn, scrim, band, font-nav, font-caption, font-reading, font-record, text-scale, radius-control, shadow-panel, shadow-pop, gap, measure, header-h, ease, dur-base.
