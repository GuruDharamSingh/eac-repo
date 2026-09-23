/**
 * Nextcloud integration services
 * These are server-side functions that interact with the Nextcloud API
 */

import { Buffer } from 'node:buffer';
import { asBodyOrBlob } from './bytes';
import { slugify } from '@elkdonis/utils';
import { customAlphabet } from 'nanoid';

/** No vowels, no look-alikes (0/O, 1/l/I): a suffix nobody has to read aloud. */
const shortId = customAlphabet('23456789bcdfghjkmnpqrstvwxyz', 6);

declare const process: any;

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL;
if (!NEXTCLOUD_URL) {
  console.warn('[nextcloud] NEXTCLOUD_URL not set - Nextcloud features will be unavailable');
}
// Public URL for browser-accessible share links (different from internal Docker URL)
const NEXTCLOUD_PUBLIC_URL = process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || '';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || '';

const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString('base64');

/**
 * Create a Nextcloud user
 */
export async function createNextcloudUser(
  username: string,
  password: string,
  displayName: string,
  email: string
): Promise<boolean> {
  try {
    const response = await fetch(`${NEXTCLOUD_URL}/ocs/v1.php/cloud/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        userid: username,
        password: password,
        displayName: displayName,
        email: email,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error creating Nextcloud user:', error);
    return false;
  }
}

/**
 * Create a public share link for a folder or file
 * Returns the share token that can be used for unauthenticated access
 */
export async function createPublicShare(
  path: string,
  permissions: number = 1 // 1 = read-only
): Promise<string | null> {
  try {
    const response = await fetch(
      `${NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          path: `/${path}`,
          shareType: '3', // Public link
          permissions: permissions.toString(),
        }),
      }
    );

    if (response.ok) {
      const text = await response.text();
      // Parse XML response to get share token
      const tokenMatch = text.match(/<token>([^<]+)<\/token>/);
      const token = tokenMatch ? tokenMatch[1] : null;
      
      if (token) {
        console.log(`[Nextcloud] Created public share for ${path}: ${token}`);
      }
      
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('[Nextcloud] Error creating public share:', error);
    return null;
  }
}

/**
 * Create organization folder structure
 * Default: Public (shareable), Private for restricted content
 */
export async function createOrgFolders(orgId: string): Promise<boolean> {
  const folders = [
    `EAC_Network/${orgId}`,
    // Public folders (default - shareable via public link)
    `EAC_Network/${orgId}/Media`,
    `EAC_Network/${orgId}/Media/Images`,
    `EAC_Network/${orgId}/Media/Audio`,
    `EAC_Network/${orgId}/Media/Videos`,
    `EAC_Network/${orgId}/Media/Documents`,
    // Private folders (for organization-only or invite-only content)
    `EAC_Network/${orgId}/Private`,
    `EAC_Network/${orgId}/Private/Media`,
    `EAC_Network/${orgId}/Private/Media/Images`,
    `EAC_Network/${orgId}/Private/Media/Audio`,
    `EAC_Network/${orgId}/Private/Media/Videos`,
    `EAC_Network/${orgId}/Private/Media/Documents`,
  ];

  try {
    // Create all folders
    for (const folder of folders) {
      await fetch(`${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${folder}`, {
        method: 'MKCOL',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });
    }

    // Make the entire org folder publicly accessible by default
    const orgFolderPath = `EAC_Network/${orgId}`;
    const shareToken = await createPublicShare(orgFolderPath);

    // Save share token to database if successful
    if (shareToken) {
      await saveOrgShareToken(orgId, shareToken);
    }

    return true;
  } catch (error) {
    console.error('Error creating organization folders:', error);
    return false;
  }
}

/**
 * Save the public share token to the organization record
 */
async function saveOrgShareToken(orgId: string, shareToken: string): Promise<void> {
  const { db } = await import('@elkdonis/db');
  
  try {
    await db`
      UPDATE organizations
      SET nextcloud_public_share_token = ${shareToken}
      WHERE id = ${orgId}
    `;
    console.log(`[Nextcloud] Saved share token for org ${orgId}`);
  } catch (error) {
    console.error('[Nextcloud] Error saving share token:', error);
  }
}

