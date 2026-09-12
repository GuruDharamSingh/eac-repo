/**
 * Calculate a chart and write it as SVG.
 *
 *   pnpm --filter @elkdonis/astro render -- out.svg [date time zone lat lon [houseSystem]] [--name "…"] [--place "…"]
 *
 * With no chart arguments it renders the engine's reference chart
 * (1990-05-15 14:30 America/New_York, New York City).
 */

import { writeFileSync } from "node:fs";
import { calculateChart } from "../src/server";
import { renderNatalSvg } from "../src/svg";
import type { HouseSystemCode } from "../src/types";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const name = flag("--name");
const place = flag("--place");
const [outFile = "natal-chart.svg", date = "1990-05-15", time = "14:30", timezone = "America/New_York", lat = "40.7128", lon = "-74.006", hsys = "P"] = args;

const chart = calculateChart({
  date,
  time,
  timezone,
  latitude: Number(lat),
  longitude: Number(lon),
  houseSystem: hsys as HouseSystemCode,
});
const svg = renderNatalSvg(chart, {
  name,
  locationName: place ?? (args.length <= 1 ? "New York City" : undefined),
});
writeFileSync(outFile, svg);
console.log(`wrote ${outFile} (${(svg.length / 1024).toFixed(0)} KB, ${chart.aspects.length} aspects, ${chart.ephemeris})`);
