import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

// ============================================================================
// Questionnaires — the wizards and workbooks people fill in, and the review
// queue Elkdonis works through.
//
// Two subjects, distinguished by `scope`:
//   user  the person, network-wide (Elkdonis-hub workbooks: goals, needs,
//         pathways). org_id is NULL.
//   org   the person acting for one collective (collective-hub business and
//         governance wizards). The same person can answer differently for two
//         collectives, so org_id is part of the identity of a response.
//
// Answers are JSONB and validated by the wizard's own Zod schemas, not here —
// see apps/arts-collective/src/lib/schema.ts. This module owns the lifecycle
// (draft → submitted → reviewed/returned), not the shape of the answers.
// ============================================================================

export type QuestionnaireScope = 'user' | 'org';
export type ResponseStatus = 'draft' | 'submitted' | 'reviewed' | 'returned';

export interface Questionnaire {
  key: string;
  title: string;
  description: string | null;
  version: number;
  scope: QuestionnaireScope;
  sortOrder: number;
  isActive: boolean;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireKey: string;
  userId: string;
  orgId: string | null;
  answers: Record<string, unknown>;
  status: ResponseStatus;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  updatedAt: string;
}

/** A row in the admin review queue, with enough context to judge it. */
export interface PendingReview extends QuestionnaireResponse {
  questionnaireTitle: string;
  userEmail: string;
  userDisplayName: string;
  orgName: string | null;
}

function mapResponse(r: Record<string, any>): QuestionnaireResponse {
  return {
    id: r.id,
    questionnaireKey: r.questionnaire_key,
    userId: r.user_id,
    orgId: r.org_id,
    answers: (r.answers ?? {}) as Record<string, unknown>,
    status: r.status,
    submittedAt: r.submitted_at,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewNote: r.review_note,
    updatedAt: r.updated_at,
  };
}

export async function listQuestionnaires(
  opts: { scope?: QuestionnaireScope; activeOnly?: boolean } = {}
): Promise<Questionnaire[]> {
  const activeOnly = opts.activeOnly ?? true;
  try {
    const rows = await db<Array<Record<string, any>>>`
      SELECT * FROM questionnaires
      WHERE TRUE
        ${opts.scope ? db`AND scope = ${opts.scope}` : db``}
        ${activeOnly ? db`AND is_active` : db``}
      ORDER BY sort_order, title
    `;
    return rows.map((q) => ({
      key: q.key,
      title: q.title,
      description: q.description,
      version: q.version,
      scope: q.scope,
      sortOrder: q.sort_order,
      isActive: q.is_active,
    }));
  } catch (err) {
    console.error('[questionnaires] listQuestionnaires:', err);
    return [];
  }
}

/**
 * Every response this person has, newest first — what the hub shows them so
 * their own answers are readable back. Includes reviewed history, which is the
 * point: what you said last year is worth seeing next to what you say now.
 */
export async function listResponsesForUser(
  userId: string
): Promise<Array<QuestionnaireResponse & { questionnaireTitle: string; orgName: string | null }>> {
  try {
    const rows = await db<Array<Record<string, any>>>`
      SELECT r.*, q.title AS questionnaire_title, o.name AS org_name
      FROM questionnaire_responses r
      JOIN questionnaires q ON q.key = r.questionnaire_key
      LEFT JOIN organizations o ON o.id = r.org_id
      WHERE r.user_id = ${userId}
      ORDER BY r.updated_at DESC
    `;
    return rows.map((r) => ({
      ...mapResponse(r),
      questionnaireTitle: r.questionnaire_title,
      orgName: r.org_name,
    }));
  } catch (err) {
    console.error(`[questionnaires] listResponsesForUser(${userId}):`, err);
    return [];
  }
}