/**
 * List files in a directory
 */
export async function listFiles(path: string): Promise<any[]> {
  try {
    const response = await fetch(
      `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${path}`,
      {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Depth': '1',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.status}`);
    }

    const text = await response.text();
    // Parse WebDAV XML response here
    // For simplicity, returning empty array - implement XML parsing as needed
    return [];
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

/**
 * Get the public WebDAV URL for a file
 * This requires authentication
 */
export function getFileUrl(path: string): string {
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${path}`;
}

/**
 * Get the public share URL for a file (no auth required)
 * Path should be relative to the shared folder
 */
export function getPublicFileUrl(
  shareToken: string,
  relativePath: string = ''
): string {
  const path = relativePath ? `/${relativePath}` : '';
  return `${NEXTCLOUD_URL}/s/${shareToken}/download${path}`;
}

/**
 * Get the proxy URL for a file (for Next.js API proxy route)
 * This works for self-hosted setups where the API handles auth
 */
export function getProxyFileUrl(path: string): string {
  return `/api/media/${path}`;
}

/**
 * Get the appropriate upload path based on visibility
 * Default: Public (Media folder), Private for restricted content
 */
/**
 * What an uploaded file should be CALLED.
 *
 * Twelve upload routes each wrote their own version of
 * `file.name.replace(/[^a-zA-Z0-9.-]/g, "_")`, usually behind a `Date.now()-`
 * prefix, which is how the network ended up serving paths like
 * `.../1726790000000-il_570xN.302087606.jpg.jpg`. That address is in a stored
 * page, in a gallery item and in an <img src> for as long as the picture
 * exists, so it is not a cosmetic detail: it is the only name a visitor, a
 * search engine or anyone reading the Nextcloud tree ever sees.
 *
 * Given the TITLE the person typed, the file is named after the work —
 * `nightjar-4k9wqp.jpg`. Without one it falls back to the original name,
 * slugified, which is still an improvement on underscores.
 *
 * ── What the suffix is for ─────────────────────────────────────────────────
 *
 * Uniqueness, and nothing else. Two pieces may honestly share a title, and a
 * WebDAV PUT to an existing path OVERWRITES it — so a name derived purely
 * from the title would let one upload silently replace another person's
 * picture. The old `Date.now()` prefix was doing this job; a short random
 * suffix does it without putting a 13-digit number at the front of every URL.
 *
 * ── What it refuses ────────────────────────────────────────────────────────
 *
 * The title reaches here from a form, and the result becomes a path segment.
 * `slugify` already strips everything but word characters and dashes, so no
 * separator, dot-segment or control character survives; the extension is
 * taken from the original name and whitelisted rather than trusted, because
 * that is the half an attacker controls most easily.
 */
export function uploadFilename(originalName: string, title?: string | null): string {
  const dot = originalName.lastIndexOf('.');
  const rawExt = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : '';
  // A conservative shape, not a list of allowed formats — the content type is
  // decided by validateUploadBuffer reading the actual bytes, never by this.
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : 'bin';

  // Underscores and dots become spaces first, so slugify turns them into
  // word breaks. `slugify` counts `_` as a word character and drops `.`
  // outright, which on its own would render `il_570xN.302087606.jpg` as the
  // unreadable `il_570xn302087606jpg`.
  const words = (v: string) => slugify(v.replace(/[._]+/g, ' '));
  const fromTitle = title ? words(title) : '';
  const fromName = words(dot > 0 ? originalName.slice(0, dot) : originalName);
  // Trailing dashes are what slugify leaves behind when a title ends in
  // punctuation ("Untitled (1976)." -> "untitled-1976-").
  const base = (fromTitle || fromName || 'file').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';

  return `${base}-${shortId()}.${ext}`;
}

export function getUploadPath(
  orgId: string,
  mediaType: 'Images' | 'Audio' | 'Videos' | 'Documents',
  filename: string,
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY' = 'PUBLIC'
): string {
  // Use Private folder only for restricted content
  const folder = visibility === 'PUBLIC' ? 'Media' : 'Private/Media';
  return `EAC_Network/${orgId}/${folder}/${mediaType}/${filename}`;
}

/**
 * Upload a file to Nextcloud
 */
export async function uploadFile(
  path: string,
  file: Buffer | Blob,
  contentType = 'application/octet-stream'
): Promise<boolean> {
  try {
    const url = getFileUrl(path);
    console.log(`[Nextcloud] Uploading to: ${url}`);
    console.log(`[Nextcloud] User: ${NEXTCLOUD_USER}, URL: ${NEXTCLOUD_URL}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': contentType,
      },
      body: asBodyOrBlob(file),
    });

    console.log(`[Nextcloud] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Nextcloud] Upload failed: ${text}`);
    }

    return response.ok;
  } catch (error) {
    console.error('[Nextcloud] Error uploading file:', error);
    return false;
  }
}

