import { stat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { db } from "@elkdonis/db";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Pureland at arts-collective.com/pureland — the web game from the BuddhasEngines8 repo, private
 * to the `BuddhasEngines` org (migration 197) while it is tested.
 *
 *   /pureland                 the page: sign-in / "private" / the member landing (+ Manage for owners)
 *   /pureland/play/…          the game's files, streamed from PURELAND_RELEASES/current/ to members
 *                             only (src/app/pureland/play/[[...path]]/route.ts)
 *   /api/pureland/save        the player's cloud save (GET/PUT), used by the game's shell
 *
 * Roles are the platform's (user_organizations): owner manages and plays; guide and member play
 * ("tester" on the page is `member`); viewer is a non-member, because /api/org/join hands it out
 * ungated (docs/reference/identity-and-tenancy.md).
 */

export const PURELAND_ORG = "BuddhasEngines";
export const PURELAND_GAME = "pureland";
export const PLAY_ROLES: OrgRole[] = ["owner", "guide", "member"];
export const MANAGE_ROLES: OrgRole[] = ["owner"];
export const ASSIGNABLE_ROLES: { role: OrgRole; label: string }[] = [
  { role: "owner", label: "Owner — manages members" },
  { role: "guide", label: "Guide" },
  { role: "member", label: "Member (tester)" },
];
/** Cloud-save cap, enforced by /api/pureland/save. */
export const SAVE_MAX_BYTES = 1024 * 1024;

/**
 * Where scripts/deploy-eris.sh (BuddhasEngines8) puts releases: <dir>/releases/<id>/ and a
 * `current` symlink. Inside the repo's gitignored var/ so the app container (which bind-mounts the
 * repo at /app) sees it with no compose change.
 */
export const PURELAND_RELEASES =
  process.env.PURELAND_RELEASES_DIR || path.resolve(process.cwd(), "../../var/pureland");

export interface PurelandViewer {
  userId: string;
  email: string;
  role: OrgRole | null;
  canPlay: boolean;
  canManage: boolean;
}

/** The signed-in person and what they may do here, or null when signed out. */
export async function getPurelandViewer(): Promise<PurelandViewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = await getOrgRole(user.id, PURELAND_ORG).catch(() => null);
  return {
    userId: user.id,
    email: user.email,
    role,
    canPlay: role !== null && PLAY_ROLES.includes(role),
    canManage: role !== null && MANAGE_ROLES.includes(role),
  };
}

export interface SaveSummary {
  enabled: boolean;
  bytes: number;
  savedAt: string | null;
}

export async function getSaveSummary(userId: string): Promise<SaveSummary> {
  const [row] = await db<{ enabled: boolean; bytes: number; client_saved_at: Date | null; updated_at: Date }[]>`
    SELECT enabled, bytes, client_saved_at, updated_at FROM game_saves
    WHERE user_id = ${userId} AND game = ${PURELAND_GAME}
  `.catch(() => []);
  if (!row) return { enabled: false, bytes: 0, savedAt: null };
  const at = row.bytes > 0 ? (row.client_saved_at ?? row.updated_at) : null;
  return { enabled: row.enabled, bytes: row.bytes, savedAt: at ? at.toISOString() : null };
}

export interface ReleaseInfo {
  id: string;
  dir: string;
  summary: string | null;
}

/** The release `current` points at, or null before the first deploy. */
export async function currentRelease(): Promise<ReleaseInfo | null> {
  try {
    const dir = await realpath(path.join(PURELAND_RELEASES, "current"));
    if (!(await stat(dir)).isDirectory()) return null;
    const summary = await readFile(path.join(dir, "RELEASE.txt"), "utf8").catch(() => null);
    return { id: path.basename(dir), dir, summary };
  } catch {
    return null;
  }
}
