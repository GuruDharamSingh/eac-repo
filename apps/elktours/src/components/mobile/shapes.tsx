import "./shapes.css";

/**
 * Shape helpers for the phone UI.
 *  - archPath(): outline of a POINTED arch (two arcs meeting at a small tip at the top centre) with rounded bottom corners.
 *    Used as clip-path: path() and as the SVG stroke of the brass frame, so both follow the same outline at every size.
 *  - .m-cusp (shapes.css): cusped-corner card, each corner two small concave curves meeting at a sharp tip. Set --cusp (default 10px).
 *    .m-cusp--alt is the alternative reading (concave scallop corners). Add the class to any card; it needs no wrapper.
 */
const f = (n: number) => +n.toFixed(2);

/** Path of the arch inside the box (x, y, w, h). `b` = bottom corner radius. */
export function archPath(x: number, y: number, w: number, h: number, b: number): string {
  // Round arch (top radius = half the width), per Justin 2026-11-15: photos keep the designer's round arch;
  // the pointed/cusped treatment lives on the rounded boxes (.m-cusp) instead.
  const r = Math.max(0, Math.min(w / 2, h - Math.min(b, h / 2)));
  const bb = Math.min(b, w / 2, h - r);
  return [
    `M${f(x)} ${f(y + r)}`,
    `L${f(x)} ${f(y + h - bb)}`,
    `A${f(bb)} ${f(bb)} 0 0 0 ${f(x + bb)} ${f(y + h)}`,
    `L${f(x + w - bb)} ${f(y + h)}`,
    `A${f(bb)} ${f(bb)} 0 0 0 ${f(x + w)} ${f(y + h - bb)}`,
    `L${f(x + w)} ${f(y + r)}`,
    `A${f(w / 2)} ${f(r)} 0 0 0 ${f(x)} ${f(y + r)}`,
    "Z",
  ].join("");
}

/** Brass double frame: the arch outline as a 1px stroke plus a fainter ring 4px outside. Draws over the clipped picture. */
export function ArchStroke({ w, h, b }: { w: number; h: number; b: number }) {
  return (
    <svg className="m-arch-frame" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="is-halo" d={archPath(-4, -4, w + 8, h + 8, b + 4)} />
      <path className="is-line" d={archPath(0.5, 0.5, w - 1, h - 1, b)} />
    </svg>
  );
}
