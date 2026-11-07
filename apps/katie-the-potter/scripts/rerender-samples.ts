// Re-render the sample pictures with TRANSPARENT grounds (round 6, 2026-11-06),
// so card grounds, Site style tints and the looks (Ember glow, Profile drawing)
// show around the pot. Same shapes and colours; only the backdrop rect and the
// baked ground shadow go (the card draws its own ground and plinth). The hero
// keeps its shadow and the vase mouth; its backdrop is now a CSS ground in
// quick-landing.css.
//
// Writes public/samples/*.svg (what /preview draws), renders .seed-images/*.png
// (1280 x 1600, RGBA) and uploads them over the SAME Nextcloud paths the seed
// used (katie-sample-<file>), so no stored URL changes. The thumbnail cache is
// keyed by the master ETag, so new bytes mean new derivatives.
//
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -T -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/rerender-samples.ts
// DRY=1 renders without uploading.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { resolveUserPath, uploadFile } from "@elkdonis/services";

// sharp is not one of this app's dependencies; it is in the workspace store (Next uses it).
const sharp = createRequire(import.meta.url)("/app/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp") as SharpFn;

// The little of sharp used here (its types are not resolvable from this app).
type SharpChain = {
  resize(w: number, h: number, o: object): SharpChain;
  extract(o: object): SharpChain;
  png(): SharpChain;
  raw(): SharpChain;
  toBuffer(): Promise<Buffer>;
  metadata(): Promise<{ width?: number; height?: number }>;
};
type SharpFn = (input: Buffer, o?: object) => SharpChain;

const SLUG = "katie"; // the placeholder owner's storage folder (seed-katie.md)
const FILES = ["hero", "piece-1", "piece-2", "piece-3", "piece-4", "piece-5", "piece-6"];

function strip(name: string, svg: string): string {
  // the backdrop
  let out = svg.replace(/<rect width="\d+" height="\d+" fill="[^"]*"\/>/, "");
  // the baked ground shadow under a piece (the card has its own plinth)
  if (name !== "hero") out = out.replace(/<ellipse cx="100" cy="205" rx="70" ry="10" fill="#d9cfc1"\/>/, "");
  return out;
}

async function main() {
  const dry = process.env.DRY === "1";
  for (const name of FILES) {
    const svgPath = path.resolve("public/samples", `${name}.svg`);
    const before = await readFile(svgPath, "utf8");
    const svg = strip(name, before);
    if (svg === before) console.log(`${name}: already transparent`);
    else await writeFile(svgPath, svg);
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    const vw = vb ? Number(vb[1]) : 200;
    const png = await sharp(Buffer.from(svg), { density: (72 * 1280) / vw })
      .resize(1280, 1600, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await writeFile(path.resolve(".seed-images", `${name}.png`), png);
    const meta = await sharp(png).metadata();
    const corner = await sharp(png).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    console.log(`${name}: ${meta.width}x${meta.height}, corner alpha ${corner[3]}`);
    if (dry) continue;
    const rel = resolveUserPath(SLUG, `Media/Images/katie-sample-${name}.png`);
    if (!(await uploadFile(rel, png, "image/png"))) throw new Error(`upload failed: ${name}`);
    console.log(`  uploaded over ${rel}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });
