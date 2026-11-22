# Design system suggestion (early days), 2026-11-20

Worker D. Status: a suggestion for the owner to react to, not a decision. Nothing here has been built or changed in code. The companion file `design-system.json` holds the token groups and the alias map in a shape the Development app can render. Evidence was read from source on 2026-11-20; surface files carry another session's uncommitted edits, so "today" means the working tree.

Working name: **Elkdonis Frame**. Rename freely.

## 1. The idea in one page

Today the network has several good ways of looking, each grown in its own room. The **surface system** (cms-ui) gives every kind of thing, a meeting, a poem, a place, a face on a grid that opens into a sheet: the same object at two sizes, tinted by what it is. The **create-tour wizard** in elktours gives a way of working: a big popup with a step row on top, two columns underneath (the doing on the left, the proof on the right: map, preview, checklist), rows that open in place. The **house editor** lets an owner change a whole site's colours, fonts, header and footer. Studio forms and the page blocks each have their own set of names for the same few colours.

The suggestion is to stop treating these as four systems and treat them as **one set of meanings with several shapes**.

- **Meanings come first.** Ground, ink, line, accent, danger. A handful of colour roles, a handful of type roles, a few gaps, one corner, four shadows, one easing. Every app already has these ideas; they are just spelled eleven ways.
- **Shapes come second.** The surface gives three shapes: a *face* (a card in a grid), a *sheet* (the face opened), a *stage* (a sheet that fills the screen and holds a strip of faces). The wizard adds a fourth way of using a sheet: a *flow*, the sheet with steps, two panes, and row cards.
- **Pages wear it.** The site header and footer are parts an owner can restyle, using the same meanings.
- **Nothing breaks.** Every old name stays. It becomes a nickname for a meaning. An app that sets nothing looks exactly as it does today.

What the third thing is: the surface system's *objects and kinds* (a thing is tinted by what it is, and expands rather than navigates) combined with the wizard's *use of room* (two panes, steps as pills, work and proof side by side, rows that unfold). In one line: **every thing is a face that opens into a sheet, and every sheet that needs more than one job becomes a two-pane flow.**

## 2. Layers

For each layer: what exists, what the proposal keeps, what it renames or merges.

### 2.1 Foundations

**Colour roles.** Today: five families spell the same roles. Surface `--eac-surface-bg/fg/muted/faint/line/rule/accent/on-accent/danger/scrim` (public hooks) resolved into `--sf-*` (surface.css:44-86, 50 names); fields `--fld-*` read `--sf-*`; Studio forms `--eac-form-*` hooks into `--frm-*` (about 60 hooks, 86 outputs, forms.css); page blocks `--eac-block-*` into `--blk-*` (27 hooks, 36 outputs, blocks.css); the shadcn bridge (`--background`, `--primary`, HSL triplets) in each app's globals.css, plus `--eac-control-*` in elktours. Site style declares its own `SiteVar` lists per site. Keeps: the hook-to-resolved two-tier pattern (apps set hooks, components read resolved names) and per-kind accents `--eac-kind-*` (19 kinds, with `-on` text colours). Merges: the five spellings of bg/fg/muted/line/accent/on-accent/danger into **one role list**: ground, ground-soft, ink, ink-muted, ink-faint, line, rule, accent, accent-ink, on-accent, accent-soft, danger, ok, warn, scrim, kind, on-kind. Renames: nothing is deleted. Adds: `accent-ink` (accent as text, forms already needs it and elktours pins one at 7.8:1), `ok` and `warn` (blocks have `--blk-ok`, forms have warn, surface has neither), `accent-soft`.

**Type roles.** Today: `@elkdonis/fonts` roles body, heading, nav, caption, reading (`roles.ts`), emitted as `--font-*` and bridged to `--eac-block-font-*`; surface adds `--eac-font-title`, `--eac-font-record` (the monospace-or-Venture registry voice for kickers and facts); forms have `--eac-form-font-body/heading`; danamccool `--dm-font-*`. Keeps: the five fonts roles as the canonical list, and the record voice, which is the surface system's best typographic idea. Merges: title = heading (one role, two historical names). Adds a size scale (`--eac-text-scale` exists in forms only).

