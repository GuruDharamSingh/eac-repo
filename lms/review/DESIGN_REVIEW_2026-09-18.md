# Sophia — independent front-end design review (2026-09-18)

Reviewed: the 14 screenshots in `lms/review/shots/`, `packages/lms-ui/src/{lms.css,pages.tsx,studio.tsx,parts.tsx,steps/StepBody.tsx,actions.ts}`, `apps/sophia/src/app/layout.tsx`, and the intent in `lms/SYNTHESIS.md` + the 12 principles in `lms/research/02_pedagogy_and_ux.md`.
Method: design-critique, WCAG 2.1/2.2 AA audit (contrast ratios computed from the CSS tokens), UX-copy review. No code was changed.
Line numbers refer to `lms.css` as it stands today (lines 1–268 are unchanged since the screenshots; the newer "pool" / `.so-links` section at 274–300 was read for consistency only and is commented on in §3.6).

**Not verifiable from the materials** (marked again where relevant): real keyboard/screen-reader behaviour, 200 % zoom, the login page, page `<title>`s (`metadata.ts` not reviewed), the host rich-text editor's own a11y, the signed-out view, cohort/circle view with other people's responses, flash messages in situ, and a truly *closed* step as a learner sees it (shot 08 was taken as staff, so it shows the body and a completion button rather than the closed callout).

---

## 1. Verdict

1. **The learner side mostly earns "quiet practice companion."** One column, warm paper, a serif reading face, no numbers, no percent bars, a calendar captioned "a gap is just a gap", and copy with a real voice ("A few words, if you like", "Another way in"). Text contrast is excellent throughout — every ink/ground pair passes AA in both themes.
2. **It breaks its own "one primary action" rule at the most important moment.** The practice/gathering step (shots 04, 05, 07) ends in two stacked buttons from two separate forms — "Keep these words" then "I did the practice" — and pressing the loud one silently discards whatever was typed in the box above it.
3. **It turns generic wherever Inter takes over from the serifs:** the outline list (02/03), the guide desk (10), every card, and the whole studio. Identical hollow circles, grey meta lines and 1 px hairlines read as a settings screen, and the Cormorant module headings are visually *weaker* than the Inter step titles beneath them.
4. **The studio is a form dump, not an authoring tool.** The step editor has no heading, four independent save buttons on one 3,737 px page, conditional fields that are always visible, a primary Save 2,300 px down, and an upload form that warns it will eat your unsaved work. A non-technical teacher will lose text here.
5. **Character is one decision away:** keep the palette, but let the *practice* block be the visual centre of the step page, make the outline a drawn path rather than a table, and restrict Inter to controls. No JS, no new assets.

---

## 2. Findings, ranked by impact

Severity: **A** = breaks a stated principle or loses user data · **B** = clear usability/hierarchy cost · **C** = polish.

### LEARNER

