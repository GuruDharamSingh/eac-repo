import { NextResponse, type NextRequest } from "next/server";
import { unfurl, assertPublicUrl, type Unfurled } from "@elkdonis/utils/unfurl";

/**
 * GET /api/link-preview?url=https://...  ->  { url, title, description, imageUrl, siteName, host }
 *
 * The web view's fallback card for sites that refuse to be framed. Fetching an author-typed address is an
 * SSRF surface; unfurl() refuses private addresses, odd ports and credentials at every redirect hop.
 * Public (guests read links too), so it is rate limited per client and cached.
 */
export const dynamic = "force-dynamic";

const UA = "ElkdonisExperiencesLinkPreview/1.0";
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; card: Unfurled }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("url") ?? "").trim();
  if (!raw || raw.length > 2000) return NextResponse.json({ error: "Give a web address." }, { status: 400 });
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Slow down." }, { status: 429, headers: { "Retry-After": "60" } });

  try {
    await assertPublicUrl(url);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "That link cannot be used." }, { status: 400 });
  }

  const hit = cache.get(url);
  let card = hit && Date.now() - hit.at < CACHE_MS ? hit.card : null;
  if (!card) {
    card = await unfurl(url, { userAgent: UA });
    cache.set(url, { at: Date.now(), card });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  let host = card.url;
  try { host = new URL(card.url).hostname.replace(/^www\./, ""); } catch { /* keep */ }
  return NextResponse.json({ ...card, host }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } });
}