**Space.** Today there is no shared scale. Surface hard-codes gaps (18px face grid) and four widths (`--sf-w-compact/standard/wide/full` = 440, 640, 940, 1180). The wizard uses Tailwind `gap-3`, `gap-6`. Forms have `--eac-form-cols-gap`. Proposal: five gaps (4, 8, 12, 18, 24) and the four widths renamed `--eac-width-*`. The wizard's two-pane gap becomes `--eac-gap-5`.

**Radius.** Surface 6px with a small step `max(2px, r-3px)`; fields use the small step; forms have control, panel and mark radii; blocks have radius and radius-sm. Merge to three: `radius` (panels), `radius-control`, `radius-mark`.

**Elevation.** Surface: a whisper at rest (`0 1px 2px .04, 0 10px 22px -18px .2`), a big sheet shadow (`--sf-shadow`); forms: panel and pop. Proposal: four named shadows: rest, lift, panel, pop. Elktours overrides the face lift off; that stays an app decision, not a system rule.

**Motion.** Today one named easing (`--sf-morph-easing`) and 180ms literals. Proposal: `ease`, `dur-fast` 120, `dur-base` 180, `dur-slow` 320 for the face-to-sheet morph. Honour reduced motion.

### 2.2 Surfaces

Today: `surface.css` is 4,151 lines. FACE (`.eac-face`: kind wash from the top-left corner at 5%, a hairline that fades from the glyph medallion, min-height 210px, 56px top padding for the medallion); SHEET (`SurfaceShell`/`SurfaceFrame`: masthead repeating the kind edge, scroll body, foot with actions; sizes compact, standard, wide, full, bare, plus `stage`); STAGE (`SurfaceStage.tsx`, new, in progress: fills its height, holds `.eac-stage-strip` of `.eac-stage-face`); CARD (`SurfaceCard.tsx`, `SurfaceCardGrid`, the face grid with `auto-fill, minmax(260px, 1fr)`). 19 kinds in `kinds.ts` each with glyph, label, default size.

Proposal keeps all of it. Four small moves:

1. **Say "face, sheet, stage, strip" and drop "card"** in the vocabulary. `SurfaceCard` stays as the component; the word in docs and the Development app is *face*.
2. **A strip is a face in a row**, not a grid variant (as built; the handoff doc agrees).
3. **Size is a property of the kind, never a number** (already the rule: "a surface declares which one it is; it never picks a number"). The wizard breaks this by being `size: "full"` on a kind meant for `wide`; see section 4.
4. **Kinds are the app palette.** `data-kind` sets `--eac-kind`. The kind list is a design-system feature the Development app should show as a swatch row.

### 2.3 Flows

Today the wizard exists twice. In cms-ui: `TemplateWizard`, `WizardProvider`, `StepIndicator` (variants `chips` and `bar`), `WizardNav`, `fields.tsx` + `fields.css`. In elktours, hand-built: `create-tour-popup.tsx` (a `SurfaceFrame` kind `event`, size `full`, step pills drawn inline at line 263, actions array Back / Save / Next / Publish), three steps with `lg:grid-cols-[1.2fr_1fr]`, expandable stop rows (`route-step.tsx:245`), preview and checklist in the right pane. The handoff doc confirms: 2a hairline strip missing, row card app-side only, fields 1b-1e missing.

Proposal: promote what the elktours wizard does into four named flow parts, shared and token-driven:

- **Step row** (a third `StepIndicator` variant, `pills`) with a status word under each: done, todo, needs attention.
- **Two-pane** (`--eac-pane-main` 1.2fr, `--eac-pane-side` 1fr; collapses to one column under `lg`; the side pane is sticky).
- **Row card**: a list item that unfolds in place, with a drag handle and a one-line summary when closed.
- **Readiness**: a checklist in the side pane; each item `ok`, `warn` or open, driven by the `ok`/`warn` roles. It gates the primary action and says why.
- **Side panel** is the name for the right pane's contents: preview, map, readiness, in that order of preference.

Renames: the wizard's `--primary` pill fill becomes `--eac-step-pill` (= accent). Nothing else changes in elktours' layout; the owner likes it as is.

### 2.4 Page chrome

Today: Site style (`packages/direct-edit/src/site/style.ts`) lets a site declare `vars` (kinds: hsl, color, rgba, length, font, background, choice; groups, folds, `applies`, `on` for contrast) and `chrome` regions (header, footer) with parts named by `data-part` inside `[data-chrome="<region>"]`; owners style each part through the shared PartStyle keys (fill, color, size, weight, case, tracking, padding, gap, radius, border, hide, css). Seen in elktours, art-auction, hidden-enneagram, plus the others. Per-app variants: sunjay `--pts-header-h`, danamccool `--dm-nav-*`, innergathering `--ig-*`.