/** The open (draft or submitted) response, if any. */
export async function getOpenResponse(
  questionnaireKey: string,
  userId: string,
  orgId: string | null = null
): Promise<QuestionnaireResponse | null> {
  try {
    const [row] = await db<Array<Record<string, any>>>`
      SELECT * FROM questionnaire_responses
      WHERE questionnaire_key = ${questionnaireKey}
        AND user_id = ${userId}
        AND org_id IS NOT DISTINCT FROM ${orgId}
        AND status IN ('draft', 'submitted')
      LIMIT 1
    `;
    return row ? mapResponse(row) : null;
  } catch (err) {
    console.error(`[questionnaires] getOpenResponse(${questionnaireKey}):`, err);
    return null;
  }
}

/**
 * Merge answers into the open response, creating a draft if none exists.
 *
 * Merges rather than replaces so a wizard can save one step at a time without
 * the later steps clobbering the earlier ones — the failure the arts-collective
 * wizard already has, where each step's values live in its own form until
 * validation passes.
 */
export async function saveResponseAnswers(
  questionnaireKey: string,
  userId: string,
  orgId: string | null,
  answers: Record<string, unknown>
): Promise<QuestionnaireResponse | null> {
  try {
    const existing = await getOpenResponse(questionnaireKey, userId, orgId);
    if (existing) {
      const [row] = await db<Array<Record<string, any>>>`
        UPDATE questionnaire_responses
        SET answers = answers || ${db.json(answers as any)},
            updated_at = NOW()
        WHERE id = ${existing.id}
        RETURNING *
      `;
      return row ? mapResponse(row) : null;
    }
    const [row] = await db<Array<Record<string, any>>>`
      INSERT INTO questionnaire_responses (id, questionnaire_key, user_id, org_id, answers)
      VALUES (${nanoid()}, ${questionnaireKey}, ${userId}, ${orgId}, ${db.json(answers as any)})
      RETURNING *
    `;
    return row ? mapResponse(row) : null;
  } catch (err) {
    console.error(`[questionnaires] saveResponseAnswers(${questionnaireKey}):`, err);
    return null;
  }
}

/** Hand a draft to Elkdonis. No-op if it is already submitted. */
export async function submitResponse(
  questionnaireKey: string,
  userId: string,
  orgId: string | null = null
): Promise<boolean> {
  try {
    const rows = await db`
      UPDATE questionnaire_responses
      SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
      WHERE questionnaire_key = ${questionnaireKey}
        AND user_id = ${userId}
        AND org_id IS NOT DISTINCT FROM ${orgId}
        AND status = 'draft'
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error(`[questionnaires] submitResponse(${questionnaireKey}):`, err);
    return false;
  }
}

/** Everything waiting on an Elkdonis admin, oldest submission first. */
export async function listPendingReviews(limit = 100): Promise<PendingReview[]> {
  try {
    const rows = await db<Array<Record<string, any>>>`
      SELECT r.*, q.title AS questionnaire_title,
             u.email AS user_email, u.display_name AS user_display_name,
             o.name AS org_name
      FROM questionnaire_responses r
      JOIN questionnaires q ON q.key = r.questionnaire_key
      JOIN users u ON u.id = r.user_id
      LEFT JOIN organizations o ON o.id = r.org_id
      WHERE r.status = 'submitted'
      ORDER BY r.submitted_at NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...mapResponse(r),
      questionnaireTitle: r.questionnaire_title,
      userEmail: r.user_email,
      userDisplayName: r.user_display_name,
      orgName: r.org_name,
    }));
  } catch (err) {
    console.error('[questionnaires] listPendingReviews:', err);
    return [];
  }
}

/**
 * Record an Elkdonis review.
 *
 * There is no promotion arm any more. `users.network_tier` and
 * `questionnaires.gates_tier` were removed (migration 104): the tier was
 * written here and displayed in the vetting queue and read by nothing — no
 * route, feed, media check or store check ever consulted it — and in the
 * network's whole history it never moved a single row off `member`. Standing
 * that gates nothing is not standing; per-org role (`user_organizations.role`)
 * is what actually governs what a person may do.
 */