| # | Sev | Screen | Problem | Why it matters | Concrete fix |
|---|---|---|---|---|---|
| L1 | A | Step, shots 04/05/07 (bottom) | Two forms, two buttons. `pages.tsx:255-270` is the `respond` form (textarea + "Keep these words", quiet); `pages.tsx:280-292` is a *separate* `complete` form ("I did the practice" / "I was there", loud). `actions.ts:78-82` `complete` never reads `body`. Type a reflection, press the prominent button → the words are gone and you are redirected to the next step. | Silent loss of a private reflection is the worst possible failure for this product; also violates "one primary action" (principle 10) — the eye goes to the navy button, which is the one that does not save. | Make it one form with one loud button. In the `respond` form, when `def.completion === "manual" && !done`: render `<button class="so-btn" name="also" value="complete">I did the practice</button>` as the primary and demote "Keep these words" to a `so-linkbtn`-weight secondary (`<button class="so-btn so-btn--quiet" formnovalidate …>` is not needed if the primary has `formNoValidate` and the handler saves only a non-empty body). Handler: in `respond`, if `also=complete`, save body when non-empty, then `completeStep`, then redirect to `next`. Remove the standalone `complete` form whenever the reflection form is present. |
| L2 | A | Care page, shot 14 | `<article className="so-prose">` sits inside `.so-page--step`, so `lms.css:79` `.so-page--step > article { display:grid; gap:28px }` adds 28 px between every block *on top of* prose margins. Result: ~100 px voids around each h2, the page is 2,158 px tall on a phone, and "If you need help now" (9-8-8) is three screens down. | The one page someone may open in distress is the hardest to scan, and the crisis line is at the bottom. | (a) Wrap: `<main class="so-page so-page--step"><article><div class="so-prose">…</div></article></main>` or add `.so-page--step > article.so-prose { display:block }`. (b) Move "If you need help now" to the top as a `so-callout`, before the essay. |
| L3 | A | Journal 09, step 04 | "Remove" (`parts.tsx` `ResponseCard`, `actions.ts:94`) deletes immediately: no confirm, no undo, 14 px grey underlined text at the card corner, 32 px tall (`lms.css:109`). The journal header even promises "removing one really removes it". | Irreversible deletion of user-authored data with one mis-tap. WCAG 3.3.4. | No-JS confirm: wrap in `<details class="so-remove"><summary>Remove</summary><p>This can't be brought back.</p><button class="so-btn so-btn--quiet">Remove it for good</button></details>`. Or soft-delete for 7 days and flash "Removed. <a>Put it back</a>". |
| L4 | B | Course outline 02/03 | Hierarchy inversion. `.so-module h3` (`lms.css:123`) is Cormorant 1.375 rem/600, which at Cormorant's small x-height reads lighter than `.so-steps a` (`:129`) Inter 1.0625 rem/600. The roman numeral is a gold smudge (the "I" is nearly invisible in shot 02). Module summary and step summary are the same grey Inter. | The eye lands on step titles and never finds the modules; the "way through" has no shape. | `.so-module h3 { font-size:1.75rem; line-height:1.15; margin:0 0 6px; display:grid; grid-template-columns:2.5rem 1fr; }` `.so-module__n { font-size:1rem; font-family:var(--so-ui); font-weight:700; letter-spacing:.14em; align-self:center; }` `.so-steps a { font-weight:500; }` and set `.so-module__sum` in `var(--so-read)` italic. See §3.4 for the full "path" treatment. |
| L5 | B | Course outline 02/03 | Step state is nearly invisible. 13 of 14 rows are the same hollow "○"; "closed" is only `opacity:.55` (`lms.css:135`) → computed 2.33:1 light / 3.05:1 dark; "you are here" (the Continue target) is not marked in the list at all. | Principle 11 ("always one obvious Continue") holds in the hero but is lost once you scroll; locked steps look tappable. | Mark the continue step: `li[data-here] { background:var(--so-sheet); box-shadow:inset 3px 0 0 var(--so-accent); padding-left:12px; }` plus a text kicker "You are here". Closed: drop opacity; render the title as plain text in `--so-ink-3` (not a link) with the "Opens 1 January 2030" line; use "◌" or a small lock glyph at full `--so-ink-3`. |
| L6 | B | Step 04/05 | The practice block (`.so-practice`, `lms.css:174`) is the point of the page but is the *quietest* thing on it: wash is 1.11:1 against paper, heading 1.375 rem — smaller than "A few words" (1.5 rem) below it. | "Practice over content" (principle 1) should be visible in the hierarchy. | `.so-practice { background:var(--so-sheet); border:1px solid var(--so-rule); border-top:3px solid var(--so-gold); padding:28px 24px; }` `.so-practice h2 { font:700 .75rem var(--so-ui); letter-spacing:.14em; text-transform:uppercase; color:var(--so-gold); }` `.so-practice p { font-size:1.3125rem; line-height:1.6; }` |
| L7 | B | Step 04 | Reflection form order: existing card → empty 6-row textarea "Add to it…" → radios → button. When a reflection already exists, a second large empty box is the biggest element on the page. | Reads as an unfinished task; pressure, not invitation. | When `reflections.length > 0`, put the add-form in `<details><summary>Add to it</summary>…</details>`; `rows={4}`. |
| L8 | B | Step 04/07 | Visibility radios: help text runs to three lines per option on a phone; with four options (circle + public) this block is ~300 px. The chosen state is only the native radio. | The privacy choice is the trust moment; it should be glanceable. | Keep the label bold on its own line, help below in `.so-meta`; show help for the *checked* option strongly and the rest muted: `.so-vis label:has(input:checked) { color:var(--so-ink); } .so-vis label:not(:has(input:checked)) span > :not(strong) { display:none }` (CSS only; falls back to all-visible where `:has` is missing). |
| L9 | B | Chrome, all phone shots | Header wraps to three rows on 390 px (brand / links / username) = 122 px before content; the username is unlinked grey text orphaned on its own line. "Guide desk" and "Studio" are shown to the learner-in-a-guide on every reading page. | 15 % of the first screen is chrome; "quiet" means the page should start with the step. | On `.so-page--step` pages render a slim header (brand + "Journal" only). `@media (max-width:520px) { .so-top { padding:10px 16px; } .so-top nav { font-size:.875rem; gap:4px 14px; } }` and move the name into the footer or make it the Journal link's label. |
| L10 | B | Step 04/06 | Prev/next ("BEFORE / AFTER", `lms.css:216-220`) duplicates the Continue button directly above it and on a phone stacks to two more rows. | Three "go forward" affordances in one screen (button, After, outline). | Keep prev/next (SEO needs the links) but quiet it: one row even on phones (`grid-template-columns:1fr 1fr` always, titles `font-weight:500; font-size:.9375rem`), labels "← Before" / "After →". |
| L11 | C | Home 01 | `h1` "Sophia" directly under the "Sophia" wordmark; the tagline is Inter. The signed-in home's real job ("Continue") is inside a card at the third level. | Wasted first impression; the catalogue page has no character. | Signed-in: drop the h1 hero, lead with the Continue card full-width (h1 = "Where you are", visually hidden if wanted). Signed-out: keep h1 but set the tagline in `--so-read` italic. |
| L12 | C | Step 06/07 | `.so-lede` (`:146`) is ink-2 serif 1.1875 rem, body `.so-prose` is ink 1.125 rem: lede and body differ by 1 px and a grey. | Weak head/body separation. | Lede: `font-style:italic; font-size:1.25rem; color:var(--so-ink-2)`; add `border-bottom:1px solid var(--so-rule); padding-bottom:20px` to `.so-step-head`. |
| L13 | C | Dark 05 | Native `<audio>` is a light-grey pill; unchecked radios render as filled dark discs that look disabled. | Dark mode is where evening practice happens. | `color-scheme: dark` is set on `.so-root`, but native controls take it from the document: add `<meta name="color-scheme" content="light dark">` / `:root { color-scheme: light dark }` in `globals.css`. Radios: see A11y #3. |
| L14 | C | Thread card 07 | `.so-ref` excerpt shows raw forum text ("…We Meet for 10 mins… dayz…") in Inter beside polished serif. Three-line excerpt + dl + button makes the card taller than the practice. | Borrowed content sets the tone of the step. | Clamp the excerpt to 2 lines (`-webkit-line-clamp:2`, as `.so-poolitem__desc` already does at `:289`). |

### GUIDE

| # | Sev | Screen | Problem | Why it matters | Concrete fix |
|---|---|---|---|---|---|
| G1 | A | Guide desk 10 | The answer box is a 2-row textarea squeezed beside an "Answer" button (`.so-form--inline`, `lms.css:229`), visually detached from the response it answers (8 px gap, separate box). | SYNTHESIS calls acknowledgement "the feature that matters most". This looks like a comment field on a ticket. | Put the form *inside* the response card under a gold rule, mirroring how `.so-ack` will look once sent: `.so-entry .so-form--inline { grid-template-columns:1fr; border-left:3px solid var(--so-gold); padding-left:14px; }`, `rows={3}`, button below, label visible: "A word back". |
| G2 | B | Guide desk 10 | Kicker inconsistency: the page kicker is gold, the per-entry kicker (`a.so-kicker`) is accent-blue because `.so-root a` (`:54`) wins over `.so-kicker` colour; same on the journal (09). | Two colours for one role; blue uppercase looks like a nav tab. | `.so-root a.so-kicker { color:var(--so-gold); }` and underline on hover only. |
| G3 | B | Guide desk 10 | The `h1` changes between "Waiting on a word from you" and "Everything shown to you", and the toggle is a bare link under the intro. Roster sections for empty groups show a heading and nothing else ("A little at a time (drip) · 0 people"). | The filter state is hidden in the headline; empty sections are noise. | Stable h1 "Guide desk"; two-link switch `Waiting (1) · All` with `aria-current="page"`. Hide runs with 0 people behind `<details>` or print "No one yet." |
| G4 | B | Guide desk 10 | The roster table shows "Steps done" as a bare count and "Last here" as a date; nothing identifies who has gone quiet or who wrote a private note. The count in `h2 .so-meta` inherits Cormorant ("· 1 person" in tiny serif). | The guide's job is noticing people; the table does not help and the numeral is what principle 7 warns about. | Replace "Steps done 1" with the step title they are on; sort by last-here. `.so-h2 .so-meta { font-family:var(--so-ui); }`. |
| G5 | C | Guide desk 10 | The placeholder is the only visible label ("A word back to sophia-author…"). | Disappears on typing; see A11y #6. | Visible `<label>`; keep the placeholder empty. |
| G6 | C | Guide desk | Audio acknowledgement is rendered (`parts.tsx` `a.audioUrl`) but there is no way to record/attach one in the form. | Principle 6 names audio replies. | Not verifiable whether planned; at minimum an `<input type="file" accept="audio/*" capture>` in the answer form. |

