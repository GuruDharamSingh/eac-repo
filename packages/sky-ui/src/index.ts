// ============================================================================
// @elkdonis/sky-ui — the current sky as a component.
//
//   import { SkyFace, SkySurface, SkyPanel, setSkyEndpoint } from "@elkdonis/sky-ui";
//
// A FACE lists where the planets are; opening it shows the wheel and the
// controls that move time. The same SkyPanel renders all three sizes, so a
// tile on one site and the page on another cannot drift apart.
//
// The host supplies two things:
//   • a route answering `?t&lat&lon` with `{ chart }` — see
//     apps/elastrocal/src/app/api/sky. Point at it with setSkyEndpoint()
//     when it is not at /api/sky.
//   • <SurfaceProvider connectors={{ custom: { sky: () => <SkySurface/> } }}>
//     from @elkdonis/cms-ui/surface, plus that package's surface.css.
//
// Styling is Tailwind over the shared shadcn TOKENS (--card, --border,
// --primary…), so a host must be a Tailwind app that defines them and must
// add `@source` for this package's src. That is the one way it differs from
// cms-ui, which is plain CSS because ifac and artdirect are not Tailwind.
// ============================================================================

export { useSky, PLACES, RATES, STEP_UNITS } from "./use-sky";
export type { SkyApi, Place, Direction } from "./use-sky";

export { SkyPanel } from "./sky-panel";
export type { SkyPanelSize } from "./sky-panel";
export { SkyFace } from "./sky-face";
export { SkySurface } from "./sky-surface";
export { SkyList } from "./sky-list";
export { SkyHeader, SkyControls } from "./sky-parts";
export { ChartWheel } from "./chart-wheel";
export { Glyph, ELEMENT_TEXT } from "./glyph";
export { SkyConfig, setSkyEndpoint, cn } from "./utils";