export async function reviewResponse(
  responseId: string,
  reviewerId: string,
  outcome: 'reviewed' | 'returned',
  opts: { note?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [row] = await db<Array<Record<string, any>>>`
      UPDATE questionnaire_responses
      SET status = ${outcome},
          reviewed_by = ${reviewerId},
          reviewed_at = NOW(),
          review_note = ${opts.note ?? null},
          updated_at = NOW()
      WHERE id = ${responseId} AND status = 'submitted'
      RETURNING user_id
    `;
    if (!row) return { ok: false, error: 'Not found, or already reviewed' };
    return { ok: true };
  } catch (err) {
    console.error(`[questionnaires] reviewResponse(${responseId}):`, err);
    return { ok: false, error: 'Review failed' };
  }
}

// ============================================================================
// Org-authored questionnaires (migration 089)
//
// The Elkdonis wizards above define their questions in code. These define them
// in `fields`, so an org admin can write one in the hub and pose it to their
// group. Same responses table, same lifecycle — only the author and the
// audience differ.
// ============================================================================

export type FieldType =
  | 'text'
  | 'longtext'
  | 'choice'
  | 'multichoice'
  | 'image'
  | 'number'
  | 'boolean';

export interface QuestionnaireField {
  key: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  /** choice / multichoice only. */
  options?: string[];
}

/**
 * `respondents` is what makes a poll a poll — answering shows you the tally.
 * `public` is a poll published on an org's own subdomain, where the results
 * are the content (migration 103).
 */
export type ResultsVisibility = 'admins' | 'members' | 'respondents' | 'public';
export type QuestionnaireStatus = 'draft' | 'open' | 'closed';

/**
 * Only presentation differs: a `poll` renders its single question as a ballot
 * with a result bar, a `questionnaire` renders one form, a `wizard` paginates
 * the same fields into steps. Storage is identical — that is the point of
 * collapsing them (migration 103).
 */
export type QuestionnaireKind = 'questionnaire' | 'poll' | 'wizard';

export interface OrgQuestionnaire extends Questionnaire {
  orgId: string | null;
  createdBy: string | null;
  fields: QuestionnaireField[];
  resultsVisibility: ResultsVisibility;
  status: QuestionnaireStatus;
  kind: QuestionnaireKind;
  /**
   * When set, this questionnaire IS a piece of content: it inherits the
   * thread's publishing, feed placement, org scoping and subdomain rendering
   * rather than re-implementing each. NULL for hub workbooks, which should
   * never appear in a feed.
   */
  threadId: string | null;
  closesAt: string | null;
  responseCount: number;
}

function mapOrgQuestionnaire(q: Record<string, any>): OrgQuestionnaire {
  return {
    key: q.key,
    title: q.title,
    description: q.description,
    version: q.version,
    scope: q.scope,
    sortOrder: q.sort_order,
    isActive: q.is_active,
    orgId: q.org_id,
    createdBy: q.created_by,
    fields: Array.isArray(q.fields) ? (q.fields as QuestionnaireField[]) : [],
    resultsVisibility: q.results_visibility,
    status: q.status,
    kind: q.kind ?? 'questionnaire',
    threadId: q.thread_id ?? null,
    closesAt: q.closes_at,
    responseCount: Number(q.response_count ?? 0),
  };
}

/** Owners and guides author and administer an org's questionnaires. */
export async function canManageQuestionnaires(
  userId: string,
  orgId: string
): Promise<boolean> {
  const { hasOrgRole } = await import('./org-membership');
  return hasOrgRole(userId, orgId, ['owner', 'guide']);
}

