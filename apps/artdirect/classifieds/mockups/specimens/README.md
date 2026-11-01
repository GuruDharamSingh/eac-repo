# Specimen reference collection

Started 2026-10-25 at the developer's direction: "create collections of
references for each; render each example as far as possible as its own
mock-up in code that makes sense to the site."

One HTML file per specimen, `cl-NNN.html`, reproducing that page's look as
closely as the web fonts allow: its grid, its head devices, its box
treatments, its colours, its proportions, with copy rewritten for the river
town so nothing real is republished. Each file ends with a note naming the
devices recorded, the fonts used (and what they stand in for), and the
generator ids (`templates.ts`, `sections.ts`) that quote it. The files use
the site's `--cl-*` token vocabulary so rules can be lifted into
`microfiche.css` directly.

| Specimen | File | Status |
|---|---|---|
| cl-014 Daily News, Employment, colour boxes | `cl-014.html` | done 2026-10-25 |
| cl-039 1960s daily want ads (two facing pages) | `cl-039.html` | done 2026-10-25 |
| cl-017 Hastings Tribune, masthead page | `cl-017.html` | done 2026-10-25 |
| cl-024 1920s magazine classified page | `cl-024.html` | done 2026-10-25 |
| cl-037 Saint Paul Daily Pioneer 1871 | `cl-037.html` | done 2026-10-25 |
| cl-018 Hastings Tribune, At Your Service page | Design canvas https://claude.ai/artifact/M8tDkCZReLkGT1A9tM5JWj (editable in the artifact editor) | done 2026-10-25 |
| cl-030 Dogstar flyer pastiche (comic mail-order) | same canvas, board `Dogstar.dc.html` | done 2026-10-25 |
| the rest | — | to do, in order: cl-008, cl-009, cl-016, cl-023, cl-015, cl-027, cl-038, cl-011, cl-028, cl-013, cl-026, cl-035, cl-002, cl-033, cl-010, cl-012, cl-020, cl-003, cl-004, cl-005, cl-006, cl-007, cl-021, cl-022, cl-029, cl-031, cl-032, cl-034, cl-036, cl-019, cl-025 |

From cl-018 on, reproductions are published as Design canvases (one `.dc.html` artboard per specimen) at the developer's request, so he can edit them in the artifact editor; the `.dc.html` source is kept here too. The static `.html` files for cl-014 to cl-039 remain as they are.

The composed sections (`../BrokenColumns.html`, `../BoxStudies.html`,
`../ThreeMore.html`, `../ThreeKinds.html`, `../FieldStructures.html`) draw
on these; the collection is the primary source and the sections are the
mixtures.
