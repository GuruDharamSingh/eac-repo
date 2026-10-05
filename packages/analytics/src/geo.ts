import fs from 'node:fs';
import path from 'node:path';

// Country and region from a local MaxMind GeoLite2 City database. The IP is
// looked up in memory and never stored. With no database file the lookup
// returns nulls and the dashboard shows no geography.
//
// Database location: GEOIP_DB_PATH, else <repo root>/var/geoip/GeoLite2-City.mmdb
// (scripts/update-geoip.sh downloads it; needs MAXMIND_LICENSE_KEY).

export interface Geo {
  country: string | null;
  region: string | null;
}

type Reader = { get(ip: string): unknown };

let readerPromise: Promise<Reader | null> | null = null;
let warned = false;

function repoRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

function dbPath(): string | null {
  if (process.env.GEOIP_DB_PATH) return process.env.GEOIP_DB_PATH;
  const root = repoRoot();
  return root ? path.join(root, 'var', 'geoip', 'GeoLite2-City.mmdb') : null;
}

function openReader(): Promise<Reader | null> {
  if (!readerPromise) {
    readerPromise = (async () => {
      const file = dbPath();
      if (!file || !fs.existsSync(file)) {
        if (!warned) {
          warned = true;
          console.warn('[analytics] no GeoLite2 database at', file ?? '(unknown path)', '- visits are stored without country/region');
        }
        return null;
      }
      try {
        const maxmind = (await import('maxmind')).default;
        return (await maxmind.open(file)) as unknown as Reader;
      } catch (err) {
        console.warn('[analytics] could not open GeoLite2 database:', (err as Error).message);
        return null;
      }
    })();
    // Retry a missing database after a while (it may be installed later).
    readerPromise.then((r) => {
      if (!r) setTimeout(() => (readerPromise = null), 10 * 60_000).unref?.();
    });
  }
  return readerPromise;
}

export async function lookupGeo(ip: string | null): Promise<Geo> {
  if (!ip) return { country: null, region: null };
  const reader = await openReader();
  if (!reader) return { country: null, region: null };
  try {
    const rec = reader.get(ip) as {
      country?: { iso_code?: string };
      subdivisions?: Array<{ names?: { en?: string }; iso_code?: string }>;
    } | null;
    return {
      country: rec?.country?.iso_code ?? null,
      region: rec?.subdivisions?.[0]?.names?.en ?? rec?.subdivisions?.[0]?.iso_code ?? null,
    };
  } catch {
    return { country: null, region: null };
  }
}