### STUDIO

| # | Sev | Screen | Problem | Why it matters | Concrete fix |
|---|---|---|---|---|---|
| S1 | A | Step editor 12/13 | Four independent forms on one page — Save (primary, y≈840 of 3,737), "Upload and add", "Save when it opens", "Take this step out" — and the upload help text says "Save the form above first — uploading reloads the page". | Guaranteed lost work for a teacher who types, then uploads. The software is asking the user to work around its own structure. | See §4. Minimum: make upload part of the main form (`multipart`, handler saves fields then file), so there is one Save. |
| S2 | A | Step editor 12/13 | No `h1`, no statement of which step or state you are editing; the page opens on a breadcrumb and a "Title" input. No "see it as a reader" link, no "unpublished changes" indicator, no way back except the breadcrumb. | Orientation; also A11y (2.4.6, 1.3.1). | `<header class="so-step-head"><span class="so-kicker">Editing · Practice · unpublished changes</span><h1>{step.title}</h1><div class="so-hero__act"><a class="so-btn so-btn--quiet">See it as a reader</a></div></header>` |
| S3 | A | Step editor 12 (bottom) | "When it opens" always shows "…which module", "…how many days", "…which date" regardless of the rule chosen. | Three irrelevant inputs for the default case; a teacher cannot tell which apply. | CSS-only: make the rule a radio group and place each dependent field inside its radio's label block: `.so-rule-opt .so-dep { display:none } .so-rule-opt:has(input:checked) .so-dep { display:grid }`. Fallback without `:has`: all visible (today's behaviour). |
| S4 | B | Course page 11 | The outline rows carry two 44 px bordered boxes each (`.so-mini`, `lms.css:266`) — 28 boxes on this page; the first step's ↑ and the last step's ↓ are rendered but do nothing; there is no way to move a step to another module. Each move is a full reload that (not verified) returns to the top of the page. | The arrows are the loudest thing in the outline; reordering eight steps is 20+ reloads. | (a) Hide no-op arrows (`visibility:hidden` to keep alignment). (b) `back={`${here}#${m.id}`}` so the reload lands on the module (`.so-module`'s `scroll-margin-top` pattern already exists). (c) Borderless arrows: `.so-ssteps .so-mini { border-color:transparent; }` with hover wash. (d) Add a "Move to…" `<select>` of modules on the step editor. (e) JS enhancement later: drag handle that posts the same `move-step` ops. |
| S5 | B | Course page 11 | The module `<summary>` says "· 8 steps · rename, move" — the affordance for editing a module is a hint in grey text inside a disclosure triangle. The triangle suggests it expands the *steps*, but the steps are always visible; it actually reveals the rename form. | Wrong mental model; teachers will not find rename. | Make the module title a plain `h3`, and put a right-aligned `<details class="so-modtools"><summary>Edit module</summary>…</details>`. |
| S6 | B | Course page 11 | Publish panel when clean is a large empty card at the top ("Nothing is waiting."); when dirty it is a gold left border only (`:252`). Section order is Publish → Outline → About → Groups, so the thing you do last is first. | The top slot should answer "what state is this course in?" in one line. | Clean state: a single `.so-meta` line in the hero ("Published 18 Sept · readers have everything"). Dirty state: the full panel, plus repeat a slim "3 changes not yet published · Publish ↓" `so-callout` link at the top. |
| S7 | B | Step editor 13 | "Kind" `<select>` options embed the description ("Practice — Something to do, make or notice. Every module should have one."); truncated on a phone to "Practice — Something to do, make or no". | Unreadable choice; long options are also poor in screen readers. | Short option labels; show `def.describe` for the current kind as a `.so-meta` line under the select. Better: radio cards (7 kinds) each with its one-line description. |
| S8 | B | Step editor 12 | Input ground inconsistency: inputs/textareas are `--so-sheet`, the host rich-text editor is a wash-grey box with a 12 px toolbar of ~20 px low-contrast icons (shot 12, y≈530). Practice textareas are serif 17 px, the body editor is sans 14–15 px. | The main writing surface is the least inviting control on the page. | Pass the editor Sophia's tokens (background `--so-sheet`, content font `--so-read` 1.0625 rem, toolbar button min 32 px). Editor internals not verified — host component. |
| S9 | B | Step editor 12 | Media rows: an always-present blank "add another" row with four fields; "clear to remove" as the deletion mechanism; Kind select precedes Link. | 8 visible fields for one bell sound; removing by clearing a URL is undiscoverable. | Show existing media as a compact summary row with `<details>` to edit and an explicit "Remove" checkbox (`name=media_remove_i`); put the blank row inside `<details><summary>Add by link</summary>`; put upload beside it as the first-class path. |
| S10 | C | Course page 11 | "Address: https://sophia.arts-collective.com/" is label text above a full-width input, rather than a prefix. Changing it has no warning that links change (redirects exist, per `resolveRedirect`, but the teacher cannot know). | Anxiety / accidental slug edits. | Inline prefix layout (`display:flex`, prefix in `.so-meta`), and help: "Old links keep working." Move under an "Advanced" `<details>`. |
| S11 | C | Groups 11 | Group rows repeat the guide's full name three times; "Forum category for its conversations" asks for a raw feed slug (`elkdonis-path`); "Tied to a gathering — forum link or id". | Non-technical teacher cannot answer these. | `<select>` of the org's feeds; keep paste-a-link, drop "or id". |
| S12 | C | Studio home (code only) | "Start a course" has no template/blueprint and the three backward-design questions (principle 2) are compressed into one input label. | The wizard promise is not yet visible. | Three short inputs: who it's for / what changes / how they'll notice → concatenated into summary. Not shown in screenshots. |

