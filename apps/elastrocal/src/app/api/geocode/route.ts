import { NextResponse, type NextRequest } from "next/server";
import { timeZoneAt } from "@elkdonis/astro/server";
import { siteConfig } from "@/config/site";

/**
 * Birthplace search: Nominatim, proxied.
 *
 * Why a proxy rather than calling Nominatim from the browser (as the
 * prototype did): its policy requires an identifying User-Agent, which a
 * browser can't set, and at most one request per second from the whole
 * application — enforced here, for every visitor at once. The form only
 * searches on submit; search-as-you-type is forbidden by the same policy.
 *
 * Each result also carries the IANA time zone at its coordinates (offline
 * lookup), replacing the prototype's longitude ÷ 15 estimate, which put e.g.
 * all of India on Asia/Karachi and ignored DST rules entirely.
 */

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const cache = new Map<string, GeocodeResult[]>();
const CACHE_MAX = 500;
let nextSlot = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 200) {
    return NextResponse.json({ error: "Enter a place to search for" }, { status: 400 });
  }

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ results: hit });

  await throttle();
  const url = new URL(siteConfig.geocoderUrl);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");

  let raw: { display_name: string; lat: string; lon: string }[];
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": siteConfig.geocoderUserAgent,
        "Accept-Language": request.headers.get("accept-language") ?? "en",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    raw = await res.json();
  } catch (err) {
    console.error("[elastrocal] geocode failed", err);
    return NextResponse.json(
      { error: "Place search is unavailable right now — enter coordinates instead" },
      { status: 502 },
    );
  }

  const results: GeocodeResult[] = raw.map((r) => {
    const latitude = Number(r.lat);
    const longitude = Number(r.lon);
    return { name: r.display_name, latitude, longitude, timezone: timeZoneAt(latitude, longitude) };
  });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, results);
  return NextResponse.json({ results });
}
