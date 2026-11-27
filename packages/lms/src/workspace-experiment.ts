// ============================================================================
// THE EXPERIMENT PRESET (migrations 288 consents, 289 results; design: workspace-threads.md section 5).
//
// An experiment is a workspace with these switches: people take part only after agreeing to a consent text (versioned, stored with
// the seat, viewable later, withdrawable); the ongoing session is the test log; the circle is invite only; and at the end the guides
// compile RESULTS from SHARED entries. A result is a write-up (introduction, entries, conclusion). An entry goes in only when its
// WRITER agrees to that one entry being published (and chooses to be named or anonymous). Nothing exists as a thread, and nothing is
// visible anywhere, until the guide publishes; publishing creates the thread through the existing createThread (done by the host app,
// which owns services) and records its id here. Taking it down archives that thread. A declined or withdrawn entry NEVER reaches a result.
// Everything fails soft: until 288 / 289 exist, a workspace is just a workspace.
// ============================================================================
import { db } from '@elkdonis/db';
import { sanitizeRichText } from '@elkdonis/utils';
import type { LmsViewer, ResponseVisibility, WriteResult } from './types';
import { getWorkspaceView, participationOk } from './workspaces';
import { workspaceActor } from './workspace-edit';
import { newId } from './util';

export type Preset = 'workshop' | 'experiment';

export const DEFAULT_CONSENT = [
  'This is an experiment, and you are taking part because you want to.',
  'What you will do: take part in the sessions and write down what you notice each time, as asked.',
  'What we keep: what you write here is kept by the guides of this experiment. By default only the group and the guides read it; nobody outside does.',
  'Publishing: results may be written up and published at the end. Nothing of yours is included unless you agree to that one entry, and you choose whether your name is shown.',
  'You can stop at any time. If you withdraw, you can no longer add entries, and what you wrote is taken out of any results that are not yet published.',
].join('\n\n');

let cache: { at: number; consents: boolean; results: boolean } | null = null;
async function availability(): Promise<{ consents: boolean; results: boolean }> {
  if (cache && Date.now() - cache.at < 20_000) return cache;
  let consents = false, results = false;
  try {
    const [r] = await db<Array<{ c: boolean; r: boolean }>>`
      SELECT (to_regclass('public.workspace_consent_texts') IS NOT NULL AND to_regclass('public.workspace_consents') IS NOT NULL
              AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_settings' AND column_name = 'preset')) AS c,
             (to_regclass('public.workspace_results') IS NOT NULL AND to_regclass('public.workspace_result_items') IS NOT NULL) AS r
    `;
    consents = Boolean(r?.c); results = Boolean(r?.r);
  } catch { /* absent */ }
  cache = { at: Date.now(), consents, results };
  return cache;
}
/** Migration 288 exists. */
export const consentsAvailable = async () => (await availability()).consents;
/** Migrations 288 and 289 exist. */
export const resultsAvailable = async () => { const a = await availability(); return a.consents && a.results; };

export async function getWorkspacePreset(runId: string): Promise<Preset> {
  if (!(await consentsAvailable())) return 'workshop';
  const [r] = await db<Array<{ preset: Preset }>>`SELECT preset FROM workspace_settings WHERE host_type = 'lms_run' AND host_id = ${runId}`;
  return r?.preset === 'experiment' ? 'experiment' : 'workshop';
}

/** Make a run an experiment (or not): called when a workspace is made, by a guide. Writes the first consent text. */
export async function setWorkspacePreset(userId: string, runId: string, preset: Preset, consentText?: string): Promise<WriteResult> {
  if (!(await consentsAvailable())) return { ok: false, error: 'Experiments are not switched on yet.' };
  await db`
    INSERT INTO workspace_settings (host_type, host_id, preset, updated_by) VALUES ('lms_run', ${runId}, ${preset}, ${userId})
    ON CONFLICT (host_type, host_id) DO UPDATE SET preset = EXCLUDED.preset, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
  if (preset === 'experiment') {
    const [{ n }] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM workspace_consent_texts WHERE host_type = 'lms_run' AND host_id = ${runId}`;
    if (n === 0) await db`INSERT INTO workspace_consent_texts (host_type, host_id, version, body, created_by) VALUES ('lms_run', ${runId}, 1, ${(consentText ?? '').trim() || DEFAULT_CONSENT}, ${userId})`;
  }
  return { ok: true };
}