---

## 3. Visual identity

### 3.1 What is there
Three faces: Cormorant Garamond (titles), Source Serif 4 (reading), Inter (UI). Palette: warm paper `#f6f3ec`, indigo `#2c3c7a`, ochre `#7a5a12`. 4 px radii, 1 px hairlines. It is tasteful and it is the 2020s "calm app" default; nothing in it says *arts collective* or *contemplative*.

### 3.2 Typography — opinionated changes
- **Inter is doing too much.** It sets hero paragraphs, card copy, step titles, summaries, meta, the guide intro. Rule: *Inter only on things you press or fill in, and on kickers/meta.* Everything a person reads as a sentence is Source Serif.
  - `.so-hero > p`, `.so-card p`, `.so-steps p`, `.so-module__sum`, `.so-with p`, `.so-ref p` → `font-family: var(--so-read)`.
  - `.so-steps a` → `font-family: var(--so-read); font-weight:600; font-size:1.125rem`.
- **Cormorant needs size to work.** It has a small x-height; at 1.375–1.5 rem it looks thinner than neighbouring 17 px Inter. Either go up or stop using it at h3 level.

Proposed scale (major-third-ish, rem):

| Token | Value | Use |
|---|---|---|
| `--so-t-display` | `clamp(2.5rem, 8vw, 3.75rem)` / 1.02 / Cormorant 600 | course h1, journal h1 |
| `--so-t-h1` | `clamp(2.125rem, 6.5vw, 3rem)` / 1.08 | step h1 |
| `--so-t-h2` | `1.75rem` / 1.15 (now 1.5–1.625) | section heads, module titles |
| `--so-t-h3` | `1.375rem` / 1.2, Source Serif 600 (not Cormorant) | card titles, prose h3 |
| `--so-t-practice` | `1.3125rem` / 1.6 Source Serif | the practice text |
| `--so-t-body` | `1.125rem` / 1.7 (keep; ≥18 px meets the research note) | prose |
| `--so-t-ui` | `1rem` / 1.4 Inter | controls |
| `--so-t-meta` | `.875rem` / 1.5 Inter | meta |
| `--so-t-kicker` | `.75rem` / 1 Inter 700, `.14em` | kickers |

Also: `font-variant-numeric: oldstyle-nums` on `.so-prose`, `.so-practice`; `text-wrap: balance` on all headings and `.so-lede`; `text-wrap: pretty` on prose; `hanging-punctuation: first` on `.so-prompt`. Set `html lang="en-CA"` (the copy is "practise").

### 3.3 Spacing rhythm
Today: gaps of 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 40 px appear — effectively no scale. Adopt an 8-based set with one "breath":

```css
--so-s1: 4px;  --so-s2: 8px;  --so-s3: 12px; --so-s4: 16px;
--so-s5: 24px; --so-s6: 32px; --so-s7: 48px; --so-s8: 72px;
```
- Page gutter: `--so-s4` on phones (now 20), `--so-s5` ≥ 600 px.
- Between sections on a step page: `--so-s7` *before the practice* and *before the reflection*, `--so-s5` elsewhere. Today everything is a uniform 28 px (`:78-79`), which is why the step page reads as a list of boxes rather than reading → **doing** → writing.
- Card/box padding: `--so-s5` everywhere (now 14/16/20/22).
- Radius: pick one. `--so-radius: 3px` for everything; pills only for `.so-chip`. (Now 2/3/4/6/999.)

### 3.4 Colour
Keep the hues; fix the roles.

```css
/* light */
--so-paper:  #f6f3ec;   /* keep */
--so-sheet:  #fffdf8;   /* keep */
--so-wash:   #ece7da;   /* keep, but stop using it as the practice ground */
--so-rule:   #d9d3c4;   /* decorative rules only */
--so-field:  #857e6b;   /* NEW: borders of inputs/buttons — 3.65 paper / 3.98 sheet / 3.27 wash */
--so-gold:   #6b4e0e;   /* was #7a5a12 (5.2–6.3). 6.25 on wash, 6.96 paper: lets gold kickers sit on any ground incl. a deeper wash */
/* dark */
--so-field:  #6f7a99;   /* 4.31 paper / 3.98 sheet / 3.54 wash */
```
All current text pairs pass (computed): light ink 12.7–15.4, ink-2 6.4–7.8, ink-3 5.3–6.4, accent 8.4–10.2, gold 5.2–6.3, err 7.0–8.5, ok 6.5–7.8, white on accent 10.3; dark ink 12.8–15.6, ink-2 8.6–10.4, ink-3 6.0–7.3, accent 7.9–9.6, gold 7.8–9.5, on-accent 9.6. The header comment in `lms.css` is accurate (slightly conservative).

Roles: **indigo = things you press. Gold = the teaching's voice** (kickers, the practice, the guide's answer, blockquotes). Today gold and indigo both appear on kickers (G2) and `.so-mark[data-state="started"]` is gold while "done" is green — a third accent. Drop green from the outline: done = filled ink dot, begun = half dot in ink, here = indigo. Green stays only for flash messages.

### 3.5 The two key pages

**Step page — make it a score with three movements.**
1. *Head*: kicker ("Practice · 5 min") in gold caps, h1, italic lede, hairline.
2. *Take in*: media + prose on bare paper.
3. *Do*: the practice on a sheet with a 3 px gold top rule, caps label "THE PRACTICE", text at 1.3125 rem. This is the only boxed thing above the fold. `--so-s7` above and below.
4. *Write*: prompt in italic 1.375 rem with a hanging opening quote mark or a gold em-rule above it; textarea *borderless except a bottom rule* on paper (a journal line, not a form field): `border:0; border-bottom:1px solid var(--so-field); background:transparent; padding:12px 0;` — this single change removes most of the "form app" feel on the learner side. Visibility as a compact row. **One** button.
5. *After*: private word to guide, prev/next, all at meta weight.

