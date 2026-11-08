# @elkdonis/gradients

Gradient backgrounds for EAC sites and editors. A gradient is a small JSON value (`GradientSpec`). This package
cleans it, generates it, writes it as CSS, and optionally paints it with a WebGL shader and grain. It also gives
Puck and the direct editor one slider control to edit it with.

Built 2026-11-07 from the two EAC logo sheets (Elemental colour palette, Bon / shamanism) and the Bon mineral
palette (`Elkdonis Arts Collective/palettes/bon-mineral`). It isn't wired into any editor yet; see
[Integration](#integration).

## Use it on a page

```tsx
import { GradientBackground } from "@elkdonis/gradients/react";
import { PRESETS } from "@elkdonis/gradients";

<GradientBackground value={block.props.background} className="hero">…</GradientBackground>
```

On the server, or anywhere without React:

```ts
import { gradientCss, gradientStyle, cleanGradient } from "@elkdonis/gradients";

const css = gradientCss(storedValue);            // "linear-gradient(120deg, #407C83 0%, …)"
const style = gradientStyle(storedValue);        // { background, backgroundColor }
const short = gradientCss(storedValue, { maxLength: 160 }); // thinned to fit a length cap, or ""
```

`GradientBackground` renders the CSS on the server. In the browser it adds the shader canvas and grain as
layers, and both ignore pointer events. The CSS stays underneath as the fallback: no WebGL, a lost context,
print, or reduced data all show it.

## The value

```ts
interface GradientSpec {
  v: 1;
  kind: "linear" | "radial" | "conic" | "mesh" | "halo" | "bands";
  stops: { color: "#RRGGBB"; at: 0..100 }[];  // 2–8
  angle; cx; cy;                     // direction and centre
  space: "oklch" | "oklab" | "srgb";  hue: "shorter" | "longer";
  ease: "linear" | "smooth" | "in" | "out" | "steps";  steps;
  softness; mute; light;             // 0–100 (light -50..50)
  count; seed; scale;                // mesh blobs / halo rings
  grain;                             // 0–100, drawn as an SVG element, never a CSS url()
  shader: "none" | "mineral" | "aurora" | "halo" | "silk";  motion;
  base?: "#RRGGBB";
}
```

The stored value is never trusted. `cleanGradient(raw)` keeps known keys only, clamps every number and accepts
only hex colours. It returns `null` for anything that isn't a gradient. Everything downstream reads the cleaned
value.

## The algorithms

- **Perceptual ramps** (`ramp`): each gap between stops is sampled in OKLCH or OKLab with an easing, and the
  CSS gets those samples as plain hex stops. That keeps blue→orange from going through grey and gold→purple from
  going through brown. It looks the same in every browser, and the output needs no `in oklch` or colour
  functions.
- **Softness** holds each colour flat and pulls the blend toward the midpoint; at 0 you get hard edges.
  **Steps** and **bands** make flat bands.
- **Mute** takes chroma out in OKLCH, the way the logo ink is a muted wash of the pure pigments. The sheets
  measured chroma 0.07–0.09; the tsakli mute is about 48.
- **Harmonies** (`harmony(hex, kind)`): analogous, complementary, triad, split, tetrad, shades, and elements (the
  Bon five, rotated so the element nearest your colour leads).
- **Generate** (`generate(seed, { pigments })`): a seeded, deterministic new gradient. It takes 2–5 neighbouring
  colours from the logo ink (or the elements, or Bon mineral) on a kind that suits them.
- **Mesh** layers seeded radial blobs over a base. **Halo** draws concentric rings, like the EAC ring marks.

## Third-party (pinned)

| Package | Licence | Used for |
|---|---|---|
| `culori` 4.0.2 | MIT | All colour maths (`color.ts`, through the tree-shakable `culori/fn`): OKLab/OKLCH, interpolation with hue fixups, CSS Color 4 gamut mapping, WCAG contrast, parsing |
| `@paper-design/shaders-react` 0.0.82 | Apache-2.0 | Seven extra shaders and the paper surface. It's pre-1.0, so pin it and re-test on upgrade. Loaded lazily, only when a spec uses it |
| `grapick` 0.1.13 | MIT | The draggable stop bar (`StopBar`). Last released 2021, so it's wrapped narrowly; its strip is repainted with our ramp and its CSS is inlined |

## Shaders

Pick one per spec with `shader`. Ours (GLSL ES 1.00, `shaders.ts`) use one shared header: stops arrive as OKLab
colours and the ramp is mixed on the GPU, as in the CSS.

| Shader | Look |
|---|---|
| `mineral` | Domain-warped fBm: a marbled pigment wash with mottling and faint craquelure |
| `aurora` | Curtains of the ramp over a dark ground, folding slowly |
| `halo` | The EAC rings, with colour travelling round them |
| `silk` | A soft, slowly folding field of the ramp |

Paper Shaders (`paper.ts` maps a spec to their props; `PaperLayer` renders them):

| Shader | Paper component |
|---|---|
| `mesh-flow` | MeshGradient, flowing colour spots |
| `grain-wave`, `grain-ripple`, `grain-sphere` | GrainGradient. Its blob shape renders blank in headless SwiftShader, so it's left out until checked on a GPU |
| `warp`, `swirl`, `smoke-ring` | Warp, Swirl, SmokeRing |
| `paper` (0–100, any gradient) | PaperTexture multiplied over the gradient: fibre, folds, crumples. The tsakli surface |

Paper's shapes grow in from nothing at frame 0, so every Paper layer starts 6–14 s in (by seed). Object shapes use
fit `contain`, patterns `none` and fields `cover`, as Paper's own defaults do. The pixel budget is ours (ratio 1),
not Paper's default of 2.

**Video (Remotion):** pass `frame` (ms) to `GradientBackground`, and shaders draw that moment with no clock of
their own. Ours draw synchronously per frame. Paper loads lazily, so `@elkdonis/reels` (`templates/ground.tsx`)
shows Paper presets as their CSS version and the control there uses `shaders="own"`.

Costs: the pixel ratio is capped at 1.5 (mineral renders at 0.6 of that). The loop pauses off screen and in
hidden tabs, and motion 0 or `prefers-reduced-motion` gives one still frame. Browsers allow about 16 live WebGL
contexts, so use a shader on hero-sized blocks, not on every card. The control's swatches and thumbnails are
CSS-only for that reason.

## Editors

```tsx
import { gradientField, mountGradientControl, gradientDecls, GradientControl } from "@elkdonis/gradients/react";

// Puck: a block field
fields: { background: gradientField({ label: "Background" }) }

// direct editor (DOM panel): a React island, same createRoot pattern as direct-edit/src/puck/mount.ts
const ctl = mountGradientControl(host, { value, onChange });  ctl.update(v); ctl.destroy();

// morph / part styles: [property, value] declarations
gradientDecls(spec)  // [["background-color", "#…"], ["background", "linear-gradient(…)"]]
```

The control has presets, the kind, colour stops (picker, hex, position, the elemental / logo ink / Bon swatches),
Generate (Surprise, harmony from a colour, from logo ink / elements / Bon mineral), Shape (angle, centre,
blobs/rings, scale, seed, bands, softness, base), Colour feel (mute, light, grain, blend space, hue path, easing),
Shader (layer, motion), Copy CSS and Remove.

## Integration

**Done (2026-11-07): studio video reels** (`packages/reels`, shown at arts-collective `/studio?kind=video`):

- `ReelEdit.brand.gradient` is stored beside `brand.background`, cleaned in `toClipProps` and `toArtworkReelProps`.
- `templates/ground.tsx` (`ReelGround`) paints it, frame-driven, behind the clip template's ground and end card
  and the artwork reel's intro and end card.
- The editor's "Look and end card" section has a Gradient background control (`shaders="own"`).
- `render/render.mjs`: a gradient behind letterbox bars sends the render down the Remotion path.
- arts-collective lists the package in `transpilePackages`. The app needs a rebuild before it's live.

Still to do:

1. (Linking is done: `docker compose --profile tools run --rm install`.)
2. **page-builder Style** (`packages/page-builder/src/style`): add `bgGradient?: GradientSpec` to
   `StyleSettings`, clean it with `cleanGradient` in `cleanStyle`, render it in `wrap.tsx` with
   `<GradientBackground>`, and add a Background → Gradient section to `field.tsx` using `GradientControl`.
   Store the spec, never the CSS string. A smooth ramp runs 300–900 characters, over the custom-CSS box's
   200-character cap.
3. **blocks**: a `kind: "gradient"` PropKind (or a block-level `background` prop) for blocks that own their
   ground (HeroBanner, SectionBanner, Grid), with `gradientField` in `toPuckFields`.
4. **direct editor**: in `site/style.ts`, the `"background"` var kind currently accepts
   `linear-gradient(<deg>, #hex %…)` with 2–4 stops. Either accept `isSafeGradientCss(value)` and write
   `gradientCss(spec, { maxLength })`, or store the spec beside the variable. In the block panel, mount
   `mountGradientControl` where colour fields are mounted today.
5. Rebuild the apps that use them (production builds; see docs/open).

## Develop

```sh
source ~/.nvm/nvm.sh
packages/blocks/node_modules/.bin/tsx packages/gradients/scripts/smoke.mts     # 11 checks
node packages/gradients/playground/build.mjs .ds-sync/node_modules/esbuild     # -> playground/dist/index.html
```

The smoke test runs every preset, every kind and 300 generated gradients through `isSafeGradientCss`. It also runs
them through page-builder's real `cleanCustomCss`, for those that fit its 200-character box.
