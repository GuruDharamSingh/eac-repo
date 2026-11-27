// ============================================================================
// @elkdonis/content/routes: the content library's API routes as one factory (CONTRACT.md §5).
// Same pattern as services/center-routes.ts: an app does
//
//   const content = contentRoutes(marketHost);
//   export const GET = content.search;        // app/api/content/search/route.ts
//   export const GET = content.folders;       // app/api/content/folders/route.ts
//
// Server only (it reads the database and Nextcloud): import it from route files, never from a client module.
// Every handler: the viewer comes from host.viewer(req), never from a parameter; answers are Cache-Control: no-store.
// ============================================================================

import { cleanSourcePath, listMediaSource, type MediaFamily } from "@elkdonis/services";
import type { ContentHost } from "./host";
import { parseContentQuery } from "./query-string";
import { searchContent } from "./server/search";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const FAMILIES: readonly MediaFamily[] = ["image", "video", "audio", "document", "other"];

export interface ContentRoutes {
  /** GET /api/content/search */
  search: (req: Request) => Promise<Response>;
  /** GET /api/content/folders */
  folders: (req: Request) => Promise<Response>;
  /** POST /api/content/upload. Step 5 (the media lane); answers 501 until then. */
  upload?: (req: Request) => Promise<Response>;
}

export function contentRoutes(host: ContentHost): ContentRoutes {
  async function search(req: Request): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "GET only" }, 405);
    const sp = new URL(req.url).searchParams;
    let viewer;
    try {
      viewer = await host.viewer(req);
    } catch (err) {
      console.error("[content/search] viewer:", err);
      return json({ error: "Could not tell who is asking." }, 500);
    }
    // A signed-out request with no scope means the network (v1.2).
    if (!viewer && !sp.get("scope")) sp.set("scope", "network");
    const query = parseContentQuery(sp);
    if (!query) return json({ error: "A scope is required: mine, org:<id>, person:<id>, site or network." }, 400);

    // A signed-out visitor gets network or person (public only; the server predicate enforces it again).
    const kind = query.scope.kind as string;
    if (!viewer && kind !== "network" && kind !== "person") return json({ error: "Sign in to see this." }, 401);
    if (!viewer) {
      query.view = "published";
      delete query.includeHidden;
    }

    try {
      return json(await searchContent(viewer, query, host));
    } catch (err) {
      console.error("[content/search]", err);
      return json({ error: "Search failed." }, 500);
    }
  }

  async function folders(req: Request): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "GET only" }, 405);
    const sp = new URL(req.url).searchParams;

    let viewer;
    try {
      viewer = await host.viewer(req);
    } catch (err) {
      console.error("[content/folders] viewer:", err);
      return json({ error: "Could not tell who is asking." }, 500);
    }
    if (!viewer) return json({ error: "Sign in to browse files." }, 401);

    // "Missing" and "not allowed" are the same answer, so a probe learns nothing about what exists.
    const NOT_HERE = () => json({ error: "Not a folder here." }, 404);

    const sources = (await host.fileSources?.(viewer).catch(() => [])) ?? [];
    const source = sources.find((s) => s.key === sp.get("source"));
    if (!source || !source.root) return NOT_HERE();

    const showPrivate = Boolean(source.showPrivate);
    const path = cleanSourcePath(sp.get("path") ?? "", showPrivate);
    if (path === null) return NOT_HERE();
    // The root is the authorization boundary and came from the host, not the request. Belt and braces
    // beside listMediaSource's own check (dav.resolveWithin's rule): nothing leaves the root.
    const root = source.root.replace(/\/+$/, "");
    const full = path ? `${root}/${path}` : root;
    if (full !== root && !full.startsWith(`${root}/`)) return NOT_HERE();

    const accept = sp.get("accept")?.split(",").map((s) => s.trim()).filter((s): s is MediaFamily => (FAMILIES as readonly string[]).includes(s));
    try {
      const listing = await listMediaSource(root, path, {
        q: sp.get("q"),
        accept: accept?.length ? accept : undefined,
        showPrivate,
      });
      if ("error" in listing) return NOT_HERE();
      return json(listing);
    } catch (err) {
      // A folder that is not there answers like one that is not allowed.
      console.error("[content/folders]", err);
      return NOT_HERE();
    }
  }

  // TODO(Step 5, media lane): POST /api/content/upload through storeUpload + registerLibraryItem
  // (services/src/uploads.ts). Until it exists the route is typed and answers 501, so a host can mount it now.
  async function upload(_req: Request): Promise<Response> {
    return json({ error: "Upload is not available yet." }, 501);
  }

  return { search, folders, upload };
}