/**
 * Create a Talk room.
 *
 * Rooms are created BY THE SERVICE ACCOUNT, which becomes their owner. Left
 * there, that is a trap for whoever asked for the room: the person who made
 * the meeting is not a member of its room at all. They can only reach it by
 * the public link, which makes them a transient `self-joined` visitor — so
 * they cannot add participants, and Talk drops the room from their own
 * conversation list the moment they leave. Found 2026-09-21 on a real meeting:
 * its author was self-joined in their own room and could only share the link.
 *
 * Pass `moderator` (a Nextcloud user id) to make that person a real member
 * and a moderator, and `listable` to put it in "Open conversations":
 *   0 = hidden (Talk's default), 1 = Nextcloud users, 2 = everyone incl. guests
 *
 * Both are BEST-EFFORT and never cost the caller the room. By the time they
 * run the room exists; failing to promote someone must not orphan it by
 * returning null, which is the exact failure `format=json` below exists to
 * prevent.
 */
export async function createTalkRoom(
  name: string,
  type: 'group' | 'public' = 'public',
  opts: { moderator?: string | null; listable?: 0 | 1 | 2 } = {}
): Promise<string | null> {
  try {
    // `format=json` is load-bearing: OCS answers in XML by default, so without
    // it response.json() throws, the catch below swallows it, and this returns
    // null as though Nextcloud had refused. The room is actually created — it
    // just gets orphaned, silently. (The shares call below avoids this by
    // reading the response as text.)
    const response = await fetch(`${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/v4/room?format=json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        roomType: type === 'public' ? 3 : 2,
        roomName: name,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      const token: string | null = data?.ocs?.data?.token || null;
      if (token) await configureTalkRoom(token, opts);
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error creating Talk room:', error);
    return null;
  }
}

/**
 * Make `moderator` a real member and moderator of a room, and set how
 * discoverable it is. Exported so an EXISTING room can be repaired too — the
 * rooms made before this existed all have their author as a mere visitor.
 * Never throws.
 */
export async function configureTalkRoom(
  token: string,
  opts: { moderator?: string | null; listable?: 0 | 1 | 2 } = {}
): Promise<void> {
  const base = `${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/v4/room/${encodeURIComponent(token)}`;
  const headers = {
    Authorization: `Basic ${auth}`,
    'OCS-APIRequest': 'true',
    Accept: 'application/json',
  };
  const form = (body: Record<string, string>) => ({
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  if (opts.moderator) {
    try {
      // Invite first. Someone who joined by the public link is
      // participantType 5 (self-joined), which is not promotable and is
      // exactly the state this exists to lift them out of.
      await fetch(`${base}/participants?format=json`, {
        method: 'POST',
        ...form({ newParticipant: opts.moderator, source: 'users' }),
      });
      const list = await fetch(`${base}/participants?format=json`, { headers });
      const parts = ((await list.json()) as any)?.ocs?.data ?? [];
      const me = parts.find(
        (p: any) => p.actorType === 'users' && p.actorId === opts.moderator
      );
      // 1 owner, 2 moderator — already able to manage the room.
      if (me && me.participantType !== 1 && me.participantType !== 2) {
        await fetch(`${base}/moderators?format=json`, {
          method: 'POST',
          ...form({ attendeeId: String(me.attendeeId) }),
        });
      }
    } catch (err) {
      console.error(`[talk] could not make ${opts.moderator} a moderator of ${token}:`, err);
    }
  }

  if (opts.listable !== undefined) {
    try {
      await fetch(`${base}/listable?format=json`, {
        method: 'PUT',
        ...form({ scope: String(opts.listable) }),
      });
    } catch (err) {
      console.error(`[talk] could not set listable on ${token}:`, err);
    }
  }
}

/**
 * Create a collaborative document for a meeting
 * Creates a markdown file in the organization's Documents folder with public edit link
 */
export async function createCollaborativeDocument(
  orgId: string,
  meetingTitle: string,
  meetingId: string,
  initialContent?: string
): Promise<{
  fileId: string;
  /** Storage path, so a caller can read the body back later. */
  path: string;
  url: string;
  editUrl: string;
  shareToken: string;
} | null> {
  try {
    const timestamp = Date.now();
    const filename = `${timestamp}-${meetingId}.md`;
    const path = `EAC_Network/${orgId}/Media/Documents/${filename}`;
    
    // Create initial document content
    const content = initialContent || `# ${meetingTitle}

## Meeting Notes

*This is a collaborative document for the meeting. Anyone with the link can edit.*

### Agenda
- 

### Discussion Points
- 

### Action Items
- 

### Resources
- 
`;

    // Upload the document
    const buffer = Buffer.from(content, 'utf-8');
    const success = await uploadFile(path, buffer, 'text/markdown');
    
    if (!success) {
      console.error('[Nextcloud] Failed to create document');
      return null;
    }

    console.log(`[Nextcloud] Created collaborative document: ${path}`);

    // Get the file ID from Nextcloud
    const fileId = await getFileId(path);
    
    if (!fileId) {
      console.error('[Nextcloud] Could not retrieve file ID');
      return null;
    }

    // Create a public share with EDIT permissions (permissions=15 means read+write+create+delete)
    const shareToken = await createPublicShare(path, 15);
    
    if (!shareToken) {
      console.error('[Nextcloud] Could not create public share');
      return null;
    }

    // Generate URLs for viewing and editing (use public URL for browser access)
    const viewUrl = `${NEXTCLOUD_PUBLIC_URL}/s/${shareToken}`;
    const editUrl = `${NEXTCLOUD_PUBLIC_URL}/s/${shareToken}`;

    console.log(`[Nextcloud] Document URLs - View: ${viewUrl}, Edit: ${editUrl}`);

    return {
      fileId,
      path,
      url: viewUrl,
      editUrl,
      shareToken,
    };
  } catch (error) {
    console.error('[Nextcloud] Error creating collaborative document:', error);
    return null;
  }
}

/**
 * Get the file ID for a given path
 * Uses WebDAV PROPFIND to get file metadata
 */
async function getFileId(path: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${path}`,
      {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Depth': '0',
          'Content-Type': 'application/xml',
        },
        body: `<?xml version="1.0"?>
          <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
              <oc:fileid />
            </d:prop>
          </d:propfind>`,
      }
    );

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    // Parse XML response to get file ID
    const fileIdMatch = text.match(/<oc:fileid>([^<]+)<\/oc:fileid>/);
    return fileIdMatch ? fileIdMatch[1] : null;
  } catch (error) {
    console.error('[Nextcloud] Error getting file ID:', error);
    return null;
  }
}

/**
 * Get the iframe embed URL for a collaborative document
 * Uses public share token for anonymous collaborative editing
 */
export function getDocumentEmbedUrl(shareToken: string): string {
  // This URL allows embedding the document with Text app for collaborative editing
  return `${NEXTCLOUD_URL}/s/${shareToken}`;
}

/**
 * Get the direct text editor URL for a document
 * This opens the Nextcloud Text app for the shared document
 */
export function getDocumentEditorUrl(shareToken: string): string {
  return `${NEXTCLOUD_URL}/apps/text/s/${shareToken}`;
}

/**
 * Send a message to a Talk room
 */
export async function sendTalkMessage(
  token: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/v1/chat/${token}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error sending Talk message:', error);
    return false;
  }
}
