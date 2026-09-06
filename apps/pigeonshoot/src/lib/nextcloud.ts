/**
 * Nextcloud WebDAV helpers for the photo pipeline.
 *
 * Deliberately local to this app rather than added to @elkdonis/services: the
 * shared uploadFile() there builds its Basic auth header at module load, so a
 * missing credential yields silent 401s instead of a startup error, and it has
 * no folder-creation step. Both matter here — pigeonshoot writes into a brand
 * new org folder tree that nothing has created yet.
 *
 * ensureFolderTree is lifted from apps/art-auction, the one upload route in the
 * monorepo that got this right.
 */

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL ?? "http://nextcloud-nginx:80";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER ?? "";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD ?? "";

/** Built per call, so a missing credential is visible at the call site. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString("base64")}`;
}

export function isNextcloudConfigured(): boolean {
  return Boolean(NEXTCLOUD_URL && NEXTCLOUD_USER && NEXTCLOUD_PASS);
}

function davUrl(relativePath: string): string {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}/${encoded}`;
}

/**
 * Idempotently create each folder in a relative path via WebDAV MKCOL.
 * Nextcloud returns 405 when a collection already exists, which is success for
 * our purposes. Without this the first PUT into a fresh org folder 409s,
 * because the parent collection does not exist yet.
 */
export async function ensureFolderTree(relativeDir: string): Promise<void> {
  const segments = relativeDir.split("/").filter(Boolean);
  let current = "";
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg;
    const res = await fetch(davUrl(current), {
      method: "MKCOL",
      headers: { Authorization: authHeader() },
    });
    if (res.status !== 201 && res.status !== 405) {
      const text = await res.text().catch(() => "");
      throw new Error(`MKCOL ${current} failed ${res.status}: ${text.slice(0, 200)}`);
    }
  }
}

export async function putFile(
  relativePath: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const res = await fetch(davUrl(relativePath), {
    method: "PUT",
    headers: { Authorization: authHeader(), "Content-Type": contentType },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${relativePath} failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

/**
 * Delete a stored object.
 *
 * Used when a card is moderated to 'removed'. A copyright or
 * identifiable-person takedown has to destroy the bytes, not just unlink the
 * row — 'hidden' is the state that keeps them. 404 counts as success so a
 * retried takedown doesn't fail.
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const res = await fetch(davUrl(relativePath), {
    method: "DELETE",
    headers: { Authorization: authHeader() },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE ${relativePath} failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** Where a pigeonshoot photo lives. `card` holds the 800px derivatives. */
export function uploadPath(filename: string, variant: "full" | "card"): string {
  const base = "EAC_Network/pigeonshoot/Media/Images";
  return variant === "card" ? `${base}/card/${filename}` : `${base}/${filename}`;
}

/** Relative URL served by this app's /api/media/[...path] proxy. */
export function proxyUrl(relativePath: string): string {
  return `/api/media/${relativePath}`;
}