// ── consent ─────────────────────────────────────────────────────────────────
export interface ConsentState {
  preset: Preset;
  /** The newest wording, or null when this is not an experiment. */
  text: { version: number; body: string; createdAt: Date } | null;
  /** This person's agreement, if any. */
  mine: { version: number; givenAt: Date; withdrawnAt: Date | null } | null;
  /** The person must agree (again) before they can write or read others. */
  needs: boolean;
}

export async function getConsentState(runId: string, userId: string | null): Promise<ConsentState> {
  const preset = await getWorkspacePreset(runId);
  if (preset !== 'experiment') return { preset, text: null, mine: null, needs: false };
  const [t] = await db<Array<{ version: number; body: string; created_at: Date }>>`
    SELECT version, body, created_at FROM workspace_consent_texts WHERE host_type = 'lms_run' AND host_id = ${runId} ORDER BY version DESC LIMIT 1
  `;
  const [c] = userId ? await db<Array<{ text_version: number; given_at: Date; withdrawn_at: Date | null }>>`
    SELECT text_version, given_at, withdrawn_at FROM workspace_consents WHERE host_type = 'lms_run' AND host_id = ${runId} AND user_id = ${userId}
  ` : [];
  const text = t ? { version: t.version, body: t.body, createdAt: t.created_at } : null;
  const mine = c ? { version: c.text_version, givenAt: c.given_at, withdrawnAt: c.withdrawn_at } : null;
  return { preset, text, mine, needs: !(mine && !mine.withdrawnAt && text && mine.version === text.version) };
}

async function seatOf(runId: string, userId: string) {
  const [e] = await db<Array<{ id: string }>>`SELECT id FROM lms_enrolments WHERE run_id = ${runId} AND user_id = ${userId} AND status <> 'withdrawn'`;
  return e ?? null;
}

/** A seated person agrees to the current wording. */
export async function agreeToParticipation(viewer: LmsViewer, courseSlug: string): Promise<WriteResult> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!viewer.userId || !view?.run || !view.seated) return { ok: false, error: 'You are not in this group.' };
  const st = await getConsentState(view.run.id, viewer.userId);
  if (st.preset !== 'experiment' || !st.text) return { ok: false, error: 'This is not an experiment.' };
  await db`
    INSERT INTO workspace_consents (id, host_type, host_id, user_id, text_version) VALUES (${newId()}, 'lms_run', ${view.run.id}, ${viewer.userId}, ${st.text.version})
    ON CONFLICT (host_type, host_id, user_id) DO UPDATE SET text_version = EXCLUDED.text_version, given_at = NOW(), withdrawn_at = NULL
  `;
  return { ok: true };
}

/** A published post that must be re-rendered because a writer withdrew (the host app updates the thread from renderResultBody). */
export interface RerenderTarget { resultId: string; threadId: string; title: string }

/** A person withdraws: they can no longer add entries, and what they wrote is taken out of every draft AND every published result. */
export async function withdrawParticipation(viewer: LmsViewer, courseSlug: string): Promise<WriteResult & { pulled?: number; rerender?: RerenderTarget[] }> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!viewer.userId || !view?.run || !view.seated) return { ok: false, error: 'You are not in this group.' };
  const st = await getConsentState(view.run.id, viewer.userId);
  if (st.preset !== 'experiment' || !st.mine) return { ok: false, error: 'There is nothing to withdraw.' };
  await db`UPDATE workspace_consents SET withdrawn_at = NOW() WHERE host_type = 'lms_run' AND host_id = ${view.run.id} AND user_id = ${viewer.userId} AND withdrawn_at IS NULL`;
  let pulled = 0;
  const rerender: RerenderTarget[] = [];
  if ((await availability()).results) {
    const rows = await db<Array<{ id: string; rid: string; status: string; thread_id: string | null; title: string }>>`
      UPDATE workspace_result_items i SET state = 'withdrawn', decided_at = NOW()
      FROM workspace_results r, lms_responses e
      WHERE r.id = i.result_id AND r.status IN ('draft', 'published') AND r.host_type = 'lms_run' AND r.host_id = ${view.run.id}
        AND e.id = i.response_id AND e.user_id = ${viewer.userId} AND i.state IN ('requested', 'agreed') RETURNING i.id, r.id AS rid, r.status, r.thread_id, r.title
    `;
    pulled = rows.length;
    const seen = new Set<string>();
    for (const r of rows) if (r.status === 'published' && r.thread_id && !seen.has(r.rid)) { seen.add(r.rid); rerender.push({ resultId: r.rid, threadId: r.thread_id, title: r.title }); }
  }
  return { ok: true, pulled, rerender };
}

