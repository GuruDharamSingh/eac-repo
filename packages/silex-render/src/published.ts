import { db } from "@elkdonis/db";
import { createNextcloudClient, downloadFile } from "@elkdonis/nextcloud";

/**
 * Helpers for reading an org's Silex-published static files out of the owner's
 * Nextcloud folder. Shared by every app that renders a published org site.
 */

export type SilexPublishedRef = {
  ncUser: string;
  path: string;
};

export function makeSilexPublishedRef(ncUser: string, path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `nextcloud://${encodeURIComponent(ncUser)}/${cleanPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function parseSilexPublishedRef(ref: string): SilexPublishedRef | null {
  try {
    const url = new URL(ref);
    if (url.protocol !== "nextcloud:") return null;
    const ncUser = decodeURIComponent(url.hostname);
    const path = url.pathname
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent)
      .join("/");
    if (!ncUser || !path) return null;
    return { ncUser, path };
  } catch {
    return null;
  }
}

export function joinPublishedAssetPath(entryPath: string, parts: string[]): string | null {
  if (parts.some((part) => part === ".." || part.includes("/"))) return null;
  const base = entryPath.split("/").slice(0, -1).join("/");
  return [base, ...parts].filter(Boolean).join("/");
}

export async function downloadPublishedFile(ref: SilexPublishedRef): Promise<Buffer | null> {
  const rows = await db<
    { nextcloud_user_id: string | null; nextcloud_app_password: string | null }[]
  >`
    SELECT nextcloud_user_id, nextcloud_app_password
    FROM users
    WHERE nextcloud_user_id = ${ref.ncUser}
    LIMIT 1
  `;
  const owner = rows[0];
  if (!owner?.nextcloud_user_id || !owner.nextcloud_app_password) return null;

  const baseUrl = process.env.NEXTCLOUD_URL;
  if (!baseUrl) return null;

  const client = createNextcloudClient({
    baseUrl,
    username: owner.nextcloud_user_id,
    password: owner.nextcloud_app_password,
  });

  try {
    return await downloadFile(client, ref.path);
  } catch {
    return null;
  }
}
