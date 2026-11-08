// Compile the IFAC Tailwind v4 theme (apps/ifac/src/app/globals.css) with the app's own
// @tailwindcss/postcss, plus the series stylesheet (@elkdonis/series-site/site.css, the dark .ifs
// look) that apps/ifac/src/components/site/chrome.tsx loads on every page. Output:
// .design-sync/entry/theme.css + .design-sync/entry/fonts/ (generated; gitignored).
// Run from the repo root before package-build.mjs (it is cfg.buildCmd).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const APP = "apps/ifac";
// Same families and URL as apps/ifac/src/components/site/chrome.tsx (runtime Google Fonts), plus
// Public Sans, which surface.css names for its record/title skins.
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Source+Sans+3:wght@400;600;700&family=Public+Sans:wght@400;600;700&display=swap";

const app = resolve(APP);
const req = createRequire(resolve(app, "package.json"));
const twPath = req.resolve("@tailwindcss/postcss");
const postcss = createRequire(twPath)("postcss");
const tailwind = req("@tailwindcss/postcss");

const from = resolve(app, "src/app/globals.css");
const out = resolve(".design-sync/entry/theme.css");
const css = readFileSync(from, "utf8")
  + `\n@import "@elkdonis/series-site/site.css";\n`
  // extra sources so every class used by the synced packages and the authored previews is generated
  + `@source "../../../../packages/blocks/src";\n@source "../../../../packages/series-site/src";\n`
  + `@source "../../../../packages/cms-ui/src";\n@source "../../../../.design-sync/previews";\n`;
const res = await postcss([tailwind({ base: resolve(".") })]).process(css, { from, to: out });

// Fonts the theme points at under /fonts/ (apps/ifac/public/fonts): copy beside theme.css and
// make the url()s relative.
const fontDir = resolve(".design-sync/entry/fonts");
mkdirSync(fontDir, { recursive: true });
const used = new Set([...res.css.matchAll(/url\("?\/fonts\/([^")]+)"?\)/g)].map((m) => m[1]));
let copied = 0;
for (const f of used) {
  const src = resolve(app, "public/fonts", f);
  if (existsSync(src)) { copyFileSync(src, resolve(fontDir, f)); copied++; }
  else console.error(`! font missing in ${APP}/public/fonts: ${f}`);
}
const body = res.css.replace(/url\("?\/fonts\/([^")]+)"?\)/g, 'url("./fonts/$1")');
writeFileSync(out, `@import url("${GOOGLE_FONTS}");\n` + body);
// series-site join-frame imports @elkdonis/cms-ui/baroque-signup.css, whose url("./baroque-frame.webp")
// esbuild can't load (no .webp loader in the converter). tsconfig paths alias that import to this
// generated copy with the frame inlined as a data URI.
{
  const dir = resolve("packages/cms-ui/src/auth");
  const webp = readFileSync(resolve(dir, "baroque-frame.webp")).toString("base64");
  const stub = readFileSync(resolve(dir, "baroque-signup.css"), "utf8")
    .replace(/url\("\.\/baroque-frame\.webp"\)/g, `url("data:image/webp;base64,${webp}")`);
  if (/url\(\s*["']?[^"')]*\.webp/i.test(stub)) throw new Error("baroque-signup.css: unhandled .webp url");
  writeFileSync(resolve(".design-sync/entry/stubs/baroque-signup.css"), stub);
}

console.log(`theme.css:${(body.length / 1024).toFixed(0)} KB, fonts: ${copied}/${used.size} copied, + Google Fonts import`);
