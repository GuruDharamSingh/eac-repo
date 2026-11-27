// Mock endpoints for the library harness: a fake file tree behind /api/m/<source> and
// /api/content/folders?source=<key>, and a hook for a fake /api/content/search.
// Installed as window.fetch; nothing else reaches a network.

export function art(seed: string, w = 320, h = 220): string {
  const hue = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="hsl(${hue} 18% 78%)"/><rect y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="hsl(${(hue + 30) % 360} 22% 52%)"/><circle cx="${w * 0.7}" cy="${h * 0.3}" r="${h * 0.14}" fill="hsl(${(hue + 160) % 360} 30% 90%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface Entry { name: string; path: string; isFolder: boolean; url?: string; mimeType?: string; size?: number; lastModified?: string; shortcut?: { source: string; path: string } }

const img = (dir: string, name: string, size: number, day: number): Entry => ({ name, path: dir ? `${dir}/${name}` : name, isFolder: false, url: art(name), mimeType: "image/jpeg", size, lastModified: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z` });
const dir = (parent: string, name: string): Entry => ({ name, path: parent ? `${parent}/${name}` : name, isFolder: true });

export const TREE: Record<string, Record<string, Entry[]>> = {
  mine: {
    "": [
      dir("", "Paris"), dir("", "Brittany"),
      { name: "Places (org)", path: "Places", isFolder: true, shortcut: { source: "org", path: "Places" } },
      img("", "cover-sketch.jpg", 412000, 3), img("", "marsh-dawn.jpg", 1820000, 4), img("", "kiln-door.jpg", 903000, 5),
      { name: "price-list.pdf", path: "price-list.pdf", isFolder: false, url: "data:application/pdf;base64,JVBERi0=", mimeType: "application/pdf", size: 88000, lastModified: "2026-11-02T12:00:00Z" },
      { name: "intro-take2.mp4", path: "intro-take2.mp4", isFolder: false, url: "data:video/mp4;base64,AAAA", mimeType: "video/mp4", size: 24500000, lastModified: "2026-11-01T12:00:00Z" },
      { name: "bells.mp3", path: "bells.mp3", isFolder: false, url: "data:audio/mpeg;base64,AAAA", mimeType: "audio/mpeg", size: 3100000, lastModified: "2026-10-30T12:00:00Z" },
    ],
    Paris: [dir("Paris", "Louvre"), img("Paris", "pont-neuf.jpg", 2200000, 8), img("Paris", "left-bank.jpg", 1400000, 9), img("Paris", "gargoyle.jpg", 760000, 10)],
    "Paris/Louvre": [img("Paris/Louvre", "pyramid.jpg", 1900000, 11), img("Paris/Louvre", "cour-napoleon.jpg", 1200000, 12)],
    Brittany: [img("Brittany", "granite-coast.jpg", 2600000, 6), img("Brittany", "oyster-boats.jpg", 1700000, 7)],
  },
  org: {
    "": [dir("", "Places"), img("", "logo-lockup.jpg", 220000, 1), img("", "team-photo.jpg", 3400000, 2)],
    Places: [img("Places", "montmartre.jpg", 2100000, 13), img("Places", "seine-dusk.jpg", 1950000, 14)],
  },
};

const allFiles = (src: string) => Object.values(TREE[src] ?? {}).flat().filter((x) => !x.isFolder);

function listing(src: string, path: string, q: string) {
  if (src === "locked") return { status: 403, body: { error: "You can't open this folder." } };
  const tree = TREE[src];
  if (!tree) return { status: 404, body: { error: "No such source" } };
  if (q) return { status: 200, body: { path: "", browsable: true, search: true, items: allFiles(src).filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) } };
  return { status: 200, body: { path, browsable: true, items: tree[path] ?? [] } };
}

/** The old flat shape: { items: [{ url, name }] } */
const FLAT = { items: TREE.mine![""]!.filter((f) => !f.isFolder).slice(0, 5).map((f) => ({ url: f.url, name: f.name })) };

export const SAMPLE_UPLOAD = { url: art("fresh-upload.jpg"), name: "fresh-upload.jpg", path: "uploads/fresh-upload.jpg" };

export interface MockHit { status: number; body: unknown; delay?: number }
let searchHandler: ((u: URL) => MockHit | null) | null = null;
export function setSearchHandler(fn: (u: URL) => MockHit | null) {
  searchHandler = fn;
}
export const calls: string[] = [];
(window as unknown as { __calls: string[] }).__calls = calls;

export function installMock() {
  const real = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://harness.local");
    const p = url.pathname;
    let hit: MockHit | null = null;
    if (p.startsWith("/api/m/")) {
      const key = p.slice("/api/m/".length);
      if (key === "flat") hit = { status: 200, body: FLAT };
      else hit = listing(key, url.searchParams.get("path") ?? "", url.searchParams.get("q") ?? "");
    } else if (p === "/api/content/folders") {
      hit = listing(url.searchParams.get("source") ?? "", url.searchParams.get("path") ?? "", url.searchParams.get("q") ?? "");
    } else if (p === "/api/m-upload") {
      hit = { status: 200, body: SAMPLE_UPLOAD };
    } else if (p === "/api/content/search" && searchHandler) {
      hit = searchHandler(url);
    }
    if (!hit) return real(input, init);
    calls.push(`${init?.method ?? "GET"} ${p}${url.search}`);
    const h = hit;
    if (h.delay) {
      await new Promise<void>((res, rej) => {
        const t = setTimeout(res, h.delay);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          rej(new DOMException("Aborted", "AbortError"));
        });
      });
    }
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return new Response(JSON.stringify(h.body), { status: h.status, headers: { "Content-Type": "application/json" } });
  }) as typeof window.fetch;
}
