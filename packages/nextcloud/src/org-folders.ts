import { type NextcloudClient } from './client';
import { createFolder, exists } from './files';

export const DEFAULT_ORG_ROOT_FOLDER = 'EAC-Network';

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