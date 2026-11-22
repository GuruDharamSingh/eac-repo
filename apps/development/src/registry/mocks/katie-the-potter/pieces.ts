import type { Piece } from "../../../../../katie-the-potter/src/blocks/artwork-data";

// Invented pieces. Pictures are inline SVG pots on a cream ground (no files, no real photographs).
function pot(body: string, glaze: string, rim: string, shape: "bowl" | "vase" | "jar" | "cup"): string {
  const shapes: Record<string, string> = {
    bowl: "M70 120 Q70 190 150 195 Q230 190 230 120 Z",
    vase: "M125 60 L125 85 Q85 120 95 175 Q100 205 150 205 Q200 205 205 175 Q215 120 175 85 L175 60 Z",
    jar: "M95 95 L205 95 L215 120 Q222 190 150 198 Q78 190 85 120 Z M120 80 L180 80 L185 95 L115 95 Z",
    cup: "M105 105 L195 105 Q198 180 150 188 Q102 180 105 105 Z",
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 375"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${glaze}"/><stop offset="1" stop-color="${body}"/></linearGradient></defs><rect width="300" height="375" fill="#efe6d8"/><ellipse cx="150" cy="262" rx="82" ry="12" fill="#00000022"/><path d="${shapes[shape]}" transform="translate(0 50)" fill="url(#g)" stroke="${rim}" stroke-width="3"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const base = { currency: "CAD", href: "#", year: 2026, kind: "original" as const, edition: null, descriptionHtml: null };
const one = (url: string) => [{ url, alt: "" }];

const A = pot("#6b4a36", "#a9552f", "#4a2d1d", "bowl");
const B = pot("#9db3a5", "#c8d8cc", "#6f8a7a", "vase");
const C = pot("#4a3b34", "#8a6a55", "#2b2420", "jar");
const D = pot("#d9c3a3", "#efe0c8", "#b09878", "cup");
const E = pot("#5a3d2e", "#8e4a2a", "#3a2418", "bowl");
const F = pot("#222222", "#4a4a4a", "#111111", "vase");

export const PIECES: Piece[] = [
  { ...base, id: "m1", slug: "tenmoku-tea-bowl", title: "Tenmoku tea bowl", medium: "Stoneware, tenmoku glaze", dimensions: "8 × 12 × 12 cm", priceMinor: 9500, status: "available", image: A, images: one(A) },
  { ...base, id: "m2", slug: "celadon-vase", title: "Celadon vase", medium: "Porcelain, celadon glaze", dimensions: "24 × 11 × 11 cm", priceMinor: 28000, status: "available", image: B, images: one(B) },
  { ...base, id: "m3", slug: "shino-jar", title: "Shino jar with lid", medium: "Stoneware, shino glaze", dimensions: "16 × 14 × 14 cm", priceMinor: 0, status: "available", image: C, images: one(C) },
  { ...base, id: "m4", slug: "pair-of-cups", title: "Pair of cups", medium: "Stoneware, ash glaze", dimensions: "9 × 8 × 8 cm", kind: "open_edition", priceMinor: 6000, status: "available", image: D, images: one(D) },
  { ...base, id: "m5", slug: "wide-serving-bowl", title: "Wide serving bowl", year: 2024, medium: "Stoneware, iron slip", dimensions: "9 × 30 × 30 cm", priceMinor: 18000, status: "sold", image: E, images: one(E) },
  { ...base, id: "m6", slug: "bud-vase-black", title: "Bud vase, black", medium: "Stoneware, black glaze", dimensions: "14 × 7 × 7 cm", kind: "limited_edition", edition: "3 / 12", priceMinor: 7500, status: "reserved", image: F, images: one(F) },
];