export async function listOrgQuestionnaires(
  orgId: string,
  opts: { includeDrafts?: boolean } = {}
): Promise<OrgQuestionnaire[]> {
  try {
    const rows = await db<Array<Record<string, any>>>`
      SELECT q.*,
             (SELECT count(*) FROM questionnaire_responses r
               WHERE r.questionnaire_key = q.key
                 AND r.status <> 'draft') AS response_count
      FROM questionnaires q
      WHERE q.org_id = ${orgId}
        ${opts.includeDrafts ? db`` : db`AND q.status <> 'draft'`}
      ORDER BY q.sort_order, q.created_at DESC
    `;
    return rows.map(mapOrgQuestionnaire);
  } catch (err) {
    console.error(`[questionnaires] listOrgQuestionnaires(${orgId}):`, err);
    return [];
  }
}

export async function getQuestionnaire(key: string): Promise<OrgQuestionnaire | null> {
  try {
    const [row] = await db<Array<Record<string, any>>>`
      SELECT q.*,
             (SELECT count(*) FROM questionnaire_responses r
               WHERE r.questionnaire_key = q.key AND r.status <> 'draft') AS response_count
      FROM questionnaires q WHERE q.key = ${key} LIMIT 1
    `;
    return row ? mapOrgQuestionnaire(row) : null;
  } catch (err) {
    console.error(`[questionnaires] getQuestionnaire(${key}):`, err);
    return null;
  }
}

/** Namespaced so an org's keys cannot collide with another org's or with the
 *  platform wizards. Suffixes on collision rather than failing the create. */
async function allocateKey(orgId: string, title: string): Promise<string> {
  const { slugify } = await import('@elkdonis/utils');
  const base = `${orgId}:${slugify(title) || 'questionnaire'}`;
  let candidate = base;
  for (let n = 2; n < 200; n += 1) {
    const [taken] = await db`SELECT key FROM questionnaires WHERE key = ${candidate} LIMIT 1`;
    if (!taken) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export interface CreateOrgQuestionnaireInput {
  title: string;
  description?: string;
  fields: QuestionnaireField[];
  resultsVisibility?: ResultsVisibility;
  status?: QuestionnaireStatus;
  closesAt?: string | null;
  /** Presentation only — storage is identical. See migration 103. */
  kind?: QuestionnaireKind;
  /** Set to publish this as content on the org's site rather than a hub form. */
  threadId?: string | null;
}

export async function createOrgQuestionnaire(
  orgId: string,
  createdBy: string,
  input: CreateOrgQuestionnaireInput
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  if (!input.title?.trim()) return { ok: false, error: 'A title is required' };
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    return { ok: false, error: 'Add at least one question' };
  }
  for (const f of input.fields) {
    if (!f.key || !f.label) return { ok: false, error: 'Every question needs a label' };
    if ((f.type === 'choice' || f.type === 'multichoice') && !f.options?.length) {
      return { ok: false, error: `"${f.label}" needs at least one option` };
    }
  }

  try {
    const key = await allocateKey(orgId, input.title);
    await db`
      INSERT INTO questionnaires
        (key, title, description, scope, org_id, created_by, fields,
         results_visibility, status, closes_at, kind, thread_id)
      VALUES
        (${key}, ${input.title.trim()}, ${input.description ?? null}, 'org',
         ${orgId}, ${createdBy}, ${db.json(input.fields as any)},
         ${input.resultsVisibility ?? 'admins'}, ${input.status ?? 'open'},
         ${input.closesAt ?? null}, ${input.kind ?? 'questionnaire'},
         ${input.threadId ?? null})
    `;
    return { ok: true, key };
  } catch (err) {
    console.error(`[questionnaires] createOrgQuestionnaire(${orgId}):`, err);
    return { ok: false, error: 'Could not create questionnaire' };
  }
}

export async function setQuestionnaireStatus(
  key: string,
  status: QuestionnaireStatus
): Promise<boolean> {
  try {
    const rows = await db`
      UPDATE questionnaires SET status = ${status}
      WHERE key = ${key} AND org_id IS NOT NULL
      RETURNING key
    `;
    return rows.length > 0;
  } catch (err) {
    console.error(`[questionnaires] setQuestionnaireStatus(${key}):`, err);
    return false;
  }
}

/** One question's answers, shaped for display. */
export interface FieldResult {
  field: QuestionnaireField;
  /** choice/multichoice/boolean: option → count, ordered as declared. */
  tally?: Array<{ label: string; count: number }>;
  /** text/longtext/image/number: individual answers, newest first. */
  entries?: Array<{ userId: string; displayName: string; value: string }>;
  /** How many responses answered this field at all. */
  answered: number;
}

export interface QuestionnaireResults {
  questionnaire: OrgQuestionnaire;
  respondents: number;
  results: FieldResult[];
}

export type ResultsOutcome =
  | { ok: true; results: QuestionnaireResults }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'platform' };

