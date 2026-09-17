# @elkdonis/tokens

Reads a **Design Tokens Format (DTCG)** file and turns it into the flat
`{"--name": "value"}` bag that `site_themes` has stored since migration 090.

Zero dependencies, no database — it runs in a build script, a server action or
an admin screen without pulling `@elkdonis/db` into the graph. Writing the
result is `saveSiteTheme` in `@elkdonis/services`, which already existed.

```ts
import { importDtcg, linkHooks } from "@elkdonis/tokens";
import { saveSiteTheme } from "@elkdonis/services";

const result = importDtcg(JSON.parse(file), { prefix: "eac" });

// Point our own hooks at imported variables. This map is the one thing no
// importer can guess — an outside file names things in its own vocabulary.
const linked = linkHooks(result, {
  "--eac-control-accent": "color.semantic.accent",
  "--eac-control-radius": "radius.control",
});

await saveSiteTheme(orgId, "", { ...result.vars, ...linked.vars }, userId);
```

**Always read `result.issues`.** Anything that could not be carried across is
dropped and reported rather than guessed at — dangling aliases, alias cycles,
deprecated tokens, unknown `$type`, and values the theme storage will not
accept. `result.vars` is guaranteed storable as-is.

## Things worth knowing

- **DTCG 2025.10** is the first stable version (Oct 2025), backed by 40-odd
  organisations. It is a *community group* specification, not a ratified W3C
  Standard.
- **`dimension` and `color` are objects, not strings** in this version —
  `{"value": 16, "unit": "px"}`, and `{"colorSpace": "srgb", "components": […]}`.
  A file written against an older draft will not import cleanly.
- **sRGB components are 0–1 in DTCG and 0–255 in CSS**, and are rounded on the
  way out: `0.596 × 255 = 151.98 → 152 → 0x98`, reproducing the file's own hex
  fallback exactly.
- **Composite tokens expand.** A `typography` token becomes
  `--x-font-family`, `--x-font-size`, `--x-font-weight`, `--x-line-height`, so
  a heading can override the size without restating the family.
- **Quoted font stacks cannot be stored.** The theme sanitizer rejects quote
  marks, so `Georgia, serif` survives and `"Source Sans 3", sans-serif` does
  not. It is reported as `unstorable` rather than silently dropped. Widening
  `VALUE_RE` in `@elkdonis/services/themes` is the fix if that matters — it is
  a deliberate trust boundary, so it is a decision rather than a tweak.
- **`linkHooks` emits `var()` references, not copied values**, so the imported
  palette stays the single source and re-importing moves everything at once.
- The storage rules are **duplicated** from `@elkdonis/services/themes` because
  this package must stay database-free. `scripts/smoke.mts` reads that file and
  fails if the two drift apart.

## Scripts

    pnpm --filter @elkdonis/tokens test       # 43 checks, no database
    # end-to-end against the real database — WRITES a theme row:
    tsx scripts/e2e.mts <orgId> <userId>
