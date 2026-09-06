import { type NextcloudClient } from './client';
import { createFolder, exists } from './files';

export const DEFAULT_ORG_ROOT_FOLDER = 'EAC_Network';

export type EnsureOrgFolderOptions = {
  rootFolder?: string;
  includeStandardMediaFolders?: boolean;
};

const STANDARD_ORG_SUBFOLDERS = [
  'Media',
  'Media/Images',
  'Media/Audio',
  'Media/Videos',
  'Media/Documents',
  'Private',
  'Private/Media',
  'Private/Media/Images',
  'Private/Media/Audio',
  'Private/Media/Videos',
  'Private/Media/Documents',
];

function cleanPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

export function getOrgRootFolder(): string {
  return cleanPath(process.env.NEXTCLOUD_ORG_ROOT_FOLDER || DEFAULT_ORG_ROOT_FOLDER);
}

export function getOrgFolderPath(
  orgId: string,
  rootFolder: string = getOrgRootFolder()
): string {
  return cleanPath(`${rootFolder}/${orgId}`);
}

async function ensureFolder(client: NextcloudClient, path: string): Promise<void> {
  if (!(await exists(client, path))) {
    await createFolder(client, path);
  }
}

async function ensureFolderTree(client: NextcloudClient, path: string): Promise<void> {
  const parts = cleanPath(path).split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    await ensureFolder(client, currentPath);
  }
}

export async function ensureOrgFolderPath(
  client: NextcloudClient,
  orgFolderPath: string,
  options: Pick<EnsureOrgFolderOptions, 'includeStandardMediaFolders'> = {}
): Promise<string> {
  const cleanOrgFolderPath = cleanPath(orgFolderPath);
  if (!cleanOrgFolderPath) {
    throw new Error('orgFolderPath is required');
  }

  await ensureFolderTree(client, cleanOrgFolderPath);

  if (options.includeStandardMediaFolders ?? true) {
    for (const subfolder of STANDARD_ORG_SUBFOLDERS) {
      await ensureFolderTree(client, `${cleanOrgFolderPath}/${subfolder}`);
    }
  }

  return cleanOrgFolderPath;
}

export async function ensureOrgFolder(
  client: NextcloudClient,
  orgId: string,
  options: EnsureOrgFolderOptions = {}
): Promise<string> {
  const rootFolder = cleanPath(options.rootFolder || getOrgRootFolder());
  const orgFolder = getOrgFolderPath(orgId, rootFolder);

  return ensureOrgFolderPath(client, orgFolder, {
    includeStandardMediaFolders: options.includeStandardMediaFolders,
  });
}

/**
 * A folder for one member/profile's media within an org — e.g. IFAC's
 * per-artist galleries (Media/Images/<slug>), first consumer being the
 * migration off the artists shipping their images as committed files
 * under apps/ifac/public/. Nests under the org's own Media tree rather than
 * getting a top-level slot, so it inherits that org's existing share/backup
 * boundary instead of needing its own.
 */
export async function ensureMemberMediaFolder(
  client: NextcloudClient,
  orgId: string,
  memberSlug: string,
  options: Pick<EnsureOrgFolderOptions, 'rootFolder'> = {}
): Promise<string> {
  const orgFolder = await ensureOrgFolder(client, orgId, { rootFolder: options.rootFolder });
  const memberFolder = cleanPath(`${orgFolder}/Media/Images/${memberSlug}`);
  await ensureFolderTree(client, memberFolder);
  return memberFolder;
}

/**
 * A person's own media folder, org-agnostic — ArtDirect has no org_id to key
 * off of (a person's identity spans every org they belong to), so this
 * treats "artdirect" as a fixed pseudo-org root and reuses the same
 * org-folder tree-creation rather than inventing a second folder scheme.
 */
export async function ensurePersonMediaFolder(
  client: NextcloudClient,
  userSlug: string,
  options: Pick<EnsureOrgFolderOptions, 'rootFolder'> = {}
): Promise<string> {
  return ensureMemberMediaFolder(client, 'artdirect', userSlug, options);
}