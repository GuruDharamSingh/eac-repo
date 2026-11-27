# Theme system inventory, 2026-11-22 (read only)

Sources: apps/innergathering (ig), apps/amrit-canada, live signed-out pages, SELECTs on elkdonis_dev, packages/*. Live computed values were measured with a browser on https://elkdonis-arts.org/ (desktop, signed out) on 2026-11-22 evening.

## 0. Headline
- The live elkdonis-arts.org is in an experimental state. `site_themes` (org inner_group, page_key '') holds 13 vars that turn most grounds white/black (--background 0 0% 100%, --foreground 0 0% 0%, --primary/--secondary/--muted/--muted-foreground white, four beige `--ig-c-x-*` set to #ffffff, two `--ig-a-*` set to black alpha, --site-font-heading = Brothers). `site_config inner_group / site-style:chrome` holds hero + header overrides (header fill #000, brand 61px white upper-case, hero fill #fff 60px). `puck:landing` has black `look.fill` and white `look.color` on hero, about, offerings, grand-forum. `page-edits:home` fills the offerings section #000000. Updated 2026-11-22 14:35 (landing) and 19:43 (style).
- Why parts do not follow: there are 14 places a colour can be stored and only 5 are reachable from the Site style panel (section 2.3).

## 1. innergathering sections
Landing `/` = saved Puck tree `site_config inner_group / puck:landing` (12427 bytes). `src/app/page.tsx:127-143` renders it (`loadPage` + `swapLandingParts`). If the row were missing, the same page is drawn by JSX at page.tsx:152-330. Node types: `box`, `words`, `picture`, `part` (live code piece), `offerings-band` and `grand-forum` (registered blocks).

| # | Section | Drawn by | Where |
|---|---|---|---|
| 1 | Header/menu (global) | code, classes `.ig-topbar*` | src/components/site-header.tsx (nav = public org_feeds + hard-coded About/Login/Web-Portal, :34-73); css globals.css:512-545. Chrome overrides via `site-style:chrome` ([data-chrome=header]) |
| 2 | Hero "Opening" (eyebrow, h1, subtitle, gold rule, tagline, image, cue) | saved Puck boxes/words with `look` (inline css/fill/colour) | puck:landing node box-3miozl0i...; classes `.ig-hero*` in landing.css |
| 2a | Hero buttons | `part` hero-actions (code) | page.tsx:100-106 |
| 3 | Current Offerings | registered block `offerings-band` with settings + `morph` {root fill #000, heading #fffdf8} | src/components/landing/offerings-block.tsx, OfferingsBand.tsx |
| 4 | Sign-in banner | `part` login-banner (code, signed-out only) | page.tsx:119-139 |
| 5 | A Mutual Aid Society | saved Puck boxes/words, class `about-section`, each with `look` fill #000 / colour #fff, #fffefa, #fffdf8; heading font var(--ig-font-brothers) inline | puck:landing box-de7om18c... (an unused ABOUT_PATTERN of shared blocks exists at lib/puck/landing-blocks.ts:51) |
| 6 | Gallery | `part` gallery -> GallerySlider (code) | components/landing/GallerySlider.tsx |
| 7 | Join | `part` join -> JoinSection.tsx (code) -> `BaroqueSignup` from @elkdonis/cms-ui with its own palette | JoinSection.tsx:13 inline `background:var(--eac-bg)` (undefined in this app, no effect); landing.css:668-745, 852-935; packages/cms-ui/src/auth/baroque-signup.css |
| 8 | The Grand Forum | registered block `grand-forum` + `morph` {root fill #000}; forum embed = @elkdonis/forum-ui | components/landing/forum-block.tsx; forum.css, forum-theme.css |
| 9 | Fundraising | saved boxes with inline `var(--ig-a-fffdf8-82)`, `--ig-c-navy`, gold-dark; two live `part`s (progress bar, status) | puck:landing box-5y4h4xt2...; page.tsx:147-170 |
| 10 | Cities (Toronto/LA/Paris) | saved box, inline `background:var(--ig-c-x-2a5a2a)`, text `--ig-c-x-dde8d0`, `--ig-a-dde8d0-15` | puck:landing box-qz1v9hh2... |
| 11 | Board | saved boxes + `part` board-list (code) | page.tsx:172-190 |
| 12 | Vision quote | saved box, inline `--ig-c-navy-deep`, `--ig-a-c6ddff-78`, `--ig-a-b79a55-6`, Basteleur/Venture | puck:landing box-b3eeb7d2... |
| 13 | Footer (global) | code, `.bg-header-footer`, 16 inline style props, 15 `var(--ig-)` refs, "Leave a message" dialog | src/components/site-footer.tsx |
| - | /about | plain hard-coded JSX, no Puck: kicker/h1, lead, What is Art For, Three Qualities, Three Commitments, Board (getGuides), closing quote (inline --ig-font-x-basteleur-serif, --ig-c-navy-soft) | src/app/about/page.tsx; css globals.css:547-566 |
| - | /about/[slug] | shared PersonPage | cms-ui profile.css, person-page.css (43 literal colours, 0 theme vars) |
| - | /blog, /offerings, any feed `/[feed]` | code: FeedBanner (accent from org_feeds.accent), description, WritingShelf (blog only), ThreadCard grid, pull-quote class `amrit-quote` (no CSS defines it) | src/app/[feed]/page.tsx; cms-ui writing.css, surface.css |
| - | /terms | code + @elkdonis/cms-ui/data-policy `<Terms>` | src/app/terms/page.tsx; data-policy.css reads --policy-*; --eac-fg etc. undefined here |
| - | /forum, /login, /data, /posts, /meetings | shared packages (forum-ui, cms-ui) | |

Only ONE saved Puck page exists for the org (puck:landing). about/blog/offerings/terms have none.

## 2. Colours
### 2.1 Generated variables
`--ig-c-<name>` (41 opaque), `--ig-a-<hex6>-<alpha>` (88 translucent) and `--ig-font-*` (7) were generated once on 2026-11-20 (headers of src/lib/site-style-ig-vars.ts and site-style-ig-alpha.ts) from literals found in landing.css, globals.css, offering-call.css, page.tsx and the footer. Named ones (`navy-deep`, `gold`) are shared; unnamed ones become `x-<hex6>`: `--ig-c-x-f6efe2`, `-e8dcc8`, `-e9dfcc`, `-e3d3a6`, `-b9e0b0`, `-ffb4a8`, `-5a5240`, `-2a5a2a`, `-dde8d0`, `-f4c430`. Alpha name = hex of base + alpha digits (`--ig-a-fffdf8-82` = rgba(255,253,248,.82)). Defaults sit at src/app/globals.css:212-357 (:root). The panel schema (src/lib/site-style-schema.ts) spreads IG_COLOUR_VARS, IG_ALPHA_VARS (kind rgba) and IG_FONT_VARS, so these ARE panel-editable (the stored row already sets two alpha vars). The globals.css comment saying alpha vars are "not in the editor" is stale. `--ig-font-x-basteleur-serif` and `--ig-font-x-venture-serif` are NOT in the schema.
landing.css has no real colour literals (3 hex in comments only) and 215 refs to --ig-* vars. globals.css has no literals outside :root except the dark gradient at :448.

### 2.2 Colour groups (defaults; use counts from the generated hints and a var grep)
- Navy/ink: navy-deep #01124e (62 uses), navy #022278 (23), navy-soft #063179 (8), blue #104b8c (6), slate #4b5f85 (4), mist #c9d2e8 (2), slate-2/3/4 #33456b #2c3d61 #22325c (1 each). 9 values. Panel: yes. HSL twins: --foreground/--primary (226 97% 24%), --smoke, --muted-foreground.
- Gold: gold #b79a55 (20), gold-light #d6c38e (20), gold-dark #8f763c (11), gold-deep #7a6431 (3), gold-pale #f0db9d (2), gold-bright #c9a962 (1). 6 values, plus x-f4c430 (feed banner fallback) and x-e3d3a6. Twin: --gold, --ember.
- Beige/parchment (the "beige panel" family): paper #fffdf8 (18), parchment #fbf7ef (12), section #f3eadc (8), brown #6e5f4d, x-f6efe2 (2), x-e8dcc8, x-e9dfcc, x-e3d3a6, x-5a5240. 9 values. HSL twins --background (parchment), --card (paper), --secondary (section), --muted. THE JOIN PANEL'S BEIGE does not come from these: baroque-signup.css draws its own card with `--eac-bq-parchment #fbf7ef`, `--eac-bq-parchment-deep #f2eade`, input #fffdf9, ink #241b2f, soft ink #6a5f77, gilt #b08432, gilt-bright #e9cd86, violet #5b3e7a, vermilion #a8322b (packages/cms-ui/src/auth/baroque-signup.css:17-24; 17 distinct hex, 31 literals in the file). Grand Forum text fields use #fbf7ef (forum css). None of this is on the panel.
- Green/violet/red: moss #64726a, x-2a5a2a (Cities band), x-dde8d0, x-b9e0b0, violet #7c3aed, violet-light #a78bfa, red-dark #8b2e2e, x-ffb4a8. 8 values.
- Greys/black/white: grey-100 #f3f4f6, 300 #d1d5db, 400 #9ca3af, 500 #6b7280, black-soft #050505, black-warm #0a0a08, black #000, white #fff. 8 values.
- Translucent: 88 values (bases: navy-deep 12, navy-soft 7, gold b79a55 21, c9a962 6, c6a45a 5, fffdf8 11, others). Panel: yes.
- Stored looks: puck:landing `look.fill/color` = #000000 x7, #ffffff x6, #fffefa, #fffdf8 x2 (hex typed by the look panel, not variables). Block `morph`: offerings-band {root #000000, heading #fffdf8}, grand-forum {root #000000}. page-edits:home: offerings fill #000000. site-style:chrome: #ffffff, #000000. These never follow the theme.
- Shared-package literals (not theme-reachable): cms-ui surface.css 196 literals / 46 distinct hex (hard palette blocks at :3691, 3773, 3821), center.css 129/38, hub.css 75/21, writing.css 55/14, person-page.css 53/18, gallery.css 57/4, compose.css 35/15, baroque-signup.css 31/17, forum.css 48/28, forum-theme.css 73/32. They read --eac-surface-*, --read-*, --sf-*, --forum-*, which globals.css maps to --card/--foreground/--gold (HSL set, globals.css:158-210). So the HSL set reaches them and the --ig-c set does not.
- Per-feed accent: org_feeds.accent (DB) -> `--feed`, `--feed-glow`; fallback #E6B422 in components/manage/feed-editor.tsx:26.
- packages/ui/src/eac-theme.css defines --eac-bg #fbf7ef etc. but is NOT imported by this app; the served CSS has no `--eac-bg`.

### 2.3 Places a colour can be stored (14)
1 globals.css :root HSL tokens (about 22 colour tokens; panel exposes 11); 2 --ig-c-* (41, panel yes); 3 --ig-a-* (88, panel yes); 4 `site_themes.vars` (panel writes here); 5 `site_config site-style:chrome` (header/hero/footer parts, panel yes); 6 landing.css alias layer on `.marketing-root` (--color-gold, --color-bg-dark, --eac-ink, --panel-bg, mapped to ig vars; follows them); 7 `puck:landing` node `look` (hex, inline); 8 block `morph.parts`; 9 `page-edits:home` patches; 10 inline styles in code (page.tsx, about page 5 style props, footer 16, feed-banner); 11 shared-package CSS literals; 12 baroque-signup own --eac-bq-*; 13 org_feeds.accent; 14 `!important` pass blocks in landing.css (33 `!important`; e.g. :886-935 forces sections transparent and `.join-copy-column` to rgba(255,253,248,.76)).
Reachable from the panel today: layers 1 (partly), 2, 3, 4, 5. Not reachable: 7, 8, 9, 11, 12, 13 and the code literals.

### 2.4 Live computed colours, home page, signed out
Solid backgrounds, 16 distinct: #000, #fff, #fffdf8, #fffdf9, #01124e, #fbf7ef, #d6c38e, #b79a55, #2a5a2a, rgba(255,253,248,.74/.75/.76), rgba(0,0,0,.82), rgba(221,232,208,.15), rgba(183,154,85,.14/.4), plus 9 gradients. Text colours 24 distinct, border colours 19. Off-theme text in Join and elsewhere: #6a5f77, #241b2f, #2a2010, #3c4043, #33456b, #2c3d61, #22325c.
Black today: header, hero, offerings section, About band, forum section. White: offerings media and RSVP. Join inputs #fffdf9; forum textarea/input #fbf7ef; Cities band #2a5a2a.

## 3. Text
Fonts (public/fonts; @font-face at globals.css:44-80 and landing.css:1-7): Venture (display), Brothers (display sans; heading font after the stored override), Basteleur 400/700 (body). Incidental: Roboto (Google sign-in button in Join), ui-sans-serif (Tailwind fallback), optional Crimson Text / Cormorant Garamond (Google). Live families on `/`: Brothers 71 text nodes, Basteleur 17, ui-sans-serif 8, Venture 3, Roboto 1.
landing.css `.marketing-root` sets --font-serif and --font-sans BOTH to --site-font-heading (landing.css:31-32), so landing text follows the Headings setting, while globals.css:408-409 sets them to Venture / Basteleur.
Font variables: --site-font-body, --site-font-heading, --ig-font-text/brothers/display/crimson/mono (panel yes); --ig-font-x-basteleur-serif, --ig-font-x-venture-serif (used inline, no panel); --font-brothers, --font-venture, --font-display (globals.css:418-421, no panel).
Text styles: landing.css rule scan finds 6 family declarations, 34 distinct font-size values, 5 weights, 14 letter-spacings. Live page: about 57 distinct family|size|weight|tracking|case combinations (examples: Brothers 11.52px/400/1.38px upper = eyebrows; Brothers 13px/700/2.08px upper = nav; Basteleur 16px/400 = body; Brothers 61/80/90/100px = stored overrides). Only the family (heading/body) is panel-reachable. Sizes, weights, tracking are literals in CSS, inline in the saved page, or set by the chrome panel (hero/header/footer parts only).

## 4. Other look values
Radius: --radius 0.375rem (panel yes) drives --radius-sm/md/lg/xl; landing.css radii 4px (6), 3px (4), 6px (3), 999px (2), 8/12/14/2/5px; live: 4px x11, 2px x6, 50% x6, 3px x4, 6px x3, 5px, 14px. Shadows: 7 distinct in landing.css (all via --ig-a-* colours); live 6. Section spacing: --section-pad clamp(5rem,10vw,8rem) (landing.css:149, mobile :155), inline paddings (5rem 4rem Cities, 8rem 4rem Vision, 5rem 1.5rem Join); 27 distinct padding values in landing.css. Max widths: --content-max 1200px (landing.css:150) and 13 other values (1040, 1120, 1100, 1000, 980, 760...). Buttons: `.cta-btn` (52px high, 4px radius, gold border, 0.8125rem/500/0.1em upper), `.ig-hero-cta*`, `.ig-forum-btn*`, `.site-login-banner-btn`, `.eac-bq-cta`, shadcn buttons in the RSVP panel. Only --radius is on the panel. (landing.css counts come from a rule-level scan and may undercount slightly.)

## 5. Count summary (innergathering)
- Palette vars: 41 opaque + 88 translucent + about 22 HSL tokens. Live distinct colours: about 16 backgrounds, 24 text, 19 border. Near-identical groups: five-plus beiges (#fbf7ef, #f3eadc, #f6efe2, #f2eade, #e8dcc8, #e9dfcc) plus #fffdf8/#fffdf9; golds #b79a55 / #b08432 / #c9a962 / #8f763c; five navies.
- Fonts: 3 brand + 2 incidental. Text styles: about 57 live combinations.
- Colour storage places: 14. Panel reaches 5.

## 6. Amrit Canada (apps/amrit-canada)
- Public: https://amritcanada.ca (AMRIT_CANADA_URL; edge is openresty, vhost not in repo); container eac-amrit-canada, port 3006, docker-compose.yml:865-969. HTTP 200 signed out. Container created 2026-11-17 19:17, started 23:43; last git commit to the app 2026-11-17 11:50 -0500. Running build date not determinable (the start command builds only when .next is missing).
- 30 pages, mostly DB-driven shells (feeds `[feed]`, threads, about/guides, services, resources, hub, manage, write, writing). Hand-written prose only on `/resources` (two cards, a sequence list) and the home page (tagline, Guru Dharam milestones). The rest lives in the DB (org_site_sections, org_feeds, threads), unchecked. site_config rows for the org are not look data: center_layout, email:identity, living_documents, whiteboard (1.4 MB, Sept 2026). No site_themes row.
- Editor stack: none. Only @elkdonis/blocks (CycleBadge, SectionBanner). No page-builder, direct-edit, house-editor or Puck. No site-style/theme loader; layout.tsx has no style tag (static globals.css + next/font).
- Look: Tailwind v4 (no config file), globals.css 501 lines + writing-room.css 154 + guide-profile-card.module.css 303. :root HSL tokens at globals.css:77-212 (--background #F9F8F5, --foreground #36454F, --primary #E6B422, --accent #F7D858, terracotta, feed accents); --radius 0rem; `.dark` at 214-246.
- Colours: 27 distinct hex in app CSS (13 globals, 10 guide-card, 8 writing-room), 16 rgba, 2 hsl; 12 distinct hex in TSX (about 70 uses: #f4c430 x30, #fdf5e6 x12; site-header.tsx 29, kundalini-panel 11); Tailwind arbitrary colour classes text-[#f4c430] 14, text-[#fdf5e6] 12, bg-[#f4c430] 8, border-[#f4c430] 7. Fonts: Cinzel (400/600/700) and Lora (400/500/600 + italic) via next/font. About 6 text-style combos plus Tailwind size classes (text-sm 108, text-xs 41...).
- To take a theme like innergathering: add the `site_themes` loader (getThemeOverrides) and `siteStyleCss` style tag in layout.tsx; a schema file mirroring site-style-schema.ts; replace TSX hex (site-header, footer, resources, about, guide card) and the 27 CSS hex with variables; add the panel button + save action (canEdit auth) and the direct-edit dependency. Without Puck pages only the Site style layer applies.

## 7. Bon palette
Found, labelled: packages/gradients/src/palettes.ts:14-15 and :88-92, `BON_MINERAL` (three combinations from the Bon mandala and the tsakli card; the source is named as the Windows folder `Elkdonis Arts Collective/palettes/bon-mineral`, which was not checked):
- tsakli-card: ground #2A5A83, light #C3BFB5, mark #BC5149
- moss-orpiment: ground #37362D, light #6A7853, mark #C1AF6E
- mandala-dusk: ground #2C2B46, light #7F9364, mark #B77669
Same file :76-77, ramp "elements" ("Bon elements as tsakli pigments: water, wind, earth, fire, space"): #2C4A96, #548A5C, #E4CC4E, #C9483E, #E8E4D6. This is the only five-colour set found. ELEMENTAL (palettes.ts:24-33): Lapis #1F4E9A, Turquoise #2CA6A4, Forest #2E6B3F, Gold #D4A017, Orange #D45A1F, Red #B42A2A, Purple #6B3B8F, White #F5F5E5, Black #000000. packages/gradients/README.md:7-8, 67, 129-130 (built 2026-11-07, not wired to any editor). Other tsakli pigments: apps/development/src/ideas/manjushri/OneDocument.tsx:48-56 (Lapis #1f4e79, Cinnabar #c0392b, Orpiment #e0b23c, Malachite #2e7d5b, Conch #f6f1e4, Lamp black #1b1a17). docs/open/LIAISON/HOUSE_EDITOR_PM.md records the request "5-colour palette, Bon colours for elkdonis-arts.org" with no hexes. No Bon palette in apps/bonpo, nine-ways-lineage-tree, Astro Motion or stream assets.

## 8. Not determined
Feed slugs beyond blog/offerings (DB); the running amrit-canada build date; the Windows palette folder; scope of the surface.css palette blocks at :3691-3823; mobile colours; signed-in views; whether the header/footer `chrome` hooks cover every header/footer colour.
