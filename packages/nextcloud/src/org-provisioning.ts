/**
 * Org provisioning on Nextcloud — service-account model.
 *
 * Every org's files live under the SERVICE account
 * (NEXTCLOUD_ADMIN_USER, e.g. `eac_intergration`) at `EAC_Network/{orgId}/`.
 * Owners and guides never own org files; they receive shares:
 *
 *   owner → read/write share of the org folder
 *   guide → read-only share of the org folder
 *
 * Ownership transfer is revoke + grant — no file migration. The org folder
 * appears in the recipient's own WebDAV tree at the share's `file_target`
 * (usually `/{orgId}`), which `resolveReceivedOrgPath` discovers; the Silex
 * editor then works on `{target}/silex/project`.
 *
 * NOTE: a writable share of the org folder also covers `silex/published/`.
 * The public site never trusts published HTML — it is sanitized at render
 * (silex-render → sanitizeSilexHtml) — so owner-writable published is an
 * accepted risk. Tightening options later: Nextcloud File Access Control on
 * the published path, or routing connector publishes through the app API.
 */

import { type NextcloudClient } from './client';
import { ensureOrgFolderPath, getOrgFolderPath } from './org-folders';
import { addParticipant, createTalkRoom } from './talk';
import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  SHARE_TYPE_USER,
  findReceivedSharePath,
  getSharesForPath,
  shareFolderWithUser,
  unshareFolderWithUser,
  type NextcloudShare,
} from './shares';

export type OrgNextcloudRole = 'owner' | 'guide';

export interface OrgProvisionResult {
  /** Org folder path relative to the service account's files root. */
  orgFolderPath: string;
  /** Silex editable-project path (service-account relative). */
  silexProjectPath: string;
  /** Silex publication path (service-account relative). */
  silexPublishedPath: string;
}

/**
 * Ensure the org's folder tree exists under the service account, including
 * the Silex project/published subfolders the editor connector expects
 * (lowercase `silex/...` — see /api/silex/auth path derivation).
 * Idempotent.
 */
export async function provisionOrgOnNextcloud(
  serviceClient: NextcloudClient,
  orgId: string
): Promise<OrgProvisionResult> {
  const orgFolderPath = await ensureOrgFolderPath(
    serviceClient,
    getOrgFolderPath(orgId)
  );

  const silexProjectPath = `${orgFolderPath}/silex/project`;
  const silexPublishedPath = `${orgFolderPath}/silex/published`;
  await ensureOrgFolderPath(serviceClient, `${silexProjectPath}/assets`, {
    includeStandardMediaFolders: false,
  });
  await ensureOrgFolderPath(serviceClient, `${silexPublishedPath}/css`, {
    includeStandardMediaFolders: false,
  });

  return { orgFolderPath, silexProjectPath, silexPublishedPath };
}

/**
 * Grant a user access to an org's folder: write for owners, read for guides.
 * Idempotent (re-granting adjusts permissions in place).
 */
export async function grantOrgAccess(
  serviceClient: NextcloudClient,
  orgId: string,
  ncUserId: string,
  role: OrgNextcloudRole
): Promise<NextcloudShare> {
  const orgFolderPath = getOrgFolderPath(orgId);
  const permissions = role === 'owner' ? PERMISSIONS_WRITE : PERMISSIONS_READ;
  return shareFolderWithUser(serviceClient, orgFolderPath, ncUserId, permissions);
}

/** Remove a user's access to an org's folder (ownership transfer, role loss). */
export async function revokeOrgAccess(
  serviceClient: NextcloudClient,
  orgId: string,
  ncUserId: string
): Promise<number> {
  return unshareFolderWithUser(serviceClient, getOrgFolderPath(orgId), ncUserId);
}

/**
 * Where does the shared org folder appear in the recipient's WebDAV tree?
 * Returns a path relative to the recipient's files root (e.g. "/my-org"),
 * or null when no share exists for that user.
 */
export async function resolveReceivedOrgPath(
  serviceClient: NextcloudClient,
  recipientClient: NextcloudClient,
  orgId: string,
  ncUserId: string
): Promise<string | null> {
  const shares = await getSharesForPath(serviceClient, getOrgFolderPath(orgId));
  const share = shares.find(
    (s) => s.share_type === SHARE_TYPE_USER && s.share_with === ncUserId
  );
  if (!share) return null;

  const target = await findReceivedSharePath(recipientClient, share.id);
  // file_target is authoritative; fall back to the conventional default.
  return target ?? `/${orgId}`;
}

// ── tiers & quotas ───────────────────────────────────────────────────────────

export type OrgTier = 'free' | 'standard' | 'patron';

/**
 * Nextcloud quota string per org tier, applied to the OWNER's user account
 * (org files live under the service account, so the practical lever is the
 * owner's personal quota for drafts/uploads; service-side usage is tracked
 * per-folder operationally).
 */
export const TIER_QUOTAS: Record<OrgTier, string> = {
  free: '1 GB',
  standard: '10 GB',
  patron: '50 GB',
};

/** Set a Nextcloud user's storage quota (e.g. "1 GB", "10 GB", "none"). */
export async function setUserQuota(
  serviceClient: NextcloudClient,
  ncUserId: string,
  quota: string
): Promise<void> {
  const form = new URLSearchParams();
  form.set('key', 'quota');
  form.set('value', quota);
  await serviceClient.ocs.put(
    `/cloud/users/${encodeURIComponent(ncUserId)}`,
    form.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
}

export async function applyTierQuota(
  serviceClient: NextcloudClient,
  ncUserId: string,
  tier: OrgTier
): Promise<void> {
  await setUserQuota(serviceClient, ncUserId, TIER_QUOTAS[tier]);
}

// ── persistent org Talk room ─────────────────────────────────────────────────

/**
 * Create the org's persistent Talk room (group room owned by the service
 * account) and invite the initial members. Returns the room token — store it
 * on organizations.talk_room_token. Per-event rooms continue to be created
 * per thread (threads.nextcloud_talk_token).
 */
export async function createOrgTalkRoom(
  serviceClient: NextcloudClient,
  orgName: string,
  inviteNcUserIds: string[] = []
): Promise<string> {
  const room = await createTalkRoom(serviceClient, {
    name: orgName,
    type: 'group',
  });
  for (const ncUserId of inviteNcUserIds) {
    try {
      await addParticipant(serviceClient, room.token, ncUserId);
    } catch (err) {
      console.warn(`could not invite ${ncUserId} to org Talk room:`, err);
    }
  }
  return room.token;
}
