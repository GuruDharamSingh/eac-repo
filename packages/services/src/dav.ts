/**
 * The WebDAV plumbing shared by every storage surface.
 *
 * This exists because the same PROPFIND-and-parse was written five times:
 * once correctly here (originally inside user-storage.ts), once as a stub that
 * returns [] (`listFiles` in nextcloud.ts), once in packages/nextcloud/files.ts
 * that silently drops directories, once in packages/blog-server/media.ts
 * "to avoid env initialization issues", and once per app in the Mantine file
 * browsers. Adding an org-scoped browser was going to make it six.
 *
 * Everything here goes out over the single service account. That account can
 * see every org's files and every person's files, so NOTHING in this file is a
 * security boundary — the caller must have established who is asking and what
 * they may see before it gets here. `resolveWithin` guards path traversal
 * only, which is a different problem from authorization.
 */

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL ?? '';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER ?? '';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD ?? '';

export interface DavEntry {
  name: string;
  path: string;
  /** Platform URL for reading it — never a Nextcloud URL. */
  url: string;
  size: number;
  mimeType: string | null;
  lastModified: string | null;
  isFolder: boolean;
}

export function davConfigured(): boolean {
  return Boolean(NEXTCLOUD_URL && NEXTCLOUD_USER);
}

export function davAuthHeader(): string {
  return `Basic ${Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString('base64')}`;
}

export function encodePath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export function davUrl(path: string): string {
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}/${encodePath(path)}`;
}

/**
 * Turn a caller-supplied relative path into a real one under `root`, or throw.
 *
 * Throws rather than clamping: a path that tries to escape is a bug or an
 * attack, and silently serving the root would hide both.
 */
export function resolveWithin(root: string, relative = ''): string {
  const rel = (relative ?? '').replace(/^\/+|\/+$/g, '');
  if (!rel) return root;
  if (rel.includes('..') || rel.includes('\\') || rel.includes('\0')) {
    throw new Error(`resolveWithin: illegal path ${JSON.stringify(relative)}`);
  }
  const full = `${root}/${rel}`;
  // Belt and braces: even with the checks above, never return a path that is
  // not literally inside the root.
  if (full !== root && !full.startsWith(`${root}/`)) {
    throw new Error('resolveWithin: escapes root');
  }
  return full;
}

const PROPFIND_BODY =
  `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop>` +
  `<d:resourcetype/><d:getcontentlength/><d:getcontenttype/><d:getlastmodified/>` +
  `</d:prop></d:propfind>`;

export function parsePropfind(xml: string, basePath: string): DavEntry[] {
  const out: DavEntry[] = [];
  const base = decodeURIComponent(
    `/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}/${encodePath(basePath)}`
  ).replace(/\/$/, '');

  for (const block of xml.split(/<\/(?:d:|D:)?response>/i)) {
    const href = block.match(/<(?:d:|D:)?href>([^<]+)<\/(?:d:|D:)?href>/i);
    if (!href) continue;
    const decoded = decodeURIComponent(href[1]).replace(/\/$/, '');
    if (decoded === base) continue; // the collection itself
    const name = decoded.slice(base.length + 1);
    if (!name || name.includes('/')) continue; // depth-1 only

    const isFolder = /<(?:d:|D:)?collection\s*\/>/i.test(block);
    const size = Number(block.match(/<(?:d:|D:)?getcontentlength>(\d+)</i)?.[1] ?? 0);
    const mime = block.match(/<(?:d:|D:)?getcontenttype>([^<]+)</i)?.[1] ?? null;
    const mod = block.match(/<(?:d:|D:)?getlastmodified>([^<]+)</i)?.[1] ?? null;
    const path = `${basePath}/${name}`;

    out.push({ name, path, url: `/api/media/${path}`, size, mimeType: mime, lastModified: mod, isFolder });
  }
  // Folders first, then by name — a stable order beats whatever order the
  // server happened to return.
  return out.sort((a, b) =>
    a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1
  );
}

/**
 * A whole folder TREE in one request (Depth: infinity) — files only, each
 * with its path from `path`. For catalogues and audits, not for browsing:
 * `limit` caps it, and a missing folder is [] rather than a throw.
 * Nextcloud allows infinite depth for the service account; if a server
 * refuses (403/501), this degrades to [] and logs.
 */
export async function davListDeep(path: string, limit = 5000): Promise<DavEntry[]> {
  if (!davConfigured()) return [];
  const res = await fetch(davUrl(path), {
    method: 'PROPFIND',
    headers: {
      Authorization: davAuthHeader(),
      Depth: 'infinity',
      'Content-Type': 'application/xml',
    },
    body: PROPFIND_BODY,
  });
  if (res.status === 404) return [];
  if (res.status !== 207) {
    console.error(`[dav] PROPFIND(infinity) ${path} -> ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const base = decodeURIComponent(
    `/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}/${encodePath(path)}`
  ).replace(/\/$/, '');
  const out: DavEntry[] = [];
  for (const block of xml.split(/<\/(?:d:|D:)?response>/i)) {
    if (out.length >= limit) break;
    const href = block.match(/<(?:d:|D:)?href>([^<]+)<\/(?:d:|D:)?href>/i);
    if (!href) continue;
    if (/<(?:d:|D:)?collection\s*\/>/i.test(block)) continue; // files only
    const decoded = decodeURIComponent(href[1]);
    if (!decoded.startsWith(base + '/')) continue;
    const rel = decoded.slice(base.length + 1);
    const name = rel.split('/').pop() ?? rel;
    const full = `${path}/${rel}`;
    out.push({
      name,
      path: full,
      url: `/api/media/${full}`,
      size: Number(block.match(/<(?:d:|D:)?getcontentlength>(\d+)</i)?.[1] ?? 0),
      mimeType: block.match(/<(?:d:|D:)?getcontenttype>([^<]+)</i)?.[1] ?? null,
      lastModified: block.match(/<(?:d:|D:)?getlastmodified>([^<]+)</i)?.[1] ?? null,
      isFolder: false,
    });
  }
  return out;
}

