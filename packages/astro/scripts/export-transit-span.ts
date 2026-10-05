/**
 * Export a natal chart plus the transiting sky sampled over a window, as JSON
 * for the Remotion chart-motion library.
 *
 *   tsx scripts/export-transit-span.ts out.json <natalDate> <natalTime> <zone> <lat> <lon> <fromUTC> <days> [stepHours] [house]
 *
 * Longitude, ecliptic latitude and speed only: the animation interpolates between samples and computes the
 * aspects itself (same orbs and rules as transits.ts), so motion is continuous.
 */

import { writeFileSync } from "node:fs";
import { calculateChart } from "../src/server";
import type { HouseSystemCode } from "../src/types";

const [out, date, time, zone, lat, lon, from, daysArg, stepArg = "12", house = "P"] = process.argv.slice(2);
if (!out || !from || !daysArg) {
  console.error("usage: out.json natalDate natalTime zone lat lon fromUTC(YYYY-MM-DD) days [stepHours] [house]");
  process.exit(2);
}

const natal = calculateChart({
  date,
  time,
  timezone: zone,
  latitude: Number(lat),
  longitude: Number(lon),
  houseSystem: house as HouseSystemCode,
});

const stepH = Number(stepArg);
const start = Date.parse(`${from}T00:00:00Z`);
const samples = Math.round((Number(daysArg) * 24) / stepH) + 1;
const keys = natal.bodies.map((b) => b.key);
const rows: { utc: string; lon: number[]; lat: number[]; spd: number[] }[] = [];

for (let i = 0; i < samples; i++) {
  const t = new Date(start + i * stepH * 3_600_000);
  const iso = t.toISOString();
  const sky = calculateChart({
    date: iso.slice(0, 10),
    time: iso.slice(11, 19),
    timezone: "UTC",
    latitude: Number(lat),
    longitude: Number(lon),
    houseSystem: house as HouseSystemCode,
  });
  const by = Object.fromEntries(sky.bodies.map((b) => [b.key, b]));
  rows.push({
    utc: iso,
    lon: keys.map((k) => Number((by[k]?.longitude ?? NaN).toFixed(5))),
    lat: keys.map((k) => Number((by[k]?.latitude ?? 0).toFixed(4))),
    spd: keys.map((k) => Number((by[k]?.speed ?? 0).toFixed(5))),
  });
}

writeFileSync(
  out,
  JSON.stringify({
    engineVersion: natal.engineVersion,
    ephemeris: natal.ephemeris,
    natal: {
      input: natal.input,
      utc: natal.utc,
      bodies: natal.bodies,
      houses: natal.houses,
      angles: natal.angles,
      aspects: natal.aspects,
    },
    transit: { from, stepHours: stepH, keys, rows },
  }),
);
console.log(`wrote ${out}: ${samples} samples, ${keys.length} bodies, ephemeris ${natal.ephemeris}`);
