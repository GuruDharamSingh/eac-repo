/**
 * Data deletion requests (migration 216). Written 2026-10-29 for Meta's
 * "user data deletion" requirement on elkdonis-arts.org, and for the site's
 * own /data/delete form.
 *
 * A request is a row with a confirmation code. The person (or Meta) checks
 * progress at /data/delete?code=<code>. Fulfilment is manual: an owner or
 * admin removes the account and marks the row completed. Nothing here deletes
 * data by itself.
 *
 * Statuses: 'received' | 'completed' | 'nothing_to_delete' | 'declined'.
 */

import { randomBytes } from 'node:crypto';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

export type DeletionRequestStatus = 'received' | 'completed' | 'nothing_to_delete' | 'declined';
export type DeletionRequestSource = 'site' | 'meta' | 'threads' | 'instagram';

export interface DeletionRequest {
  id: string;
  orgId: string | null;
  source: DeletionRequestSource;
  email: string | null;
  externalUserId: string | null;
  message: string | null;
  confirmationCode: string;
  status: DeletionRequestStatus;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface Row {
  id: string;
  org_id: string | null;
  source: DeletionRequestSource;
  email: string | null;
  external_user_id: string | null;
  message: string | null;
  confirmation_code: string;
  status: DeletionRequestStatus;
  notes: string | null;
  created_at: Date;
  completed_at: Date | null;
}

function toView(r: Row): DeletionRequest {
  return {
    id: r.id,
    orgId: r.org_id,
    source: r.source,
    email: r.email,
    externalUserId: r.external_user_id,
    message: r.message,
    confirmationCode: r.confirmation_code,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

/** Short, unambiguous, URL-safe: 12 uppercase base32-ish characters. */
function confirmationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function createDeletionRequest(input: {
  orgId: string | null;
  source: DeletionRequestSource;
  email?: string | null;
  externalUserId?: string | null;
  message?: string | null;
}): Promise<DeletionRequest> {
  const email = input.email?.trim().toLowerCase() || null;
  const rows = await db<Row[]>`
    INSERT INTO data_deletion_requests
      (id, org_id, source, email, external_user_id, message, confirmation_code)
    VALUES
      (${nanoid()}, ${input.orgId}, ${input.source}, ${email},
       ${input.externalUserId ?? null}, ${input.message?.trim() || null}, ${confirmationCode()})
    RETURNING *
  `;
  return toView(rows[0]);
}

export async function getDeletionRequestByCode(code: string): Promise<DeletionRequest | null> {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{12}$/.test(clean)) return null;
  const rows = await db<Row[]>`
    SELECT * FROM data_deletion_requests WHERE confirmation_code = ${clean} LIMIT 1
  `;
  return rows[0] ? toView(rows[0]) : null;
}

export async function listDeletionRequests(
  orgId: string | null,
  opts: { status?: DeletionRequestStatus; limit?: number } = {},
): Promise<DeletionRequest[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = opts.status
    ? await db<Row[]>`
        SELECT * FROM data_deletion_requests
        WHERE org_id IS NOT DISTINCT FROM ${orgId} AND status = ${opts.status}
        ORDER BY created_at DESC LIMIT ${limit}`
    : await db<Row[]>`
        SELECT * FROM data_deletion_requests
        WHERE org_id IS NOT DISTINCT FROM ${orgId}
        ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(toView);
}

/** Records the outcome. Callers check that the actor is an org owner or admin. */
export async function resolveDeletionRequest(
  id: string,
  status: Exclude<DeletionRequestStatus, 'received'>,
  notes?: string | null,
): Promise<DeletionRequest | null> {
  const rows = await db<Row[]>`
    UPDATE data_deletion_requests
    SET status = ${status}, notes = ${notes ?? null}, completed_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? toView(rows[0]) : null;
}

/**
 * The /api/data/delete handler: a web-standard Request in, JSON out. Accepts
 * JSON or form bodies with `email` and optional `message`. `notify` runs after
 * the row is written, so a mail failure never loses the request.
 */
export function createDeletionRequestHandler(opts: {
  orgId: string | null;
  notify?: (req: DeletionRequest) => Promise<void>;
}) {
  return async function POST(req: Request): Promise<Response> {
    let email = '';
    let message = '';
    try {
      const type = req.headers.get('content-type') ?? '';
      if (type.includes('application/json')) {
        const body = (await req.json()) as { email?: string; message?: string };
        email = String(body.email ?? '');
        message = String(body.message ?? '');
      } else {
        const form = await req.formData();
        email = String(form.get('email') ?? '');
        message = String(form.get('message') ?? '');
      }
    } catch {
      /* fall through to validation */
    }
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (message.length > 4000) message = message.slice(0, 4000);

    const request = await createDeletionRequest({ orgId: opts.orgId, source: 'site', email, message });
    if (opts.notify) {
      void opts.notify(request).catch((err) => console.error('[data-deletion] notify:', err));
    }
    return Response.json({ ok: true, confirmationCode: request.confirmationCode });
  };
}

/**
 * Meta's callback: delete what the platform holds for an app-scoped Facebook
 * user id. Today that is any user_connections row for a Meta provider whose
 * account_id is that id or whose oauth_state recorded it (the Studio
 * connection flow must store the id in one of those places). Returns the
 * number of rows removed; the caller records 'completed' or 'nothing_to_delete'.
 */
export async function deleteMetaConnections(externalUserId: string): Promise<number> {
  const rows = await db<{ id: string }[]>`
    DELETE FROM user_connections
    WHERE provider IN ('meta', 'facebook', 'instagram', 'threads')
      AND (account_id = ${externalUserId} OR oauth_state->>'user_id' = ${externalUserId})
    RETURNING id
  `;
  return rows.length;
}

/** The whole callback step: record, delete, resolve. Returns the request to answer Meta with. */
export async function fulfilMetaDeletion(input: { orgId: string | null; externalUserId: string; source?: 'meta' | 'threads' | 'instagram' }): Promise<DeletionRequest> {
  const request = await createDeletionRequest({ orgId: input.orgId, source: input.source ?? 'meta', externalUserId: input.externalUserId });
  try {
    const removed = await deleteMetaConnections(input.externalUserId);
    const resolved = await resolveDeletionRequest(
      request.id,
      removed > 0 ? 'completed' : 'nothing_to_delete',
      removed > 0 ? `Removed ${removed} connection(s) on callback.` : 'No stored connection for this Facebook user id.',
    );
    return resolved ?? request;
  } catch (err) {
    console.error('[data-deletion] meta callback:', err);
    return request; // stays 'received' for an organiser to look at
  }
}