/** The guides write the consent text. A change makes a NEW version: everyone must agree to it before they write again. */
export async function saveConsentText(viewer: LmsViewer, courseSlug: string, body: string): Promise<WriteResult & { version?: number }> {
  const view = await getWorkspaceView(viewer, courseSlug);
  const actor = view ? workspaceActor(viewer, view) : null;
  if (!view?.run || !actor) return { ok: false, error: 'Only the guides of this workspace can do that.' };
  if ((await getWorkspacePreset(view.run.id)) !== 'experiment') return { ok: false, error: 'This is not an experiment.' };
  const text = body.trim();
  if (!text) return { ok: false, error: 'Write the wording people will agree to.' };
  if (text.length > 8000) return { ok: false, error: 'That is longer than the wording can be.' };
  const [{ v }] = await db<Array<{ v: number }>>`SELECT COALESCE(MAX(version), 0)::int AS v FROM workspace_consent_texts WHERE host_type = 'lms_run' AND host_id = ${view.run.id}`;
  const [cur] = await db<Array<{ body: string }>>`SELECT body FROM workspace_consent_texts WHERE host_type = 'lms_run' AND host_id = ${view.run.id} AND version = ${v}`;
  if (cur?.body === text) return { ok: true, version: v };
  await db`INSERT INTO workspace_consent_texts (host_type, host_id, version, body, created_by) VALUES ('lms_run', ${view.run.id}, ${v + 1}, ${text}, ${actor.userId})`;
  return { ok: true, version: v + 1 };
}

// ── results ─────────────────────────────────────────────────────────────────
export interface ResultItem {
  id: string; responseId: string; state: 'requested' | 'agreed' | 'declined' | 'withdrawn'; credit: 'named' | 'anonymous' | null;
  /** The entry's words: shown to the guides only for requested and agreed items; never for a declined or withdrawn one. */
  body: string | null; writer: string; at: Date;
}
export interface ResultView {
  id: string; title: string; intro: string; conclusion: string; status: 'draft' | 'published' | 'taken_down'; audience: 'everyone' | 'members';
  threadId: string | null; threadSlug: string | null; publishedAt: Date | null; items: ResultItem[];
}
export interface Candidate { responseId: string; writer: string; at: Date; body: string; intervalKey: string | null; itemState: ResultItem['state'] | null }

async function guideGate(viewer: LmsViewer, courseSlug: string) {
  const view = await getWorkspaceView(viewer, courseSlug);
  const actor = view ? workspaceActor(viewer, view) : null;
  // Results show peoples words, so the gate is the NAMED guides of this group only: an organisations owner or guide who is not named on
  // the group gets no reading power by role (the same rule as the journal).
  if (!view?.run || !actor || !view.runGuide) return null;
  if (!(await resultsAvailable())) return null;
  if ((await getWorkspacePreset(view.run.id)) !== 'experiment') return null;
  return { view, run: view.run, actor };
}

