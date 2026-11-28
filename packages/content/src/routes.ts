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

import { db } from "@elkdonis/db";
import {
  cleanSourcePath, getStorageSlug, indexFilePath, listMediaSource, maxUploadBytes, mediaFamilyOf, orgStorageRoot, storeUpload, userStorageRoot,
  type MediaFamily,
} from "@elkdonis/services";
import type { ContentHost } from "./host";
import { parseContentQuery } from "./query-string";
import { mayManageOrg, resolveRights } from "./server/access";
import { resolveContentRefs, searchContent } from "./server/search";
import { suggestContent, SUGGEST_Q_MAX } from "./server/suggest";
import { contentCheckoutRoutes, type ContentPayments, type RateLimiter } from "./server/checkout";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const FAMILIES: readonly MediaFamily[] = ["image", "video", "audio", "document", "other"];

export interface ContentRoutes {
  /** GET /api/content/search */
  search: (req: Request) => Promise<Response>;
  /** GET /api/content/resolve?keys=a,b,c (max 50): resolveContentRefs as the session's viewer; signed-out gets public rows only. */
  resolve: (req: Request) => Promise<Response>;
  /** GET /api/content/suggest?q=&limit= (default 5, max 10 per group): pieces, listed people and public orgs; signed-out gets public only. */
  suggest: (req: Request) => Promise<Response>;
  /** GET /api/content/folders */
  folders: (req: Request) => Promise<Response>;
  /** POST /api/content/upload (Step 5): multipart `file`, optional `source` (a key from host.fileSources, default "mine"). */
  upload?: (req: Request) => Promise<Response>;
  /** POST /api/content/checkout (v1.4; only when `payments` is passed to contentRoutes). */
  checkout?: (req: Request) => Promise<Response>;
  /** GET /api/content/checkout/return (Stripe's success URL; only with `payments`). */
  checkoutReturn?: (req: Request) => Promise<Response>;
}

/**
 * v1.4 (2026-11-27): `opts.payments` adds checkout and checkoutReturn (content-library checkout, sold through the
 * network org `oad`). Without it the routes are exactly as before. A host passes `redisRateLimiter(client)` as
 * `limiter` and mounts the routes only after Justin gives that app its go (CONTRACT §17).
 */
export function contentRoutes(host: ContentHost, opts: { payments?: ContentPayments; limiter?: RateLimiter } = {}): ContentRoutes {
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
    // The offers view (v1.4) stays: with a null viewer its rows are public published ones (access.ts), the same rule.
    if (!viewer) {
      if (query.view !== "offers") query.view = "published";
      delete query.includeHidden;
    }

    try {
      return json(await searchContent(viewer, query, host));
    } catch (err) {
      console.error("[content/search]", err);
      return json({ error: "Search failed." }, 500);
    }
  }

  async function resolve(req: Request): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "GET only" }, 405);
    const keys = (new URL(req.url).searchParams.get("keys") ?? "").split(",").map((k) => k.trim()).filter(Boolean);
    if (!keys.length) return json({ error: "keys is required: thread:<id>,artwork:<id>" }, 400);
    if (keys.length > 50) return json({ error: "At most 50 keys." }, 400);
    let viewer;
    try {
      viewer = await host.viewer(req);
    } catch (err) {
      console.error("[content/resolve] viewer:", err);
      return json({ error: "Could not tell who is asking." }, 500);
    }
    try {
      // null viewer: public published rows only (the server predicate decides).
      return json(await resolveContentRefs(viewer, keys, host));
    } catch (err) {
      console.error("[content/resolve]", err);
      return json({ error: "Resolve failed." }, 500);
    }
  }

  async function suggest(req: Request): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "GET only" }, 405);
    const sp = new URL(req.url).searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, SUGGEST_Q_MAX);
    const limit = Number.parseInt(sp.get("limit") ?? "", 10);
    let viewer;
    try {
      viewer = await host.viewer(req);
    } catch (err) {
      console.error("[content/suggest] viewer:", err);
      return json({ error: "Could not tell who is asking." }, 500);
    }
    try {
      return json(await suggestContent(viewer, q, host, { limit: Number.isFinite(limit) ? limit : undefined }));
    } catch (err) {
      console.error("[content/suggest]", err);
      return json({ error: "Suggest failed." }, 500);
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

  // POST /api/content/upload: `file`, and `source` (default "mine"). The destination is confined to a root the server
  // built from the session: the viewer's own users/<folder>/ ("mine"), or an org source (`org:<id>`) the viewer owns
  // or guides. Bytes go through storeUpload (size, sniff, re-encode, path confinement); the stored file is then
  // indexed (a listing, no bytes). Answers { url, name, path, source, key }, `path` relative to the source root.
  async function upload(req: Request): Promise<Response> {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    let viewer;
    try {
      viewer = await host.viewer(req);
    } catch (err) {
      console.error("[content/upload] viewer:", err);
      return json({ error: "Could not tell who is asking." }, 500);
    }
    if (!viewer) return json({ error: "Sign in to upload." }, 401);

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > maxUploadBytes(["personal", "site"]) + 256 * 1024) return json({ error: "That file is too large." }, 413);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !file || typeof file === "string") return json({ error: "No file provided." }, 400);

    try {
      const sources = (await host.fileSources?.(viewer).catch(() => [])) ?? [];
      const key = typeof form.get("source") === "string" && String(form.get("source")).trim() ? String(form.get("source")).trim() : "mine";
      const source = sources.find((x) => x.key === key);
      if (!source || !source.root) return json({ error: "Not a place you can upload to." }, 404);
      const root = source.root.replace(/\/+$/, "");

      const bytes = new Uint8Array(await (file as File).arrayBuffer());
      const named = { name: (file as File).name || "upload", type: (file as File).type || undefined, bytes };
      const family = mediaFamilyOf(named.name, named.type);
      const folder = family === "image" ? "Images" : family === "video" ? "Videos" : family === "audio" ? "Audio" : "Documents";
      let result;
      if (key === "mine") {
        const slug = await getStorageSlug(viewer.userId);
        if (!slug || userStorageRoot(slug) !== root) return json({ error: "Not a place you can upload to." }, 403);
        result = await storeUpload({ kind: "personal", actor: { userId: viewer.userId }, file: named, folder });
      } else if (key.startsWith("org:")) {
        const orgId = key.slice(4);
        if (!orgId || orgStorageRoot(orgId) !== root) return json({ error: "Not a place you can upload to." }, 403);
        if (!mayManageOrg(await resolveRights(viewer), orgId)) return json({ error: "Only the people who run this organisation can upload here." }, 403);
        result = await storeUpload({ kind: "site", actor: { userId: viewer.userId }, file: named, orgId });
      } else {
        return json({ error: "Not a place you can upload to." }, 404);
      }
      if (!result.ok) return json({ error: result.error }, result.status);

      await indexFilePath(result.path); // never throws; an index miss does not fail the upload
      const [row] = await db<Array<{ key: string }>>`SELECT key FROM content_index WHERE store = 'file' AND file_path = ${result.path} LIMIT 1`.catch(() => []);
      return json({
        ok: true, url: result.url, name: result.name, path: result.path.startsWith(`${root}/`) ? result.path.slice(root.length + 1) : result.path,
        source: key, key: row?.key ?? null, mimeType: result.mimeType, size: result.size,
      });
    } catch (err) {
      console.error("[content/upload]", err);
      return json({ error: "Upload failed." }, 500);
    }
  }

  return { search, resolve, suggest, folders, upload, ...(opts.payments ? contentCheckoutRoutes(host, opts.payments, opts.limiter) : {}) };
}