/**
 * Aggregated answers for an org questionnaire.
 *
 * Visibility is enforced here rather than in the page, so a second caller
 * cannot forget it. 'admins' means owner/guide; 'members' means any role in
 * the org. There is no public case — anonymous callers never reach a result.
 *
 * Individual text and image answers are attributed. In a collective's hub,
 * knowing who submitted which image is usually the point; if a questionnaire
 * ever needs to be anonymous that should be a field on the questionnaire, not
 * a silent default here.
 *
 * Platform-level questionnaires (org_id NULL) are refused: those are the
 * Elkdonis vetting workbooks, and they are read one submission at a time
 * through the review queue, not aggregated.
 */
export async function getQuestionnaireResults(
  key: string,
  viewerId: string
): Promise<ResultsOutcome> {
  const questionnaire = await getQuestionnaire(key);
  if (!questionnaire) return { ok: false, reason: 'not_found' };
  if (!questionnaire.orgId) return { ok: false, reason: 'platform' };

  const { hasOrgRole } = await import('./org-membership');
  const allowed =
    questionnaire.resultsVisibility === 'admins'
      ? await hasOrgRole(viewerId, questionnaire.orgId, ['owner', 'guide'])
      : await hasOrgRole(viewerId, questionnaire.orgId, [
          'owner',
          'guide',
          'member',
        ]);
  if (!allowed) return { ok: false, reason: 'forbidden' };

  try {
    const rows = await db<Array<{ user_id: string; display_name: string; answers: Record<string, unknown> }>>`
      SELECT r.user_id, u.display_name, r.answers
      FROM questionnaire_responses r
      JOIN users u ON u.id = r.user_id
      WHERE r.questionnaire_key = ${key} AND r.status <> 'draft'
      ORDER BY r.submitted_at DESC NULLS LAST
    `;

    const results: FieldResult[] = questionnaire.fields.map((field) => {
      const answers = rows
        .map((r) => ({ row: r, value: r.answers?.[field.key] }))
        .filter(({ value }) => value !== undefined && value !== null && value !== '');

      if (field.type === 'choice' || field.type === 'multichoice') {
        const counts = new Map<string, number>(
          (field.options ?? []).map((o) => [o, 0])
        );
        for (const { value } of answers) {
          const picked = Array.isArray(value) ? value : [value];
          for (const p of picked) {
            const label = String(p);
            counts.set(label, (counts.get(label) ?? 0) + 1);
          }
        }
        return {
          field,
          tally: [...counts.entries()].map(([label, count]) => ({ label, count })),
          answered: answers.length,
        };
      }

      if (field.type === 'boolean') {
        const yes = answers.filter(({ value }) => value === true).length;
        return {
          field,
          tally: [
            { label: 'Yes', count: yes },
            { label: 'No', count: answers.length - yes },
          ],
          answered: answers.length,
        };
      }

      return {
        field,
        entries: answers.map(({ row, value }) => ({
          userId: row.user_id,
          displayName: row.display_name,
          value: String(value),
        })),
        answered: answers.length,
      };
    });

    return {
      ok: true,
      results: { questionnaire, respondents: rows.length, results },
    };
  } catch (err) {
    console.error(`[questionnaires] getQuestionnaireResults(${key}):`, err);
    return { ok: false, reason: 'not_found' };
  }
}