/** The guide's candidate list: SHARED entries only, by people who currently consent. Never a private entry, never a withdrawn person. */
export async function listResultCandidates(viewer: LmsViewer, courseSlug: string, resultId?: string): Promise<Candidate[] | null> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return null;
  const rows = await db<Array<{ id: string; name: string | null; created_at: Date; body: string; interval_key: string | null; item_state: ResultItem['state'] | null }>>`
    SELECT r.id, u.display_name AS name, r.created_at, r.body, ${(await intervalColumn()) ? db`r.interval_key` : db`NULL::text`} AS interval_key,
           ${resultId ? db`(SELECT i.state FROM workspace_result_items i WHERE i.result_id = ${resultId} AND i.response_id = r.id)` : db`NULL::text`} AS item_state
    FROM lms_responses r
    JOIN users u ON u.id = r.user_id
    JOIN lms_enrolments en ON en.id = r.enrolment_id AND en.status <> 'withdrawn'
    WHERE r.run_id = ${g.run.id} AND r.visibility = 'circle' AND r.kind <> 'note'
      AND EXISTS (SELECT 1 FROM workspace_consents c, workspace_consent_texts t
                  WHERE c.host_type = 'lms_run' AND c.host_id = r.run_id AND c.user_id = r.user_id AND c.withdrawn_at IS NULL
                    AND t.host_type = 'lms_run' AND t.host_id = r.run_id AND t.version = c.text_version)
      AND NOT EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = r.run_id AND s.user_id = r.user_id)
    ORDER BY r.created_at DESC LIMIT 300
  `;
  return rows.map((r) => ({ responseId: r.id, writer: r.name ?? 'Someone', at: r.created_at, body: r.body, intervalKey: r.interval_key, itemState: r.item_state }));
}
async function intervalColumn(): Promise<boolean> {
  const [r] = await db<Array<{ ok: boolean }>>`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lms_responses' AND column_name = 'interval_key') AS ok`;
  return Boolean(r?.ok);
}

async function loadResult(runId: string, resultId: string, forGuide: boolean): Promise<ResultView | null> {
  const [r] = await db<Array<{ id: string; title: string; intro: string; conclusion: string; status: ResultView['status']; audience: ResultView['audience']; thread_id: string | null; published_at: Date | null; slug: string | null }>>`
    SELECT r.id, r.title, r.intro, r.conclusion, r.status, r.audience, r.thread_id, r.published_at, (SELECT t.slug FROM threads t WHERE t.id = r.thread_id) AS slug
    FROM workspace_results r WHERE r.id = ${resultId} AND r.host_type = 'lms_run' AND r.host_id = ${runId}
  `;
  if (!r) return null;
  const items = await db<Array<{ id: string; response_id: string; state: ResultItem['state']; credit: 'named' | 'anonymous' | null; body: string; name: string | null; created_at: Date }>>`
    SELECT i.id, i.response_id, i.state, i.credit, e.body, u.display_name AS name, e.created_at
    FROM workspace_result_items i JOIN lms_responses e ON e.id = i.response_id JOIN users u ON u.id = e.user_id
    WHERE i.result_id = ${r.id} ORDER BY e.created_at
  `;
  return {
    id: r.id, title: r.title, intro: r.intro, conclusion: r.conclusion, status: r.status, audience: r.audience, threadId: r.thread_id, threadSlug: r.slug, publishedAt: r.published_at,
    items: items.map((i) => ({ id: i.id, responseId: i.response_id, state: i.state, credit: i.credit, writer: i.name ?? 'Someone', at: i.created_at,
      body: forGuide && (i.state === 'requested' || i.state === 'agreed') ? i.body : null })),
  };
}

/** The workspace's results (newest first), for its guides. */
export async function listResults(viewer: LmsViewer, courseSlug: string): Promise<ResultView[] | null> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return null;
  const ids = await db<Array<{ id: string }>>`SELECT id FROM workspace_results WHERE host_type = 'lms_run' AND host_id = ${g.run.id} ORDER BY created_at DESC LIMIT 20`;
  const out: ResultView[] = [];
  for (const i of ids) { const r = await loadResult(g.run.id, i.id, true); if (r) out.push(r); }
  return out;
}

/** Start or change a results draft (title, introduction, conclusion, who may read it once published). Only a draft can be changed. */
export async function saveResultDraft(viewer: LmsViewer, courseSlug: string, input: { id?: string; title?: string; intro?: string; conclusion?: string; audience?: 'everyone' | 'members' }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return { ok: false, error: 'Only the guides of an experiment can do that.' };
  const title = (input.title ?? '').trim().slice(0, 200), intro = (input.intro ?? '').slice(0, 20_000), conclusion = (input.conclusion ?? '').slice(0, 20_000);
  const audience = input.audience === 'everyone' ? 'everyone' : 'members';
  if (input.id) {
    const rows = await db`UPDATE workspace_results SET title = ${title}, intro = ${intro}, conclusion = ${conclusion}, audience = ${audience}, updated_at = NOW() WHERE id = ${input.id} AND host_type = 'lms_run' AND host_id = ${g.run.id} AND status = 'draft' RETURNING id`;
    return rows.length ? { ok: true, id: input.id } : { ok: false, error: 'Only a draft can be changed.' };
  }
  const id = newId();
  await db`INSERT INTO workspace_results (id, host_type, host_id, title, intro, conclusion, audience, created_by) VALUES (${id}, 'lms_run', ${g.run.id}, ${title}, ${intro}, ${conclusion}, ${audience}, ${g.actor.userId})`;
  return { ok: true, id };
}

