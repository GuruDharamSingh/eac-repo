import { db, Events } from '@elkdonis/db';
import {
  createThread,
  getOrgFeed,
  getViewerRoles,
  isOrgMember,
  textToHtml,
  uploadOrgFile,
} from '@elkdonis/services';
import { sanitizeRichText } from '@elkdonis/utils';
import type {
  AgentErrorCode,
  AgentIdentity,
  AgentMedia,
  AgentPostMedia,
  AgentPostRequest,
  AgentPostResult,
} from './types';

/** Per-request ceiling. A mail attachment larger than this is a different feature. */
export const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
export const MAX_MEDIA_COUNT = 4;
export const MAX_TITLE_CHARS = 200;
export const MAX_BODY_CHARS = 100_000;

const ALLOWED_MEDIA = /^(image\/(jpeg|png|gif|webp|avif)|application\/pdf)$/;

/** Where an agent's uploads land, so they are separable from member uploads. */
const AGENT_MEDIA_FOLDER = 'Agent';

function fail(code: AgentErrorCode, error: string): AgentPostResult {
  return { ok: false, code, error };
}

/**
 * Create a DRAFT thread on behalf of a verified human.
 *
 * Three properties this function exists to guarantee, none of which should be
 * re-decided by a caller:
 *
 *   1. It cannot publish. `status` is hardcoded to 'draft' and is not a
 *      parameter. A compromised agent produces unreviewed drafts, never a live
 *      page — which is the whole reason this surface is acceptable at all.
 *   2. Authorization is the same `user_organizations` lookup the web UI does,
 *      via getViewerRoles + isOrgMember. The bridge grants nothing; it can only
 *      spend authority the requesting human already had.
 *   3. Authorship is the human, not a service account. `author_id` is their
 *      users.id, so the draft appears in their own drafts and revoking their
 *      role revokes this path with it.
 *
 * `identity` must already be verified by the mounting app. This function
 * trusts it completely and checks nothing about how it was established.
 */
