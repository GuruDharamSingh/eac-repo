// Compares two files from render-published.sh, byte by byte. Every case of the baseline must be present and identical;
// extra cases (new blocks) are listed. `node compare-render.cjs baseline.json now.json`. Exit 1 on a difference.
const fs = require("fs");
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
let same = 0, differ = 0;
for (const k of Object.keys(a)) {
  if (a[k] === b[k]) { same++; continue; }
  differ++;
  if (b[k] === undefined) { console.log(`FAIL ${k}: missing`); continue; }
  let i = 0; while (i < a[k].length && a[k][i] === b[k][i]) i++;
  console.log(`FAIL ${k}: differs at byte ${i}\n  was ${JSON.stringify(a[k].slice(Math.max(0, i - 40), i + 80))}\n  now ${JSON.stringify(b[k].slice(Math.max(0, i - 40), i + 80))}`);
}
const extra = Object.keys(b).filter((k) => !(k in a));
if (extra.length) console.log(`extra cases: ${extra.join(", ")}`);
console.log(`pass ${same} fail ${differ}`);
process.exit(differ ? 1 : 0);