Proposal keeps Site style as the **editing surface for the foundations**: a site's declared `vars` should be the role list (ground, ink, accent, and so on) so every owner sees the same labels in the same groups ("Colours", "Type", "Shape") whichever site they edit. Chrome keeps its parts. Header parts proposed as a common vocabulary (brand, nav, actions) and footer (links, legal); apps may add. Adds `--eac-header-h` so a hero can sit under it.

## 3. One token vocabulary

The rule: **new names are roles with the `--eac-` prefix and no family word in them**. An old name is kept as an alias in the sense that the family's declaration gains the role as its last fallback:

```
--sf-bg: var(--eac-surface-bg, var(--eac-ground, var(--paper, #fff)));
```

This is additive: nothing is removed, and the order of precedence stays. An app can set `--eac-ground` once and surface, fields, forms and blocks all follow. An app that sets the old name still wins. shadcn apps map in one place:
`--eac-ground: hsl(var(--background))`.

| Today's families | Where | Proposed role names | Notes |
|---|---|---|---|
| `--eac-surface-*` (17), `--sf-*` (50) | cms-ui surface.css | ground, ground-soft, ink, ink-muted, ink-faint, line, rule, accent, on-accent, danger, scrim, radius, shadow-panel, width-*, ease | `--sf-kind`/`--sf-on-kind` become `--eac-kind`/`--eac-on-kind`; `--eac-kind-<k>` stays |
| `--fld-*` (10), `--eac-field-*` (9) | wizard/fields.css | same roles; radius becomes radius-control | `--fld-accent` follows kind, falling to accent |
| `--eac-form-*` (~60), `--frm-*` (86) | studio-forms | same roles plus accent-ink, accent-soft, warn, shadow-pop, gap-5 | preview-, rail-, row-panel-, tag-, media- stay as forms extensions |
| `--eac-block-*` (27), `--blk-*` (36) | page-builder blocks.css | same roles plus ok, measure | band, wall, textimg, figure-offset stay as block extensions |
| `--eac-control-*` | elktours globals | same roles | shadcn bridge |
| `--background` ... `--radius` (HSL triplets) | every shadcn app | ground, ink, ground-soft, ink-muted, line, accent, on-accent, danger, radius | alias wraps in `hsl()` |
| `--font-*` (@elkdonis/fonts), `--dm-font-*`, `--eac-block-font-*`, `--eac-form-font-*` | fonts, danamccool, blocks, forms | font-body, font-title, font-nav, font-caption, font-reading, font-record | heading = title |
| `--dm-*` (22) | danamccool | fonts map; nav, caption, plate, diamond stay site-specific | declared in its Site style schema |
| `--ig-*` (141) | innergathering | gold = accent, paper = ground, black = ink; `--ig-a-<hex>-<n>` has no role | about 100 hard-coded translucent colours (`--ig-a-b79a55-35` and so on); the audit's top item |
| `--pts-header-h` | sunjay | header-h | |

The full 152-row map is in `design-system.json` (`aliases`). Counts are from a grep of apps and packages on 2026-11-20 and include built `.next-bak` output in a few cases, so treat them as order of magnitude.

Two findings the Development app should surface: (1) the same role is often defined by hand in several places per app (elktours maps `--eac-surface-*`, `--eac-block-*` and `--eac-control-*` to the same shadcn values in one file); (2) innergathering carries 141 `--ig-*` names of which most are single-use palette steps and translucent colours, written as variables but not roles.

## 4. What the wizard teaches the surface system, and back

**Wizard to surface.**

- **Use the room.** A sheet that needs two jobs (do and check) is two panes, not a taller single column. Surface sheets today are single-column prose; `wide` and `full` should offer a two-pane body slot (main 1.2fr, side 1fr).
- **Steps are pills with status**, not a bar, once names matter; the bar only for long onboarding (as `StepIndicator` already says).
- **Rows that unfold in place** beat a second popup for editing list items (stops, lots, questions).
- **A flow saves as it goes** and says so in the sheet's foot (`status` line: "Draft saved 14:02"). Surface's foot already has a status slot; make it the norm.
- **Readiness is a feature of the side pane**, not a validation error shown after Finish.
- **Draft, then publish**: the primary action changes meaning with state (Next, Publish, Offer dates).