/** Ask the writers: each chosen SHARED entry becomes a request the WRITER must agree to. Nothing is included without it. */
export async function requestPublication(viewer: LmsViewer, courseSlug: string, resultId: string, responseIds: string[]): Promise<WriteResult & { requested?: number }> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return { ok: false, error: 'Only the guides of an experiment can do that.' };
  const [res] = await db<Array<{ status: string }>>`SELECT status FROM workspace_results WHERE id = ${resultId} AND host_type = 'lms_run' AND host_id = ${g.run.id}`;
  if (!res || res.status !== 'draft') return { ok: false, error: 'Only a draft can ask for entries.' };
  const cands = await listResultCandidates(viewer, courseSlug, resultId);
  const okIds = new Set((cands ?? []).map((c) => c.responseId));
  let n = 0;
  for (const rid of responseIds.slice(0, 100)) {
    if (!okIds.has(rid)) continue; // not shared, or the writer does not currently consent
    const rows = await db`
      INSERT INTO workspace_result_items (id, result_id, response_id, requested_by) VALUES (${newId()}, ${resultId}, ${rid}, ${g.actor.userId})
      ON CONFLICT (result_id, response_id) DO UPDATE SET state = 'requested', credit = NULL, decided_at = NULL, requested_by = EXCLUDED.requested_by, requested_at = NOW()
        WHERE workspace_result_items.state IN ('withdrawn') RETURNING id
    `;
    n += rows.length;
  }
  return { ok: true, requested: n };
}

export interface MyRequest { itemId: string; resultTitle: string; body: string; state: ResultItem['state']; credit: 'named' | 'anonymous' | null; at: Date }

/** What the guides have asked THIS person about: their own entries only. */
export async function listMyPublicationRequests(viewer: LmsViewer, courseSlug: string): Promise<MyRequest[]> {
  if (!viewer.userId || !(await resultsAvailable())) return [];
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run || !view.seated) return [];
  const rows = await db<Array<{ id: string; title: string; body: string; state: ResultItem['state']; credit: 'named' | 'anonymous' | null; created_at: Date }>>`
    SELECT i.id, r.title, e.body, i.state, i.credit, e.created_at
    FROM workspace_result_items i JOIN workspace_results r ON r.id = i.result_id JOIN lms_responses e ON e.id = i.response_id
    WHERE r.host_type = 'lms_run' AND r.host_id = ${view.run.id} AND e.user_id = ${viewer.userId} AND r.status = 'draft'
    ORDER BY i.requested_at DESC LIMIT 50
  `;
  return rows.map((r) => ({ itemId: r.id, resultTitle: r.title, body: r.body, state: r.state, credit: r.credit, at: r.created_at }));
}

/** The WRITER decides about one entry: agree (and how to be shown) or decline. Nobody else can. */
export async function decidePublication(viewer: LmsViewer, courseSlug: string, itemId: string, decision: 'agree' | 'decline', credit?: 'named' | 'anonymous'): Promise<WriteResult> {
  if (!viewer.userId || !(await resultsAvailable())) return { ok: false, error: 'Not available.' };
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run || !view.seated) return { ok: false, error: 'You are not in this group.' };
  if (!(await participationOk(view.run.id, viewer.userId))) return { ok: false, error: 'Agree to take part first.' };
  const [it] = await db<Array<{ id: string; state: string; visibility: ResponseVisibility; user_id: string; status: string }>>`
    SELECT i.id, i.state, e.visibility, e.user_id, r.status FROM workspace_result_items i JOIN workspace_results r ON r.id = i.result_id JOIN lms_responses e ON e.id = i.response_id
    WHERE i.id = ${itemId} AND r.host_type = 'lms_run' AND r.host_id = ${view.run.id}
  `;
  if (!it || it.user_id !== viewer.userId) return { ok: false, error: 'That is not yours to decide.' };
  if (it.status !== 'draft') return { ok: false, error: 'This has already been published or closed.' };
  if (it.state === 'withdrawn') return { ok: false, error: 'This entry was taken out.' };
  if (decision === 'agree') {
    if (it.visibility !== 'circle') return { ok: false, error: 'Only an entry you have shared with the group can be published.' };
    await db`UPDATE workspace_result_items SET state = 'agreed', credit = ${credit === 'named' ? 'named' : 'anonymous'}, decided_at = NOW() WHERE id = ${itemId}`;
  } else {
    await db`UPDATE workspace_result_items SET state = 'declined', credit = NULL, decided_at = NOW() WHERE id = ${itemId}`;
  }
  return { ok: true };
}

