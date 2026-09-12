# Fonts for the SVG renderer

Used by `@elkdonis/astro/svg` to convert every piece of type and every
astrological glyph to outlines, so a chart SVG is self-contained and renders
identically anywhere. All three are variable fonts from
<https://github.com/google/fonts>, licensed under the SIL Open Font License 1.1:

| File | Family | Role |
|---|---|---|
| `EBGaramond.ttf` | EB Garamond | titles, house numbers, axis labels |
| `Inter.ttf` | Inter | data: positions, tables, sign names |
| `NotoSansSymbols.ttf` | Noto Sans Symbols | zodiac and planet glyphs |

Downloaded 2026-09-11. The Sun (☉), triangle and square glyphs are drawn as
geometry in the renderer because Noto Sans Symbols does not carry them.