**Surface to wizard.**

- **Kind tints the wizard.** The tour wizard is a `SurfaceFrame kind="event"`; the masthead, glyph and primary button already carry the event colour. Every flow should declare its kind.
- **A flow sheet opens from a face and stacks.** "Offer dates" opens the schedule sheet on top; the stack is the surface system's, keep it.
- **Size is chosen from the four widths**, and `full` is for flows with a map or a stage only. A text-only flow uses `wide`.
- **Fields use the shared controls** (`.eac-input`, `fld-*`); elktours' Tailwind field classes in `description-step.tsx` (`label`, `field`) would map onto them with no layout change.
- **Chrome stays out.** A flow in a sheet never restyles the page header; page chrome is Site style's.

**When to use which** (rule of thumb for the owner):

| Situation | Use |
|---|---|
| Read or glance at one thing; RSVP; a short edit (under about 6 fields, one job) | **Sheet** (standard or wide) opened from a face |
| Make or edit something with 2 to 5 stages, or anything with a map, preview or checklist | **Flow in a full sheet** (popup, two-pane) |
| Many things to browse, compare or sequence (a tour's stops, a hallway, a calendar month) | **Stage** (strip of faces plus a sheet that fills) |
| Something a visitor lands on from a link, search or a menu; long reading | **Page** |
| One sentence of context over what you are writing | **Compact sheet** (define kind) |

Heuristics: if the user must leave what they are doing to do it, it is a sheet over the thing, never a new page. If it needs to be shared by URL, it is a page (the surface router can still open it as a sheet from a face).

## 5. Open design questions for the owner

1. **One accent per site, or one per kind?** Today kinds each carry their own colour on a neutral site; elktours sets most to its brass.
   a) Kinds always differ (rainbow of kinds). b) Kinds default to the site accent, differ only where an app sets them (today). c) Two-tier: a site picks 3 to 4 kind colours for its own use.
   *Pick: b now; c later, when the Site style editor can set them.*
2. **Light theme.** The handoff doc says the palette is unsettled. a) Dark first, light derived. b) Both designed in parallel. c) Per-site choice only.
   *Pick: c: it is already how it works, and the role list makes a second theme a map, not a rewrite.*
3. **Naming of the layers.** a) face / sheet / stage / strip (as built). b) card / popup / page. c) Two words only: card and sheet.
   *Pick: a. These words already mean one thing each in the code.*
4. **How strong is the "one set of names"?** a) Aliases only, forever. b) Aliases, then apps migrate to the new names at their own pace, old ones removed later. c) Big-bang rename.
   *Pick: b, with the Development app's matrix showing who has moved.*
5. **Should the wizard's two-pane be the default for every popup that is not a plain read?** a) Yes. b) Only flows with a side-panel need (map, preview). c) Owner marks it per kind.
   *Pick: b.*
6. **What gets exposed to site owners in Site style?** a) Roles only (about 12 colours, 3 fonts, radius). b) Roles plus kind colours. c) Everything including per-part chrome.
   *Pick: a for most owners, c behind a fold ("More colours" already exists as a fold mechanism).*
7. **Hard-coded colours (innergathering, art-auction).** a) Leave. b) Convert to `color-mix` of roles once roles exist. c) Convert only when the app is next redesigned.
   *Pick: c; the Development app flags them so nothing is hidden.*

## 6. Suggested next steps (none done)

1. The Development app shows this: a token matrix (rows = roles, columns = apps), the alias map, and the four layers with live specimens. Hardcoded-value flags come from scanning each app's CSS, as R's research recommends.
2. Add the role list as a read-only preview in Site style (no stored change).
3. Add `pills` and status words to `StepIndicator`; add `two-pane` and `row card` as cms-ui parts, extracted from `create-tour/*`; elktours switches over with no layout change.
4. Add the role as the last fallback in `surface.css`, `fields.css`, forms `theme/` and `blocks.css` (a four-file, additive change, one session, needs the surface owner's working-tree edits to be committed first).

## 7. Things not verified

Token counts come from grep, not from a rendered check. I did not read every one of the 19 kinds' CSS rules nor the other apps' stylesheets beyond a count; the per-app theme table is C's and had not landed when this was written.
