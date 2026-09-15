import { calculateSkyAt } from "../src/server";
import { renderWheelSvg } from "../src/wheel";
const c = calculateSkyAt(new Date("2026-09-14T12:00:00Z"), 51.4769, -0.0005);
for (const lite of [false, true]) {
const svg = renderWheelSvg(c, { orient: "aries", lite });
const count = (re: RegExp) => (svg.match(re) ?? []).length;
console.log(lite ? "-- LITE --" : "-- FULL --");
console.log("total elements :", count(/<(line|circle|path|text|rect|g|polygon)\b/g));
console.log("  <line>       :", count(/<line\b/g));
console.log("  <text>       :", count(/<text\b/g));
console.log("  <path>       :", count(/<path\b/g));
console.log("  <circle>     :", count(/<circle\b/g));
console.log("  <rect>       :", count(/<rect\b/g));
console.log("bytes          :", svg.length);
}
console.log("aspects in chart:", c.aspects.length, "of which to angles:",
  c.aspects.filter(a => a.a === "ascendant" || a.b === "ascendant" || a.a === "midheaven" || a.b === "midheaven").length);