export interface PreparedPublication { title: string; bodyHtml: string; orgId: string; authorId: string; audience: 'everyone' | 'members'; included: number; resultId: string }

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paras = (t: string) => t.trim().split(/\n{2,}/).filter(Boolean).map((b) => `<p>${b.split('\n').map(esc).join('<br>')}</p>`).join('\n');

/**
 * Re-check everything at the moment of publishing, then build the write-up. Only AGREED items whose entry is still shared and whose writer
 * still consents are included; the entry text is copied now, so a later edit does not change what was published. Refuses an empty result.
 * The host app creates the thread from this and then calls markResultPublished.
 */
/**
 * Build a result's write-up from what is VALID RIGHT NOW: only AGREED items whose entry is still shared and whose writer still consents.
 * The entry text is copied now, so a later edit does not change what was published. Used at publish and again after a withdrawal.
 */
export async function renderResultBody(runId: string, resultId: string): Promise<{ title: string; bodyHtml: string; included: number; audience: 'everyone' | 'members'; status: string } | null> {
  if (!(await resultsAvailable())) return null;
  const [res] = await db<Array<{ title: string; intro: string; conclusion: string; status: string; audience: 'everyone' | 'members' }>>`
    SELECT title, intro, conclusion, status, audience FROM workspace_results WHERE id = ${resultId} AND host_type = 'lms_run' AND host_id = ${runId}
  `;
  if (!res) return null;
  const items = await db<Array<{ body: string; credit: 'named' | 'anonymous'; name: string | null; created_at: Date }>>`
    SELECT e.body, i.credit, u.display_name AS name, e.created_at
    FROM workspace_result_items i JOIN lms_responses e ON e.id = i.response_id JOIN users u ON u.id = e.user_id JOIN lms_enrolments en ON en.id = e.enrolment_id AND en.status <> 'withdrawn'
    WHERE i.result_id = ${resultId} AND i.state = 'agreed' AND i.credit IS NOT NULL AND e.visibility = 'circle'
      AND EXISTS (SELECT 1 FROM workspace_consents c, workspace_consent_texts t
                  WHERE c.host_type = 'lms_run' AND c.host_id = e.run_id AND c.user_id = e.user_id AND c.withdrawn_at IS NULL
                    AND t.host_type = 'lms_run' AND t.host_id = e.run_id AND t.version = c.text_version)
    ORDER BY e.created_at
  `;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const entries = items.map((i) => `<blockquote>${paras(i.body)}<p><em>${i.credit === 'named' ? esc(i.name ?? 'A participant') : 'A participant'}, ${day(i.created_at)}</em></p></blockquote>`).join('\n');
  const html = [res.intro.trim() ? `<h2>Introduction</h2>\n${paras(res.intro)}` : '', `<h2>What people recorded</h2>\n${entries || '<p>No entries are included.</p>'}`, res.conclusion.trim() ? `<h2>Conclusion</h2>\n${paras(res.conclusion)}` : ''].filter(Boolean).join('\n');
  return { title: res.title.trim(), bodyHtml: sanitizeRichText(html), included: items.length, audience: res.audience, status: res.status };
}

