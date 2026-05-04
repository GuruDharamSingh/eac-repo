# EAC Naming Conventions
> Reference for the workshop template and all future EAC blocks.
> Keep this file at the root of any EAC frontend package.

---

## File naming

```
eac-{block-name}.html          HTML template
eac-{block-name}.css           Styles for that block
eac-{block-name}.block.js      GrapesJS block + component registration
eac-{block-name}.component.js  GrapesJS component type (if split out)
```

Block names use **kebab-case**, always prefixed `eac-`.

| Template section        | File prefix                     |
|-------------------------|---------------------------------|
| Navigation bar          | `eac-ws-nav`                    |
| Workshop hero           | `eac-ws-hero`                   |
| Detail strip            | `eac-ws-detail-strip`           |
| About / description     | `eac-ws-about`                  |
| Facilitator bio         | `eac-ws-facilitator`            |
| Session schedule        | `eac-ws-schedule`               |
| Media gallery           | `eac-ws-gallery`                |
| Testimonials            | `eac-ws-testimonials`           |
| Related workshops       | `eac-ws-related`                |
| Registration block      | `eac-ws-register`               |

The `ws` infix scopes these to the **workshop template**.
Future templates use their own infix: `eac-ev-*` for events,
`eac-mem-*` for member profiles, etc.

---

## CSS class naming — BEM

```
.eac-{block}                   Block root
.eac-{block}__{element}        Element inside the block
.eac-{block}--{modifier}       Modifier on block or element
```

Examples:

```css
.eac-ws-hero                   /* section root */
.eac-ws-hero__inner            /* content wrapper */
.eac-ws-hero__headline         /* H1 */
.eac-ws-hero__pill             /* metadata pill */
.eac-ws-hero__btn              /* CTA button */
.eac-ws-hero__btn--primary     /* primary variant */
.eac-ws-hero__btn--ghost       /* ghost variant */
```

**Rules:**
- Never style HTML tags directly (`h1 { }`) — always a class
- Never nest BEM — `.eac-ws-hero .eac-ws-hero__btn` is wrong;
  `.eac-ws-hero__btn` stands alone
- Modifiers go on the element that changes, not the root:
  `.eac-ws-hero__btn--full-width` not `.eac-ws-hero--wide-btn`

---

## CSS custom property naming

```
--eac-{block}-{property}
```

Examples:

```css
--eac-ws-hero-bg              /* hero background colour */
--eac-ws-hero-accent-rgb      /* RGB triplet for glow + eyebrow */
--eac-ws-register-fill-rgb    /* capacity bar fill colour */
```

Global design tokens (not block-scoped) live in `shared/eac-tokens.css`
and use `--eac-` prefix only:

```css
--eac-color-primary
--eac-color-text
--eac-color-surface
--eac-radius-card
--eac-radius-pill
--eac-font-display
--eac-font-body
```

---

## Database / CMS field naming — snake_case

All Postgres columns and CMS field keys use `snake_case`.

| Convention            | Example                          |
|-----------------------|----------------------------------|
| Boolean fields        | prefix with `is_` or `has_`      |
| Date fields           | suffix `_at` (timestamp) or `_date` (date-only) |
| FK references         | `{table_singular}_id`            |
| Computed fields       | prefix `computed_` or document as VIEW |
| Enum fields           | no prefix, named for the concept |
| Array fields          | plural noun                      |
| Nextcloud media paths | suffix `_path` or `_paths`       |

Examples:

```sql
slug                   -- URL key
title                  -- display name
is_published           -- boolean
start_date             -- date only
created_at             -- timestamp
facilitator_id         -- FK → members
gallery_image_paths    -- text[]
price_sliding_min      -- nullable decimal
```

---

## GrapesJS component type IDs

Registered with `editor.Components.addType(id, ...)`.

```
eac-ws-hero
eac-ws-detail-strip
eac-ws-about
eac-ws-facilitator
eac-ws-schedule
eac-ws-gallery
eac-ws-testimonials
eac-ws-related
eac-ws-register
```

Panel block IDs (registered with `editor.Blocks.add(id, ...)`):

```
eac-ws-hero--block
eac-ws-detail-strip--block
...etc
```

Double-dash separates the component ID from the `--block` suffix,
keeping them visually distinct from BEM modifiers.

---

## Directory structure

```
eac-blocks/
  index.js                      Root barrel — registerAllEacBlocks()
  shared/
    eac-tokens.css              Global design tokens
    eac-base.css                Reset + typography base
  eac-hero-block/               Generic hero (built earlier)
  eac-feature-grid/
  eac-cta-glow/
  eac-testimonials/
  eac-pricing/
  eac-split-content/
  eac-logo-marquee/
  eac-stat-row/
  eac-contact-form/

eac-workshop-template/
  NAMING.md                     ← this file
  index.js                      registerAllWsBlocks()
  shared/
    eac-ws-tokens.css           Workshop-scoped tokens
  sections/
    eac-ws-nav/
    eac-ws-hero/
    eac-ws-detail-strip/
    eac-ws-about/
    eac-ws-facilitator/
    eac-ws-schedule/
    eac-ws-gallery/
    eac-ws-testimonials/
    eac-ws-related/
    eac-ws-register/
  cms/
    workshop.schema.sql         Postgres DDL
    workshop.schema.md          Human-readable field reference
```
