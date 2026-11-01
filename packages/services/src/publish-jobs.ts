/**
 * The publish ledger (migration 222, 2026-11-01): one row per attempt to
 * post something to an outside platform. Written best effort around the
 * inline send, so a missing table (migration not yet applied) never stops
 * a post; the row is the audit trail and, later, the queue.
 */

import { db } from '@elkdonis/db';

export interface PublishJobStart {
  requestedBy: string;
  orgId: string | null;
  sourceKind: 'thread' | 'social_post';
  sourceId: string;
  provider: 'meta' | 'instagram' | 'threads';
  targetId: string;
  targetLabel: string;
}

export async function startPublishJob(input: PublishJobStart): Promise<number | null> {
  try {
    const rows = await db<{ id: number }[]>`
      INSERT INTO publish_jobs (requested_by, org_id, source_kind, source_id, provider, target_id, target_label, status, attempts, started_at)
      VALUES (${input.requestedBy}, ${input.orgId}, ${input.sourceKind}, ${input.sourceId}, ${input.provider}, ${input.targetId}, ${input.targetLabel}, 'running', 1, now())
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    console.warn('[publish] job not recorded:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function finishPublishJob(
  id: number | null,
  result: { ok: true; externalId: string | null; url: string | null } | { ok: false; error: string }
): Promise<void> {
  if (id === null) return;
  try {
    // `in`, not `result.ok`: this codebase's unions do not narrow on the flag (profiles.ts SaveResult note).
    if ('error' in result) {
      await db`UPDATE publish_jobs SET status = 'failed', error = ${result.error.slice(0, 2000)}, finished_at = now() WHERE id = ${id}`;
    } else {
      await db`UPDATE publish_jobs SET status = 'done', external_id = ${result.externalId}, external_url = ${result.url}, finished_at = now() WHERE id = ${id}`;
    }
  } catch (err) {
    console.warn('[publish] job not finished:', err instanceof Error ? err.message : String(err));
  }
}

export interface PublishJobView {
  id: number;
  orgId: string | null;
  sourceKind: string;
  sourceId: string;
  provider: string;
  targetLabel: string;
  status: string;
  externalUrl: string | null;
  error: string | null;
  createdAt: string;
}

/** The person's own outbound activity, newest first. */
export async function listPublishJobs(userId: string, limit = 50): Promise<PublishJobView[]> {
  try {
    const rows = await db<Array<{ id: number; org_id: string | null; source_kind: string; source_id: string; provider: string; target_label: string; status: string; external_url: string | null; error: string | null; created_at: Date }>>`
      SELECT id, org_id, source_kind, source_id, provider, target_label, status, external_url, error, created_at
      FROM publish_jobs WHERE requested_by = ${userId} ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map((r) => ({ id: r.id, orgId: r.org_id, sourceKind: r.source_kind, sourceId: r.source_id, provider: r.provider, targetLabel: r.target_label, status: r.status, externalUrl: r.external_url, error: r.error, createdAt: r.created_at.toISOString() }));
  } catch {
    return [];
  }
}
