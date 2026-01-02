/**
 * Nextcloud integration services
 * These are server-side functions that interact with the Nextcloud API
 */

import { Buffer } from 'node:buffer';

declare const process: any;

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
// Public URL for browser-accessible share links (different from internal Docker URL)
const NEXTCLOUD_PUBLIC_URL = process.env.NEXTCLOUD_PUBLIC_URL || 'http://localhost:8080';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'admin';

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
    `EAC-Network/${orgId}`,
    // Public folders (default - shareable via public link)
    `EAC-Network/${orgId}/Media`,
    `EAC-Network/${orgId}/Media/Images`,
    `EAC-Network/${orgId}/Media/Audio`,
    `EAC-Network/${orgId}/Media/Videos`,
    `EAC-Network/${orgId}/Media/Documents`,
    // Private folders (for organization-only or invite-only content)
    `EAC-Network/${orgId}/Private`,
    `EAC-Network/${orgId}/Private/Media`,
    `EAC-Network/${orgId}/Private/Media/Images`,
    `EAC-Network/${orgId}/Private/Media/Audio`,
    `EAC-Network/${orgId}/Private/Media/Videos`,
    `EAC-Network/${orgId}/Private/Media/Documents`,
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
    const orgFolderPath = `EAC-Network/${orgId}`;
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
export function getUploadPath(
  orgId: string,
  mediaType: 'Images' | 'Audio' | 'Videos' | 'Documents',
  filename: string,
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY' = 'PUBLIC'
): string {
  // Use Private folder only for restricted content
  const folder = visibility === 'PUBLIC' ? 'Media' : 'Private/Media';
  return `EAC-Network/${orgId}/${folder}/${mediaType}/${filename}`;
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
      body: file,
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
 * Create a Talk room
 */
export async function createTalkRoom(
  name: string,
  type: 'group' | 'public' = 'group'
): Promise<string | null> {
  try {
    const response = await fetch(`${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/v4/room`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomType: type === 'public' ? 3 : 2,
        roomName: name,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      return data?.ocs?.data?.token || null;
    }
    return null;
  } catch (error) {
    console.error('Error creating Talk room:', error);
    return null;
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
): Promise<{ fileId: string; url: string; editUrl: string; shareToken: string } | null> {
  try {
    const timestamp = Date.now();
    const filename = `${timestamp}-${meetingId}.md`;
    const path = `EAC-Network/${orgId}/Media/Documents/${filename}`;
    
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
