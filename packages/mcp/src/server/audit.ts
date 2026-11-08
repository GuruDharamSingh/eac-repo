/**
 * One audit row per tool call (2026-11-08; PLAN.md §2.6), in the registry's own
 * table: `action_events` with action_id `mcp:<tool>`, via 'mcp', actor_type 'ai'
 * (the registry's rule for every door but app/script), the settled org, the
 * arguments, the outcome and the duration. What the tool returned is not stored.
 * `agent_id` (the grant) is the parked migration's new column; until it is
 * applied the row is written without it, as run.ts does for subject_id.
 * Best effort: a failed insert is logged and the result stands.
 */
import { db } from '@elkdonis/db';

export interface AuditRow {
  tool: string;
  userId: string;
  /** mcp_grants.id */
  agentId: string;
  orgId: string | null;
  input: unknown;
  ok: boolean;
  /** Our refusal code: auth, input, forbidden, limit, failed, unknown. */
  code: string | null;
  error: string | null;
  ms: number;
}

export interface AuditSink {
  record(row: AuditRow): Promise<void>;
}

const INPUT_MAX = 4000;
const RETRY_MS = 10 * 60 * 1000;

export function dbAudit(): AuditSink {
  let missingAt = 0;
  let agentColumnMissing = false;
  async function insert(row: AuditRow): Promise<void> {
    if (missingAt && Date.now() - missingAt < RETRY_MS) return;
    let kept: unknown = row.input ?? null;
    try {
      if (kept !== null && JSON.stringify(kept).length > INPUT_MAX) kept = { omitted: `larger than ${INPUT_MAX} characters` };
    } catch {
      kept = { omitted: 'not JSON' };
    }
    const agent = agentColumnMissing ? null : row.agentId.slice(0, 64);
    try {
      await db`
        INSERT INTO action_events (action_id, actor_id, actor_type, org_id, via, input, ok, error, code, result, duration_ms${agent ? db`, agent_id` : db``})
        VALUES (
          ${('mcp:' + row.tool).slice(0, 60)}, ${row.userId}, 'ai', ${row.orgId}, 'mcp',
          ${kept === null ? null : db.json(kept as never)}, ${row.ok}, ${row.error}, ${row.code ? row.code.slice(0, 12) : null},
          null, ${row.ms}${agent ? db`, ${agent}` : db``}
        )
      `;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '42703' && agent) {
        agentColumnMissing = true;
        console.warn('[mcp] action_events.agent_id is missing (MCP migration not applied); writing rows without it.');
        return insert(row);
      }
      if (code === '42P01') {
        if (!missingAt) console.warn('[mcp] action_events is missing; tool calls are not being recorded.');
        missingAt = Date.now();
        return;
      }
      console.error('[mcp] audit row:', row.tool, err);
    }
  }
  return { record: insert };
}

/** Rows kept in memory, for tests. */
export function memoryAudit(): AuditSink & { rows: AuditRow[] } {
  const rows: AuditRow[] = [];
  return { rows, async record(row) { rows.push(row); } };
}