export async function postForAgent(
  identity: AgentIdentity,
  request: AgentPostRequest
): Promise<AgentPostResult> {
  const title = (request.title || '').trim();
  const body = (request.body || '').trim();
  const orgId = (request.orgId || '').trim();

  if (!orgId) return fail('invalid_request', 'orgId is required');
  if (!title) return fail('invalid_request', 'title is required');
  if (title.length > MAX_TITLE_CHARS) {
    return fail('invalid_request', `title exceeds ${MAX_TITLE_CHARS} characters`);
  }
  if (body.length > MAX_BODY_CHARS) {
    return fail('invalid_request', `body exceeds ${MAX_BODY_CHARS} characters`);
  }
  if ((request.media?.length ?? 0) > MAX_MEDIA_COUNT) {
    return fail('media_rejected', `at most ${MAX_MEDIA_COUNT} attachments per request`);
  }

  // Replay before anything else: a redelivered mail must not re-upload media.
  if (request.idempotencyKey) {
    const existing = await findReplay(identity, request.idempotencyKey);
    if (existing) return existing;
  }

  const [org] = await db<Array<{ id: string }>>`
    SELECT id FROM organizations WHERE id = ${orgId}
  `;
  if (!org) return fail('unknown_org', `no organization '${orgId}'`);

  const roles = await getViewerRoles(identity.userId);
  // Deliberately NOT passing isGlobalAdmin. A global admin acting through the
  // agent should still be acting as a member of the org they name; the admin
  // bypass is a UI affordance for the admin app, not a courier's privilege.
  const viewer = { userId: identity.userId, roles };
  if (roles[orgId] === undefined) {
    return fail('not_a_member', `${identity.email} holds no role in '${orgId}'`);
  }
  if (!isOrgMember(viewer, orgId)) {
    return fail(
      'insufficient_role',
      `${identity.email} is '${roles[orgId]}' in '${orgId}'; member or above may author`
    );
  }

  // A section is an org_feeds row, and naming one the org does not have would
  // otherwise silently produce a thread nothing renders.
  let section: string | null = null;
  if (request.section) {
    const feed = await getOrgFeed(orgId, request.section);
    if (!feed) return fail('unknown_section', `'${orgId}' has no section '${request.section}'`);
    section = feed.slug;
  }

  // An agent may send either. Plain text is the common case from mail; HTML is
  // sanitized on the way in regardless, because the model that composed it is
  // downstream of untrusted input by construction.
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(body);
  const html = looksLikeHtml ? sanitizeRichText(body) : textToHtml(body);

  let thread;
  try {
    thread = await createThread({
      kind: 'post',
      orgId,
      authorId: identity.userId,
      title,
      body: html,
      // Left undefined so createThread derives it — the agent's summary is a
      // suggestion, not a requirement.
      excerpt: request.summary?.trim() || undefined,
      status: 'draft',
      visibility: 'PUBLIC',
      section,
      metadata: {
        agent: {
          clientId: identity.clientId,
          channel: request.source?.channel ?? null,
          reference: request.source?.reference ?? null,
          verification: request.source?.verification ?? null,
          idempotencyKey: request.idempotencyKey ?? null,
          receivedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[openclaw-bridge] createThread failed:', error);
    return fail('internal_error', 'could not create the draft');
  }

  const media = await attachMedia(orgId, identity, thread.id, request.media ?? []);

  await Events.log(orgId, identity.userId, 'post_created', 'post', thread.id, {
    source: 'openclaw',
    clientId: identity.clientId,
    channel: request.source?.channel ?? null,
    reference: request.source?.reference ?? null,
    idempotencyKey: request.idempotencyKey ?? null,
    mediaCount: media.length,
  });

  return {
    ok: true,
    threadId: thread.id,
    slug: thread.slug,
    status: 'draft',
    orgId,
    media,
    replayed: false,
  };
}

/**
 * Upload and attach, best-effort.
 *
 * A failed attachment must not lose the draft — the text is the thing the
 * human asked for, and a missing image is visible to them in review, whereas a
 * 500 loses the mail entirely.
 */
async function attachMedia(
  orgId: string,
  identity: AgentIdentity,
  threadId: string,
  items: AgentMedia[]
): Promise<AgentPostMedia[]> {
  const attached: AgentPostMedia[] = [];

  for (const item of items) {
    if (!ALLOWED_MEDIA.test(item.mimeType || '')) {
      console.warn('[openclaw-bridge] rejected media type:', item.mimeType);
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(item.content, 'base64');
    } catch {
      console.warn('[openclaw-bridge] undecodable media:', item.filename);
      continue;
    }
    if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) {
      console.warn('[openclaw-bridge] media out of range:', item.filename, bytes.byteLength);
      continue;
    }

    const uploaded = await uploadOrgFile(
      orgId,
      AGENT_MEDIA_FOLDER,
      item.filename || 'attachment',
      new Uint8Array(bytes),
      item.mimeType,
      identity.userId
    );
    if (!uploaded) continue;

    // uploadOrgFile writes the media row unattached; bind it to the draft.
    try {
      const [row] = await db<Array<{ id: string }>>`
        UPDATE media
           SET attached_to_type = 'post',
               attached_to_id   = ${threadId},
               caption          = ${item.caption ?? null},
               alt_text         = ${item.altText ?? null}
         WHERE org_id = ${orgId} AND nextcloud_path = ${uploaded.path}
        RETURNING id
      `;
      if (row) {
        attached.push({ id: row.id, url: uploaded.url, filename: uploaded.name });
        await Events.log(orgId, identity.userId, 'media_attached', 'media', row.id, {
          source: 'openclaw',
          threadId,
        });
      }
    } catch (error) {
      console.error('[openclaw-bridge] media attach failed:', error);
    }
  }

  return attached;
}

/**
 * Has this exact request already been served?
 *
 * Keyed on the requesting user as well as the key, so two people's agents
 * cannot collide on a generic key like a date.
 */
async function findReplay(
  identity: AgentIdentity,
  key: string
): Promise<AgentPostResult | null> {
  try {
    const [row] = await db<Array<{ id: string; slug: string; org_id: string }>>`
      SELECT id, slug, org_id
        FROM threads
       WHERE author_id = ${identity.userId}
         AND metadata -> 'agent' ->> 'idempotencyKey' = ${key}
       ORDER BY created_at DESC
       LIMIT 1
    `;
    if (!row) return null;

    const mediaRows = await db<Array<{ id: string; url: string; filename: string }>>`
      SELECT id, url, filename FROM media
       WHERE attached_to_type = 'post' AND attached_to_id = ${row.id}
    `;

    return {
      ok: true,
      threadId: row.id,
      slug: row.slug,
      status: 'draft',
      orgId: row.org_id,
      media: mediaRows.map((m) => ({ id: m.id, url: m.url, filename: m.filename })),
      replayed: true,
    };
  } catch (error) {
    // An idempotency lookup failure must not block the write; a duplicate
    // draft is a smaller harm than a dropped one.
    console.error('[openclaw-bridge] replay lookup failed:', error);
    return null;
  }
}