**Course outline — draw the path.** CSS only:
```css
.so-steps { position:relative; margin-left:6px; border-left:1px solid var(--so-rule); }
.so-steps li { grid-template-columns:minmax(0,1fr); border-top:0; padding:12px 0 12px 22px; position:relative; }
.so-mark { position:absolute; left:-6px; top:18px; width:11px; height:11px; border-radius:50%;
           border:1.5px solid var(--so-ink-3); background:var(--so-paper); font-size:0; }
.so-mark[data-state="done"]    { background:var(--so-ink); border-color:var(--so-ink); }
.so-mark[data-state="started"] { background:linear-gradient(90deg,var(--so-ink) 50%,var(--so-paper) 50%); border-color:var(--so-ink); }
li[data-here] .so-mark { border-color:var(--so-accent); box-shadow:0 0 0 4px var(--so-paper), 0 0 0 5px var(--so-accent); }
```
(`font-size:0` hides the glyph; keep the accessible name — see A11y #4.) A vertical line with dots is the oldest "path" device there is; it replaces 14 hairlines with one, gives the module a shape, and costs nothing. Module numerals become small-caps Inter in gold to the left of a large Cormorant title.

**One signature detail.** A small ornament between movements instead of hairlines: `.so-break::before { content:"·  ·  ·"; letter-spacing:.5em; color:var(--so-gold); display:block; text-align:center; }` used at most twice per page (before the reflection, before prev/next). Replace the remaining `border-top` rules on `.so-note`, `.so-prevnext`, `.so-foot` with space.

### 3.6 Consistency notes on the newer CSS (pool / links; not in screenshots)
- `.so-poolitem` / `.so-poolhits li` / `.so-links a` repeat the sheet+rule+4 px card a fifth, sixth and seventh time with paddings 10/14, 16, 14/16. Extract `.so-box { background:var(--so-sheet); border:1px solid var(--so-rule); border-radius:var(--so-radius); padding:var(--so-s4) }`.
- `.so-poolitem[data-kind]` encodes kind by left-border colour/style alone (gold / accent / dashed) — needs a text kicker too (WCAG 1.4.1); rule-vs-sheet is 1.47:1 so the "default" and "note" variants are indistinguishable for many people.
- `.so-poolitem__act select { width:100% !important }` — a specificity patch for `.so-form--row select { width:auto }` (`:250`); fix the source rule instead.
- `.so-poolitem__act summary { min-height:32px }` vs 44 px for every other `summary` (`:162`, `:256`).
- `.so-links a:hover { border-color }` only — add the same for `:focus-visible` is unnecessary (outline exists) but hover should also change something ≥3:1; fine with `--so-field`.

---

## 4. Studio usability for a non-technical teacher

Constraint respected: everything below works with no JS; JS suggestions are marked as enhancement.

### 4.1 Step editor (3,737 px desktop / 4,194 px phone)
**Restructure into one form, five numbered sections, one sticky save.**

```
Editing · Practice · unpublished changes            [See it as a reader]
h1  A practice, with audio

1  What it is          title · kind (radio cards) · summary · minutes        (open)
2  What they take in   body editor · media list · upload · add by link       (open)
3  The practice        what to do · another way in · question                (open)
4  Linked gathering    forum link                                            (closed unless set / needsThread)
5  When it opens       required? · rule radios with nested fields            (closed; summary shows "required · in order")
   Advanced            address (slug) · take out of the outline              (closed)

[ sticky bar:  Save step      · last saved 14:02 ]
```

- Each section is `<details class="so-sec" open?>` with a `<summary>` that shows a **one-line digest of its current value** ("Required · opens in order", "1 audio file", "No gathering linked"). Closed sections with digests let the teacher see the whole step in one screen — that is the real fix for 3,737 px. Expected height with 4–5 and Advanced closed: ~1,500 px desktop.
- `<details>` contents still submit when closed, so one `<form>` can wrap everything. Merge `set-rule` into `studio-save-step` (handler change; rule fields are already plain inputs). Merge upload by making the main form `multipart` with an optional file input (handler: save fields, then store file if present). "Take this step out" stays its own tiny form in Advanced.
- **Sticky save, no JS:**
  ```css
  .so-savebar { position:sticky; bottom:0; display:flex; gap:12px; align-items:center;
                padding:12px 0 calc(12px + env(safe-area-inset-bottom));
                background:linear-gradient(transparent, var(--so-paper) 30%); }
  .so-root { scroll-padding-bottom: 96px; }   /* WCAG 2.4.11: focused fields not hidden under the bar */
  ```
- Kind → radio cards with descriptions (S7). Changing kind after content exists: state plainly what changes ("A reflection step is completed by answering its question").
- Conditional rule fields via `:has()` (S3).
- Practice fieldset first-or-second, not after an empty 280 px editor: for a *Practice* step the body is often empty (it is in shot 12), so the biggest box on the page is the unused one. Order sections by kind: practice-first for practice/session, body-first for reading.
- After save, return to `#section` of the button pressed (`back` + hash) and flash "Saved. Not published yet — <a>publish</a>".
- JS enhancement (studio only): `beforeunload` dirty guard; autosave draft to `localStorage`; character counter on the 200-char summary; auto-grow textareas. None required.

### 4.2 Outline with up/down buttons
Keep the no-JS arrows but fix the cost: anchor-return after each move, hide no-op arrows, borderless style, per-step "Move to module…" select on the step editor, and distinct accessible names ("Move *A reading* up"). Add-step row: put the kind select *before* the title ("Add a [Practice ▾] called [………] [Add]") — reads as a sentence and works on phones where the row already stacks. Consider showing a gentle warning when a module has no practice step ("This module has no practice yet") — the principle is currently only a paragraph of advice above the outline.

### 4.3 Publish panel
- One-line state in the hero when clean; full panel only when dirty (S6).
- In the dirty panel, make each changed step a link to its editor and offer "See the draft as a reader" (preview of unpublished — not verifiable whether the route exists; "See it as a reader" currently shows the *published* version, which a teacher will misread as a preview).
- The missing-summaries error is good and specific; make each missing title a link.
- Button label: "Publish these changes" (or "Publish for the first time"). After publish, flash what happens to groups under way.

### 4.4 Groups
- The always-open default run ("At your own pace") is presented as a peer of cohorts with the same editable fields; most of them (Begins, Places, Who joins) are meaningless for it. Show it as a read-only line with only "guides" and "reflections start as" editable.
- "Open a new group": four of six fields are optional/advanced. Show Name, Kind, Begins; put Places, gathering link and forum category under "More".
- Replace the free-text forum category with a select. Show the join link for the group once created.
- "Add a guide by email": say what happens if the email has no account (not verifiable).

---

## 5. Accessibility (WCAG 2.1 / 2.2 AA)

**Summary:** 17 issues — 3 critical, 8 major, 6 minor. Text contrast: no failures.

### Contrast check (computed from tokens)
| Element | FG | BG | Ratio | Need | Pass |
|---|---|---|---|---|---|
| Body ink | #1c2333 | paper/sheet/wash | 14.2 / 15.4 / 12.7 | 4.5 | yes |
| ink-2 | #4a5164 | " | 7.2 / 7.8 / 6.4 | 4.5 | yes |
| ink-3 (meta, placeholder) | #565e70 | " | 5.9 / 6.4 / 5.3 | 4.5 | yes |
| Links / accent | #2c3c7a | " | 9.3 / 10.2 / 8.4 | 4.5 | yes |
| Gold kicker (12 px bold) | #7a5a12 | " | 5.7 / 6.3 / 5.2 | 4.5 | yes |
| Button text | #fff | #2c3c7a | 10.3 | 4.5 | yes |
| Dark: ink / ink-2 / ink-3 / accent / gold on wash | — | #1c2540 | 12.8 / 8.6 / 6.0 / 7.9 / 7.8 | 4.5 | yes |
| **Input, textarea, select, `.so-mini`, card borders** | #d9d3c4 | paper / sheet | **1.35 / 1.47** | 3 | **no** |
| **Same, dark** | #2b3553 | #0e1422 / #151c2e | **1.52 / 1.40** | 3 | **no** |
| **Closed step mark** (`opacity:.55`) | ≈#9ea1a8 | paper | **2.33** (dark 3.05) | 3 | **no** (light) |
| Sheet vs paper (the only other cue for a field) | | | 1.09 | — | — |
| Focus ring | accent | any ground | ≥ 7.9 | 3 | yes |

### Findings
| # | Issue | Criterion | Sev | Fix |
|---|---|---|---|---|
| 1 | Form-control boundaries 1.35–1.47:1 (`lms.css:185, 239, 266`); fields are identified only by a near-invisible border and a 1.09:1 fill. | 1.4.11 Non-text Contrast | Critical | `border-color: var(--so-field)` (#857e6b light / #6f7a99 dark) on inputs, textareas, selects, `.so-mini`, `.so-btn--quiet` already uses accent (ok). |
| 2 | Deleting a reflection/journal entry is immediate and irreversible (L3). | 3.3.4 Error Prevention (user-controllable data) | Critical | Confirm step via `<details>` or undo. |
| 3 | Practice step: primary button discards entered text (L1). | 3.3.4; also 3.2.4-adjacent predictability | Critical | One form. |
| 4 | `StepMark` is `<span aria-label title>` with no role (`parts.tsx`); `aria-label` on a generic is not reliably announced (and prohibited by ARIA 1.2). Same for `.so-dot` in `layout.tsx:33`. Status is otherwise conveyed by glyph shape/colour only. | 1.3.1, 4.1.2, 1.1.1 | Major | `<span class="so-mark" aria-hidden="true">●</span><span class="so-sr">Done: </span>` before the link text; for the dot: `<span class="so-dot" aria-hidden/> <span class="so-sr">— your guide has answered</span>`. |
| 5 | 28 outline buttons all named "Move up"/"Move down" (`studio.tsx` `Mini`: `aria-label={title}`), indistinguishable in a buttons list or by voice control; glyph-only visible label. | 2.4.6, 4.1.2, 2.5.3 | Major | `aria-label={`Move “${title}” up`}`; hide no-ops. |
| 6 | Visible labels missing: reflection textarea (`pages.tsx:256`), guide note, guide answer, "New step…", "New module…", "Add a guide by email…" use `.so-sr` labels + placeholder. Placeholder vanishes on input. | 3.3.2 Labels or Instructions (sighted users), 2.5.3 | Major | Visible labels for the studio/guide ones. For the reflection box the prompt `<p>` can be the label: `aria-labelledby="reflect-h prompt-id"` and keep a visible h2 — acceptable. |
| 7 | Error flash uses `role="status"` (`parts.tsx` `Flash`); errors should interrupt. Flash is also the only error mechanism: no field-level identification, and after a failed post the typed text is (not verified) lost on redirect. | 3.3.1 Error Identification, 4.1.3 Status Messages, 3.3.3 | Major | `role={error ? "alert" : "status"}`; on failure, re-render with the submitted values and point at the field (`aria-describedby`, `aria-invalid`). |
| 8 | Studio step page has no `h1`; first heading is an `h2` "Upload a file" two screens down; fieldset legends are the only structure. | 1.3.1, 2.4.6 | Major | Add h1 (S2); section headings. |
| 9 | No skip link; header nav precedes `main` on every page. Landmarks otherwise good (`header`/`nav[aria-label]`/`main`/`footer`), but there are up to three `nav`s plus the in-page `<footer class="so-foot">` inside `main`. | 2.4.1 Bypass Blocks | Major | `<a class="so-skip" href="#main">Skip to the step</a>`; `main id="main"`. `.so-skip { position:absolute; left:-999px } .so-skip:focus { left:16px; top:8px; … }` |
| 10 | `<label>` wraps the host rich-text editor (`studio.tsx:177-179, 285-287`). A label's activation behaviour forwards clicks on non-interactive areas to its first labelable descendant — likely the toolbar's first `<button>` (Bold). Clicking the label text or editor padding may toggle Bold. | 3.2.2 / 4.1.2 — **not verified, needs a click test** | Major | Use `<div role="group" aria-labelledby>` + a `<span id>` instead of `<label>` around the editor. |
| 11 | Step-kind `<select>` text truncated at 390 px (shot 13); option content not fully readable without opening. | 1.4.10 Reflow (loss of content) | Major | Short option labels (S7). |
| 12 | Pool item kind conveyed by border colour/style only (`lms.css:281-283`). | 1.4.1 Use of Color | Minor | Add a text kicker. |
| 13 | Target sizes: all ≥ 24 px (2.5.8 AA passes): nav links 32, crumbs ~32, `.so-linkbtn` 32, buttons 44–48. Below the project's own 44 px comfort target: top-nav links, breadcrumb, "Remove", "Step out of this course". Host editor toolbar buttons look ≈20–24 px — **not verified**. | 2.5.8 (pass) / 2.5.5 AAA | Minor | `min-height:44px` on `.so-top nav a`, `.so-crumbs a`, `.so-linkbtn`. |
| 14 | `.so-days` heat-map: `role="img"` with a good label, but each cell has a `title` (mouse-only) and off-cells are 1.11:1 — fine as decoration, yet the only non-hover way to learn *which* days is absent. | 1.3.1 (minor), 1.4.13 n/a | Minor | Add a `.so-sr` or `<details>` list: "Practised on: 18 September". |
| 15 | `lang="en"` while the copy is Canadian/British ("practise", "enrol"). | 3.1.1 (pass) — pronunciation nicety | Minor | `lang="en-CA"`. |
| 16 | Native media/form controls ignore the dark theme because `color-scheme` is set on `.so-root`, not the root element (shot 05: light audio pill, ambiguous radios). Audio pill against dark paper is fine for contrast, unchecked radio outline is not clearly ≥3:1 — **not measured**. | 1.4.11 | Minor | `:root { color-scheme: light dark }`. |
| 17 | `prefers-color-scheme` only; no in-page theme choice, and `scroll-behavior:smooth` correctly gated by reduced-motion. `.so-btn:hover { filter:brightness }` has no `:active`/pressed state. | — | Minor | Optional. |

**Passes worth keeping:** visible 2 px focus ring with offset on every ground (2.4.7, and 2.4.11 — no sticky elements today; add `scroll-padding-bottom` if the save bar in §4.1 is adopted); radios in real `fieldset/legend`; transcripts as `<details>` in the page; `time[datetime]`; breadcrumb `nav[aria-label]`; sections labelled by their headings; `rel=prev/next`; image `alt` from title (teachers need an explicit alt field — a *title* is not a description; 1.1.1 at authoring level); heading order h1→h2→h3 on learner pages; no time limits, no motion, no autoplay.

Keyboard / screen-reader tables are omitted: nothing here is custom-interactive (links, native buttons, native `details`), so order follows the DOM, which matches the visual order. **Not tested with AT.**

---

## 6. Copy

The voice is the strongest part of the product: second person, unhurried, no guilt. Most issues are consistency, developer-ese leaking into the studio, and a few lines that try too hard.

### Terminology (pick one and hold it)
| Now | Seen in | Use |
|---|---|---|
| group / circle / cohort / run | "Join this group", "My circle", "Test circle (cohort)", Groups | **group** everywhere learner-facing; "circle" only as a group *kind* |
| Begin / Start / Open | "Begin", "Start a course", "Open a new group", "Open group" | Begin = learner; **Start** = teacher creates; "open" reserved for step availability |
| Remove / Take out / Step out | entries, steps, withdrawal | fine — three different things — but "Take this step out of the outline" needs its consequence |
| reader / learner / people / they | studio copy | **readers** (already dominant) |
| Kind | step type, media type, group type | ok, but never twice unlabelled in one fieldset: "Kind of file" |

### Rewrites
| Where | Now | Problem | Rewrite |
|---|---|---|---|
| Step, secondary button | "Keep these words" | Nice, but next to "I did the practice" the pair is unclear about which saves what (L1) | Single button: **"Keep this, and I've done the practice"** → shorter: **"Done — keep my words"**; when box empty the same button reads fine. Secondary: "Just save the words" |
| Step, reflection placeholder | "Write for yourself first." | Good line, wrong place: vanishes on focus, and "first" implies a second, public step | Move to visible help under the prompt: "This is yours. You choose below who else, if anyone, can read it." |
| Visibility: Only me | "Kept in your journal. No one else can read it — not the guide, not an administrator." | Strong promise; is it technically true for a DB admin? If not literally, soften. **Not verifiable.** | "Kept in your journal. Not shown to your guide or to anyone running the site." |
| Visibility: Anyone | "Shown on this page with your name, on the open web." | Good and honest. Add permanence. | "…on the open web, until you remove it." |
| Ahead callout (`pages.tsx:245`) | "You're a little ahead of yourself — this follows …. Read on if you like; your place is kept where you left it." | "ahead of yourself" is a mild scold; string-replacing "Opens"→"this follows" is fragile | "This step comes after *{title}*. You're welcome to read it now — your place is kept." |
| Closed callout | "… It will be here when the day comes." | Slightly portentous | "It opens on 1 January 2030." (say the date; drop the flourish) |
| Completed | "You walked the whole of it, 18 September 2026. Everything stays open to return to." / card: "Walked through …" | First is lovely; "Walked through" on the card reads like a bug | Card: "Finished 18 September 2026" |
| Course, guides (`pages.tsx:137`) | "The guide is around, reads what you choose to show them, and answers when there's something to say. Nothing waits on them." | "is around" is vague; last sentence is cryptic | "Your guide reads only what you choose to show them, and writes back when there is something to say. You never have to wait for them to go on." |
| Footer link | "Step out of this course" | Good. Needs consequence. | + confirm text: "You can come back any time. What you wrote stays in your journal." (the flash already says this — say it *before*) |
| Guide desk h1 | "Waiting on a word from you" / "Everything shown to you" | Title changes with filter; first one adds the pressure the intro then disclaims | h1 "Guide desk"; tabs "Waiting · All" |
| Guide desk intro | "Only what people chose to show their guide appears here. Private reflections never do. Nothing here holds anyone up — answer when there is something to say." | Good; trim | "You see only what people chose to show you. No one is held up waiting — answer when you have something to say." |
| Guide tools | "Move this group to the latest version" | Consequence unknown | "Move this group to the new version of the course" + meta: "They keep their place and everything they wrote." (**verify**) |
| Journal intro | "It is yours: each entry says who can read it, and removing one really removes it." | "really removes" is defensive | "Each entry shows who can read it. Remove one and it is gone for good." |
| Journal calendar | "A record, not a score — a gap is just a gap." | Keep. Best line in the app. | — |
| Studio outline help | "Small units, long paths: three to five steps make a course. Every module wants at least one practice — something to do, make or notice." | First clause is an internal slogan; "three to five steps make a course" contradicts the 14-step example | "Keep modules short — three to five steps. Give each one at least one practice: something to do, make or notice." |
| Studio practice help | "Every lesson ends in something to do, make or notice. A step with only reading is a draft." | Scolds; also untrue for resource/gathering steps | "What will they do, make or notice? Even a reading is better with a small practice." |
| Studio field | "Another way in — a gentler or different version, always offered for a hard practice" | Label is a sentence | Label "Another way in"; help "A gentler version. Always give one if the practice could be hard for some people." |
| Studio field | "Summary — one line; shown in the outline and to search engines" | fine; "to search engines" → "in Google" is plainer for this audience | "Summary — one line. Shown in the outline and in search results." |
| Studio field | "Minutes to give it" | nice | — |
| Studio fieldset | "Something that already exists on the network" | Abstract | "Link a gathering or conversation" |
| Studio media | "Link (clear to remove)" / "Link (add another)" | UI mechanics in a label | See S9; labels "Link" + a Remove checkbox |
| Studio upload | "Save the form above first — uploading reloads the page." | The interface apologising for itself | Remove by fixing S1 |
| Studio rule | "Does finishing the course need it?" | Awkward inversion | "Do they need this step to finish the course?" — "Yes, required" / "No, optional — it never holds anyone back" |
| Studio rule | "…which module" / "…how many days" / "…which date" | Ellipsis labels read as broken, and as nonsense to a screen reader | "After which module?" / "How many days after they begin?" / "On what date?" |
| Studio rule button | "Save when it opens" | Parses as "save at the time it opens" | "Save these settings" (or gone, once merged) |
| Studio rule help | "Changing this changes the course's shape: groups already under way keep their version until their guide moves them." | "shape" is internal vocabulary (also in Publish: "**The shape changed**") | "Groups already under way keep the old order until their guide moves them to the new version." |
| Studio visibility | "Public — listed on the front page, indexed, in the sitemap." / "Unlisted — … search engines are asked not to index it." | "indexed", "sitemap" are jargon | "Public — listed on Sophia's front page and findable in Google." / "Unlisted — anyone with the link can read it. It won't appear on Sophia or in Google." |
| Studio module summary | "· 8 steps · rename, move" | Hint text as affordance | "Edit module" control (S5) |
| Studio loose steps | "Steps taken out of the outline (2)" / "Put back into "Finishing"" | Good | — |
| Groups help | "…it can be tied to a gathering that already exists — its RSVPs become the group." | Dense | "You can link a gathering from the forum: everyone who RSVP'd joins the group." |
| Group states | "Closed — under way, no new joiners" | ok | "Closed — under way, not taking new people" |
| Run names in test data | "Test circle (cohort)", "A little at a time (drip)" | Internal mode names leak to learners (shot 02) — test data, but guard against it | Never print `mode` raw; `MODE_WORDS` already exists |
| Thread card | "Regularly — next times are on its page" / "the room opens from its page, no account needed" | "its page" ×2 | "Meets regularly — see the next times" / "Online. Join from the gathering's page; no account needed." |
| Thread missing | "This gathering isn't on the calendar right now. Carry on with the rest — it doesn't hold you back." | Good | — |
| Flash | "Kept." / "Removed." / "Welcome. Your place is kept from here on." | Good, terse. | "Kept." → "Kept in your journal." the first time |
| Care page | "This is known and not rare, and it does not mean you are doing it wrong." | Good. "sense of unreality" may need a plainer gloss | "…or a feeling that things aren't quite real." |

---

## 7. Do these ten things first (each < 1 hour)

1. **Stop the data loss (L1).** Put the completion button inside the `respond` form (`name="also" value="complete"`, `formNoValidate`), have the `respond` action save a non-empty body then call `completeStep` and redirect to `next`; remove the second form when the reflection form is shown. One loud button per step. *(pages.tsx ~255-292, actions.ts ~83)*
2. **Fix the care page (L2).** Un-grid the article (`.so-page--step > article.so-prose { display:block }`) and move "If you need help now" to the top in a `so-callout`.
3. **Field borders to 3:1 (A11y #1).** Add `--so-field` (#857e6b / dark #6f7a99) and use it for `border` at `lms.css:185, 239, 266` and on `.so-card`-less inputs in the pool section.
4. **Confirm before removing (L3).** Wrap the Remove button in a `<details>` with a one-line consequence and a second button.
5. **Give the studio step page a head (S2):** kicker + `h1` + "See it as a reader" + unpublished-changes note; add the skip link and `main id` while in the layout (A11y #9).
6. **Conditional rule fields and sane labels (S3):** rule as radios with nested dependent inputs shown via `:has(input:checked)`; rewrite the "…which" labels.
7. **Outline hierarchy (L4/L5):** module h3 to 1.75 rem with Inter small-caps numeral; step titles to Source Serif 600; mark the continue step (`data-here`) with an accent inset bar and "You are here"; closed steps as plain text without opacity.
8. **Make the practice the centre (L6):** sheet ground, gold top rule, caps label, 1.3125 rem text, 48 px above/below. Borderless "journal line" textarea for reflections.
9. **Accessible names (A11y #4, #5):** `StepMark` and `.so-dot` → `aria-hidden` glyph + `.so-sr` text; `Mini` → "Move "{title}" up"; hide no-op arrows; return to `#moduleId` after each outline op.
10. **Sticky save + collapse (S1, first half):** wrap editor sections 4, 5 and the slug in `<details>` with value digests in the `<summary>`, add the `position:sticky` save bar with `scroll-padding-bottom`. (Merging upload and rule into the one form is the follow-up, ~half a day with handler changes.)

Then, in order: one Inter-only-for-controls pass (§3.2), spacing tokens (§3.3), guide answer inside the response card (G1), kicker colour fix (G2), slim header on step pages (L9), `color-scheme` on `:root` (L13), publish panel states (S6), kind radio cards (S7).

---
## Applied 2026-09-18 (same day)
Done from §7: **1** (one form — the loud button now saves typed words, then completes; verified through the real POST), **2** (care page un-gridded, crisis line first), **3** (`--so-field` 3:1 borders), **4** (Remove is a two-step disclosure stating the consequence), **5** (studio step head, skip link, `#main`), **7** (module headings 1.75rem, serif step titles, "You are here" marker, closed mark without opacity), **8** (practice block as the centre), **9** partly (StepMark/unread dot as hidden glyph + sr text, arrows named with the step title, errors are `role="alert"`), **10** partly (sticky save bar). Also: the `<label>` no longer wraps the rich-text editor; the "not an administrator" promise reworded to what Sophia itself guarantees.
Still open: **6** (conditional rule fields), the rest of **10** (collapse sections / merge upload + rule into one form), hide no-op arrows and return to `#moduleId`, then the §3 token pass, G1/G2, L9, L13, S6, S7.