/** One level of a folder. Missing folder → [], never a throw. */
export async function davList(path: string): Promise<DavEntry[]> {
  if (!davConfigured()) return [];
  const res = await fetch(davUrl(path), {
    method: 'PROPFIND',
    headers: {
      Authorization: davAuthHeader(),
      Depth: '1',
      'Content-Type': 'application/xml',
    },
    body: PROPFIND_BODY,
  });
  if (res.status === 404) return [];
  if (res.status !== 207) {
    console.error(`[dav] PROPFIND ${path} -> ${res.status}`);
    return [];
  }
  return parsePropfind(await res.text(), path);
}

export async function davPut(
  path: string,
  body: Uint8Array,
  contentType: string
): Promise<boolean> {
  if (!davConfigured()) return false;
  // This package targets a lib without DOM types, so `BodyInit` is not in
  // scope even though fetch accepts a Uint8Array at runtime. Cast the whole
  // init through fetch's own parameter type rather than reaching for `any`.
  const init = {
    method: 'PUT',
    headers: { Authorization: davAuthHeader(), 'Content-Type': contentType },
    body,
  } as unknown as Parameters<typeof fetch>[1];
  const res = await fetch(davUrl(path), init);
  return res.ok;
}

/**
 * Read a file back as text. Null when it is missing or unreadable.
 *
 * The counterpart to davPut, and the half that was never written — which is
 * why `threads.nextcloud_last_sync` has existed since the schema was laid down
 * and has never held a value: nothing could read a document back to sync it.
 */
export async function davGetText(path: string): Promise<string | null> {
  if (!davConfigured()) return null;
  const res = await fetch(davUrl(path), {
    headers: { Authorization: davAuthHeader() },
  });
  if (!res.ok) {
    if (res.status !== 404) console.error(`[dav] GET ${path} -> ${res.status}`);
    return null;
  }
  return res.text();
}

/** Last-modified time of one file, for staleness comparisons. Null if absent. */
export async function davLastModified(path: string): Promise<Date | null> {
  if (!davConfigured()) return null;
  const res = await fetch(davUrl(path), {
    method: 'HEAD',
    headers: { Authorization: davAuthHeader() },
  });
  if (!res.ok) return null;
  const header = res.headers.get('last-modified');
  if (!header) return null;
  const parsed = new Date(header);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Create a folder. Already-exists (405) counts as success — it's idempotent. */
export async function davMkcol(path: string): Promise<boolean> {
  if (!davConfigured()) return false;
  const res = await fetch(davUrl(path), {
    method: 'MKCOL',
    headers: { Authorization: davAuthHeader() },
  });
  return res.ok || res.status === 405;
}

/**
 * Move or rename. Never overwrites: a name clash is a 412 and returns false,
 * so the caller picks a new name instead of silently destroying a file.
 */
export async function davMove(from: string, to: string): Promise<boolean> {
  if (!davConfigured()) return false;
  const res = await fetch(davUrl(from), {
    method: 'MOVE',
    headers: { Authorization: davAuthHeader(), Destination: davUrl(to), Overwrite: 'F' },
  });
  if (!res.ok) console.error(`[dav] MOVE ${from} -> ${to}: ${res.status}`);
  return res.ok;
}

/** Delete. Already-gone (404) counts as success — it's the desired end state. */
export async function davDelete(path: string): Promise<boolean> {
  if (!davConfigured()) return false;
  const res = await fetch(davUrl(path), {
    method: 'DELETE',
    headers: { Authorization: davAuthHeader() },
  });
  return res.ok || res.status === 404;
}
