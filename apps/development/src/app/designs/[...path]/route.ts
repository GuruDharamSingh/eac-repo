import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getNetworkAdmin } from "@/lib/gate";

// ============================================================================
// Serves the design handoff bundles kept in apps/development/designs/ (not public/: the gate
// below applies to them too). Each bundle is the unzipped handoff as delivered, so its
// `.dc.html` files load `./support.js` and their fonts by relative path and play live here,
// in an iframe on the "Design handoffs" idea or in a tab of their own.
//
// support.js pulls React 18.3.1, ReactDOM and Babel standalone from unpkg, and the designs
// link Google Fonts; the viewer's browser needs the network for them. Nothing is sent from
// this server.
// ============================================================================

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "designs");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await getNetworkAdmin())) return new Response("Not found", { status: 404 });

  const parts = (await params).path.map((p) => decodeURIComponent(p));
  if (parts.some((p) => p === ".." || p.includes("/") || p.includes("\\") || p.startsWith("."))) {
    return new Response("Not found", { status: 404 });
  }
  const file = path.join(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });

  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const s = await stat(file);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": type,
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