/** The guide presses Publish: re-check everything now and prepare the write-up. Refuses an empty result and an untitled one. The host app creates the thread and then calls markResultPublished. */
export async function prepareResultsPublication(viewer: LmsViewer, courseSlug: string, resultId: string): Promise<{ ok: true; prepared: PreparedPublication } | { ok: false; error: string }> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return { ok: false, error: 'Only the guides of an experiment can do that.' };
  const r = await renderResultBody(g.run.id, resultId);
  if (!r || r.status !== 'draft') return { ok: false, error: 'Only a draft can be published.' };
  if (!r.title) return { ok: false, error: 'Give the results a title.' };
  if (r.included === 0) return { ok: false, error: 'No entry has been agreed to yet. Nothing can be published without a writer’s agreement.' };
  return { ok: true, prepared: { title: r.title, bodyHtml: r.bodyHtml, orgId: g.view.course.orgId, authorId: g.actor.userId!, audience: r.audience, included: r.included, resultId } };
}

export async function markResultPublished(viewer: LmsViewer, courseSlug: string, resultId: string, threadId: string): Promise<WriteResult> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return { ok: false, error: 'Only the guides of an experiment can do that.' };
  const rows = await db`UPDATE workspace_results SET status = 'published', thread_id = ${threadId}, published_at = NOW(), updated_at = NOW() WHERE id = ${resultId} AND host_type = 'lms_run' AND host_id = ${g.run.id} AND status = 'draft' RETURNING id`;
  return rows.length ? { ok: true } : { ok: false, error: 'Only a draft can be published.' };
}

/** The result's thread id, for taking it down. Marks the result taken down; the host app archives the thread. */
export async function markResultTakenDown(viewer: LmsViewer, courseSlug: string, resultId: string): Promise<{ ok: true; threadId: string | null } | { ok: false; error: string }> {
  const g = await guideGate(viewer, courseSlug);
  if (!g) return { ok: false, error: 'Only the guides of an experiment can do that.' };
  const [r] = await db<Array<{ thread_id: string | null; status: string }>>`SELECT thread_id, status FROM workspace_results WHERE id = ${resultId} AND host_type = 'lms_run' AND host_id = ${g.run.id}`;
  if (!r || r.status !== 'published') return { ok: false, error: 'Only published results can be taken down.' };
  await db`UPDATE workspace_results SET status = 'taken_down', taken_down_at = NOW(), updated_at = NOW() WHERE id = ${resultId}`;
  return { ok: true, threadId: r.thread_id };
}

// ── what the screens need ───────────────────────────────────────────────────
export interface ExperimentState {
  preset: Preset;
  consent: ConsentState;
  /** Requests about THIS person's own entries. */
  requests: MyRequest[];
  /** Published results (visible to everyone in the workspace who has agreed): where to find them. */
  published: Array<{ id: string; title: string; threadId: string; threadSlug: string | null; publishedAt: Date }>;
  isGuide: boolean;
}

export async function getExperimentState(viewer: LmsViewer, courseSlug: string): Promise<ExperimentState | null> {
  if (!viewer.userId) return null;
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run) return null;
  const preset = await getWorkspacePreset(view.run.id);
  if (preset !== 'experiment') return null;
  if (!view.seated && !view.runGuide && !workspaceActor(viewer, view)) return null;
  const consent = await getConsentState(view.run.id, viewer.userId);
  const isGuide = Boolean(workspaceActor(viewer, view));
  const okToSee = isGuide || !consent.needs;
  const published = okToSee && (await resultsAvailable())
    ? (await db<Array<{ id: string; title: string; thread_id: string; slug: string | null; published_at: Date }>>`
        SELECT r.id, r.title, r.thread_id, (SELECT t.slug FROM threads t WHERE t.id = r.thread_id) AS slug, r.published_at
        FROM workspace_results r WHERE r.host_type = 'lms_run' AND r.host_id = ${view.run.id} AND r.status = 'published' AND r.thread_id IS NOT NULL ORDER BY r.published_at DESC
      `).map((r) => ({ id: r.id, title: r.title, threadId: r.thread_id, threadSlug: r.slug, publishedAt: r.published_at }))
    : [];
  return { preset, consent, requests: okToSee ? await listMyPublicationRequests(viewer, courseSlug) : [], published, isGuide };
}

/** After a withdrawal: bring a published result's post in line (or note that nothing is left). Marks the result taken down when no agreed entry remains. */
export async function afterWithdrawalPublished(runId: string, resultId: string): Promise<{ bodyHtml: string; title: string; empty: boolean } | null> {
  const r = await renderResultBody(runId, resultId);
  if (!r || r.status !== 'published') return null;
  return { bodyHtml: r.bodyHtml, title: r.title, empty: r.included === 0 };
}
