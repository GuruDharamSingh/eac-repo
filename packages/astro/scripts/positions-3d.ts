/**
 * Where the bodies actually are in space at one instant, from Swiss Ephemeris.
 *
 *   tsx scripts/positions-3d.ts [ISO-UTC]      (default: now)
 *
 * Prints, per body:
 *  - geocentric ecliptic longitude / latitude / distance (what a chart uses, plus the two
 *    numbers the wheel throws away)
 *  - heliocentric ecliptic latitude and distance (the planet's real place around the Sun)
 *  - heliocentric x, y, z in AU (ecliptic frame: x toward 0° Aries, z toward ecliptic north)
 */
import {calc_ut, constants, set_ephe_path, utc_to_jd} from 'sweph';

set_ephe_path('/app/packages/astro/ephe');
const when = new Date(process.argv[2] ?? Date.now());
const jd = utc_to_jd(
  when.getUTCFullYear(), when.getUTCMonth() + 1, when.getUTCDate(),
  when.getUTCHours(), when.getUTCMinutes(), when.getUTCSeconds(), constants.SE_GREG_CAL,
).data[1];

const BODIES: [string, number][] = [
  ['Sun', 0], ['Moon', 1], ['Mercury', 2], ['Venus', 3], ['Mars', 4], ['Jupiter', 5],
  ['Saturn', 6], ['Uranus', 7], ['Neptune', 8], ['Pluto', 9], ['Chiron', 15], ['Earth', 14],
];
const F = constants.SEFLG_SWIEPH;
const rows = BODIES.map(([name, id]) => {
  const geo = id === 14 ? null : calc_ut(jd, id, F).data; // lon, lat, dist(AU)
  const hel = id === 0 ? null : calc_ut(jd, id, F | constants.SEFLG_HELCTR).data;
  const xyz = id === 0 ? [0, 0, 0] : calc_ut(jd, id, F | constants.SEFLG_HELCTR | constants.SEFLG_XYZ).data;
  return {
    body: name,
    geoLon: geo ? +geo[0].toFixed(2) : null,
    geoLat: geo ? +geo[1].toFixed(2) : null,
    geoDistAU: geo ? +(id === 1 ? geo[2] : geo[2]).toFixed(id === 1 ? 5 : 3) : null,
    helioLat: hel ? +hel[1].toFixed(2) : null,
    helioDistAU: hel ? +hel[2].toFixed(3) : null,
    x: +xyz[0].toFixed(3),
    y: +xyz[1].toFixed(3),
    z: +xyz[2].toFixed(3),
  };
});
console.log(when.toISOString());
console.table(rows);
