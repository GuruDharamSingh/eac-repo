# 06 · Light theme (first pass): bleu de Paris, white, yellow

File: `designs/Tour Detail Page Phone Light.dc.html` (the v2 flow re-tokened). Status: **a starting point for the owner to react to**, not settled.

## Tokens
| Role | Token | Value |
|---|---|---|
| Card / paper | --sf-bg | #ffffff |
| Page ground | | #f7f5f0 (in-phone), #e9edf3 (canvas) |
| Soft (rail, foot) | --sf-bg-soft | #eef2f8 |
| Sunken field | | #f4f6fa |
| Ink (bleu de Paris, deep) | --sf-fg | #14284b |
| Muted | --sf-muted | #4f5d75 |
| Faint | --sf-faint | #7d889c |
| Line | --sf-line | #c9d2e0 |
| Rule | --sf-rule | #8d9bb4 |
| Accent: structure, links, chips, kind lines | --sf-accent / --eac-kind-* | #2350a0 |
| Yellow: things you act on and "you are here" | new --eac-kind-…-fill or a primary-fill token | #f2c14e, with ink #14284b on it |
| Place | --eac-kind-place | #3c7fa6 |
| Route line / guide's take | | #c4532f |

## Where the yellow goes
Book buttons, the chosen date, the open stop's numeral tile, the open stop's strip card (2px border), the "NEXT" tile, and the stage masthead's kind line (3px). Blue carries structure: rules, active pills (blue fill, white text), kickers, links.

## Contrast (approximate)
#14284b on #fff ≈ 14:1; #4f5d75 on #fff ≈ 6.6:1; #2350a0 on #fff ≈ 7.6:1; #14284b on #f2c14e ≈ 8.6:1. **Do not use the yellow as text on white.**

## Implementation
A second `:root` map in `apps/elktours/src/app/globals.css` (or a `.theme-light` scope), the same shape as the dark one. Surface needs one addition: a **fill colour for primary actions that can differ from the kind's line colour** (here yellow fill on a blue system). Suggested: `--eac-surface-primary` / `--eac-surface-on-primary`, read by `.eac-btn--primary` before `--sf-kind`.
