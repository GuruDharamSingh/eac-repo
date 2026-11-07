// Assembles what the private test page needs. Run in the scratch h3/ folder, after hb.sh:
//   docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs land published.html
//   docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs page
// `land` cuts the captured landing data out of a published copy of the page, and writes landing.html and
// snapshot.html, which drive12 and drive5 need. `page` fills test.html to click-through-test.html.
const fs = require("fs");

const MAX_BYTES = 16e6; // The Artifact tool's limit for a page.
const die = (message) => { console.error(`pack-test: ${message}`); process.exit(1); };

function land(file) {
  if (!file) die("land needs the path of a published copy of the page");
  const b = fs.readFileSync(file);
  const open = Buffer.from('<script id="land-data" type="application/json">');
  const at = b.indexOf(open);
  if (at < 0) die(`${file} holds no land data`);
  const from = at + open.length;
  const to = b.indexOf("</script>", from);
  if (to < 0) die(`${file}: the land data has no end`);
  // As bytes, not reparsed: the JSON's <\/ escapes must survive, or the page's own script tag would close early.
  const raw = b.subarray(from, to);
  const data = JSON.parse(raw.toString("utf8"));
  fs.writeFileSync("land-data.json", raw);
  fs.writeFileSync("land.css", data.css);
  fs.writeFileSync("land-body.html", data.body);
  const head = "<!doctype html><meta charset=utf-8><link rel=stylesheet href=land.css><link rel=stylesheet href=visual.css>";
  fs.writeFileSync("snapshot.html", `${head}${data.body}<script src=live.js></script>`);
  fs.writeFileSync("landing.html", `${head}<link rel=stylesheet href=blocks.css>${data.body}<script src=landing.js></script>`);
  console.log(`land-data ${raw.length} css ${data.css.length} body ${data.body.length}`);
}

function page() {
  const fills = {
    "/*__EDITOR_CSS__*/": "editor.css",
    "/*__BLOCKS_CSS__*/": "blocks.css",
    "/*__SUNJAY_CSS__*/": "sunjay-banner.css",
    "__LAND_DATA__": "land-data.json",
    "__TEST_JS__": "test.js",
  };
  const template = fs.readFileSync("test.html", "utf8");
  // Cut once and joined, not String.replace: `$&` and `$'` in a bundle would be read as patterns, and a
  // placeholder's text inside a filled value would be filled again.
  const cuts = template.split(/(\/\*__EDITOR_CSS__\*\/|\/\*__BLOCKS_CSS__\*\/|\/\*__SUNJAY_CSS__\*\/|__LAND_DATA__|__TEST_JS__)/);
  for (const mark of Object.keys(fills)) {
    const count = cuts.filter((c) => c === mark).length;
    if (count !== 1) die(`test.html holds ${mark} ${count} times`);
  }
  const out = cuts.map((c) => {
    if (!(c in fills)) return c;
    const text = fs.readFileSync(fills[c], "utf8");
    const closes = c.startsWith("/*") ? /<\/style/i : /<\/script/i;
    if (closes.test(text)) die(`${fills[c]} holds an unescaped ${closes.source.replace("<\\/", "</")}, which would end the page's tag early`);
    return text;
  }).join("");
  const bytes = Buffer.byteLength(out);
  if (bytes > MAX_BYTES) die(`the page is ${bytes} bytes, over the limit of ${MAX_BYTES}`);
  fs.writeFileSync("click-through-test.html", out);
  console.log(`page bytes ${bytes}`);
}

const [mode, arg] = process.argv.slice(2);
if (mode === "land") land(arg);
else if (mode === "page") page();
else die("usage: pack-test.cjs land <published.html> | page");
