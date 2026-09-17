/**
 * End-to-end: a DTCG file becomes a stored, resolvable theme.
 *
 * Run against the real database, because the point is to prove the seam
 * between this package (which has no database) and the theme service (which is
 * all database) actually holds — including that everything the importer calls
 * "storable" survives the service's own sanitizer without being dropped.
 */
import { readFileSync } from "node:fs";
import { importDtcg, linkHooks } from "../src/index.js";
import {
  resolveTheme,
  renderThemeCss,
  saveSiteTheme,
  getThemeOverrides,
} from "../../services/src/themes.js";

const ORG = process.argv[2] ?? "danamccool";
// A real user id: site_themes.updated_by is a foreign key to users, so a
// placeholder UUID fails the insert rather than being ignored.
const BY = process.argv[3] ?? "";
const file = JSON.parse(readFileSync(new URL("../fixtures/sample.tokens.json", import.meta.url), "utf8"));

const result = importDtcg(file, { prefix: "eac" });
const linked = linkHooks(result, {
  "--eac-control-accent": "color.semantic.accent",
  "--eac-control-radius": "radius.control",
  "--eac-block-band": "chrome.band",
});

const vars = { ...result.vars, ...linked.vars };
console.log(`imported ${result.counts.vars} vars + ${Object.keys(linked.vars).length} hooks = ${Object.keys(vars).length}`);
console.log(`dropped ${result.counts.dropped}:`);
for (const i of result.issues) console.log(`   [${i.kind}] ${i.path}: ${i.message}`);

const saved = await saveSiteTheme(ORG, "", vars, BY);
console.log(`\nsaveSiteTheme -> ${JSON.stringify(saved)}`);

const back = await getThemeOverrides({ orgId: ORG });
const lost = Object.keys(vars).filter((k) => !(k in back));
console.log(`read back ${Object.keys(back).length} of ${Object.keys(vars).length}`);
// Distinguish the two ways a variable can fail to come back: the save never
// happened, or the save happened and the sanitizer rejected it. Only the
// second is this package's problem.
if (!saved.ok) console.log("  (save failed, so nothing was read back — see the error above)");
else console.log(lost.length ? `  LOST BY THE SANITIZER: ${lost.join(", ")}` : "  nothing was dropped on the way in");

const resolved = await resolveTheme({ orgId: ORG });
const css = renderThemeCss(resolved);
console.log(`\nrendered CSS (${css?.length ?? 0} chars):`);
console.log("  " + (css ?? "(null)").slice(0, 300) + "…");

process.exit(lost.length === 0 && saved.ok && !!css ? 0 : 1);
