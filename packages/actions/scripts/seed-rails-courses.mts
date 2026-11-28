// Seed the 21 candidate courses of the track nexus as real LMS courses (2026-11-16, lane seed).
// For Justin's own testing of the dock: structure only, no tutorial prose. Every course slug starts `rails-`.
//
//   pnpm --filter @elkdonis/actions seed:rails                 dry run (default): plan + SQL, writes nothing
//   pnpm --filter @elkdonis/actions seed:rails -- --sql-all    dry run, print every statement (default: first of each kind)
//   pnpm --filter @elkdonis/actions seed:rails -- --write      one transaction: upsert courses, replace steps, publish
//   pnpm --filter @elkdonis/actions seed:rails -- --remove     one transaction: delete every rails-* course
//
// Org and author are copied from the `getting-started` course row. Courses are published (a frozen version, as
// publishCourse in packages/lms/src/content.ts does it) and public. A default run is made as ensureDefaultRun does.
// Steps are matched by slug, so re-running keeps step ids (and learners' progress) and only changes what changed.
// Task steps use the getting-started shape: type 'task', settings.task = {id, scope}. A capability the dock cannot run
// becomes a PLACE step (2026-11-27): type 'place' ("I did it" button), a short line on what it does, where it is done and
// a "Take me there" link to the page (a full address, because the lesson is read on Sophia). A gap, or a capability
// with no recorded address, is a "Coming later" reading step. Nothing here touches a course
// whose slug does not start with `rails-`, except the tag update on EXISTING_TAGS (area/builds_on only, --write only).
// Every jsonb parameter is cast through text ($n::text::jsonb). A bare $n::jsonb with a JSON.stringify(...) string makes
// postgres.js encode the string again, storing a JSON *string* (the 2026-11-16 and 2026-11-27 writes did that; Sophia's
// course pages then crashed on outline.modules). Repaired rows: ~/eac-backups/lms-dblenc-20261127/.
// Every jsonb parameter is cast through text ($n::text::jsonb). A bare $n::jsonb given a JSON.stringify(...) string makes
// postgres.js encode the string again, so the row stores a JSON *string* (the 2026-11-16 and 2026-11-27 writes did this, and
// Sophia's course pages then crashed on outline.modules). Rows repaired from: ~/eac-backups/lms-dblenc-20261127/.
import { db } from '@elkdonis/db';
import { loadAreas } from '../atlas/index';
import { loadNexus } from '../atlas/tracks/index';
import type { Capability } from '../atlas/types';
import { ACTION_CATALOGUE, COURSE_ACTIONS } from '../src/catalogue';
import { REGISTRY_DATA } from '../src/registry-data';
import { hashContent, newId, plainText, slugify, RESERVED_STEP_SLUGS } from '../../lms/src/util';
import { APP_NAMES, pickAddress, placeUrl, plainHow } from '../atlas/origins';

const PREFIX = 'rails-';
const MODEL_SLUG = 'getting-started';
/** Existing courses that get area/builds_on (9b). The nexus names none of them; getting-started is the whole-network
 *  onboarding, tagged by its first modules (profile). Applied only with --write. */
const EXISTING_TAGS: Record<string, { area: string; builds_on: string[] }> = {
  'getting-started': { area: 'profile', builds_on: [] },
};

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const REMOVE = argv.includes('--remove');
const SQL_ALL = argv.includes('--sql-all');
if (WRITE && REMOVE) throw new Error('--write and --remove are exclusive');
const DRY = !WRITE && !REMOVE;

// ── build the plan from the nexus ───────────────────────────────────────────
type Kind = 'task' | 'place' | 'gap';
interface PlanStep { slug: string; kind: Kind; type: 'task' | 'place' | 'reading'; title: string; summary: string; bodyHtml: string | null; settings: Record<string, unknown>; detail: string }
interface PlanModule { id: string; title: string; steps: PlanStep[] }
interface PlanCourse { slug: string; id: string; title: string; summary: string; area: string; buildsOn: string[]; modules: PlanModule[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const firstSentence = (s: string) => clip((s.split(/(?<=\.)\s/)[0] ?? s).replace(/\s+/g, ' ').trim(), 150);

const { tracks, courses } = await loadNexus();
const areas = await loadAreas();
const caps = new Map<string, Capability>();
for (const a of Object.values(areas)) for (const c of a.capabilities) caps.set(c.id, c);
const trackById = new Map(tracks.map((t) => [t.id, t]));
const courseIds = new Set(courses.map((c) => c.id));
const catalogueById = new Map(ACTION_CATALOGUE.map((m) => [m.id, m]));
const courseActionIds = new Set(COURSE_ACTIONS.map((m) => m.id));
const problems: string[] = [];
const notes: string[] = [];

/** Step choices for entries that cover more than one capability (org-publish saves a post, an event or a meeting). */
const TASK_PARAMS: Record<string, Record<string, string>> = { 'meeting-save': { kind: 'meeting' } };

/** "Coming later: <what>": nothing to do yet (a gap in a track, or no recorded address). */
function laterStep(slug: string, what: string, extra: string | null, detail: string): PlanStep {
  return {
    slug, kind: 'gap', type: 'reading', title: clip(`Coming later: ${what}`, 120), summary: 'Nothing to do here yet.',
    bodyHtml: `<p>Coming later: ${esc(what)}.</p>${extra ? `<p>${esc(extra)}</p>` : ''}<p>Nothing to do here yet. Carry on with the next step.</p>`,
    settings: {}, detail,
  };
}

/** A place step: what it does, where it is done, and a deep link there. */
function placeStep(slug: string, cap: Capability): PlanStep {
  const addr = pickAddress(cap);
  if (!addr) return laterStep(slug, cap.label, firstSentence(cap.does), `${cap.id} (no address recorded)`);
  const url = placeUrl(addr.app, addr.path);
  const where = APP_NAMES[addr.app] ?? addr.app;
  const how = plainHow(addr.how);
  const whereLine = `Where: ${where}${how ? `. Look for: ${how.replace(/\.$/, '')}` : ''}.`;
  // Round 2 (2026-11-27, Justin): "Take me there" stays, as deep as the atlas address allows: the path, plus ?surface=
  // when the address names one (placeUrl cuts queries off, so it is put back here). One plain line on what it does above it.
  // A surface with a {placeholder} (an org) cannot be a fixed link; the anchor is the data-eac-anchor value to outline.
  const surface = addr.surface && !addr.surface.includes('{') ? addr.surface : null;
  const deep = url && surface ? `${url}?surface=${encodeURIComponent(surface)}` : url;
  const anchor = addr.anchor ?? cap.id;
  const body = [
    `<p>${esc(firstSentence(cap.does))}</p>`,
    `<p>${esc(whereLine)}</p>`,
    deep ? `<p><a href="${esc(deep)}">Take me there</a></p>` : `<p>There is no public link to it yet. Ask the collective to do this one with you.</p>`,
    `<p>When you have done it, press “I did it” below.</p>`,
  ].join('');
  return {
    slug, kind: 'place', type: 'place', title: cap.label, summary: firstSentence(cap.does), bodyHtml: body,
    settings: deep ? { place: { href: deep, where: clip(whereLine, 200), anchor } } : {}, detail: `${cap.id} -> ${deep ?? '(no link)'}`,
  };
}

const plan: PlanCourse[] = courses.map((c) => {
  for (const b of c.builds_on) if (!courseIds.has(b)) problems.push(`${c.id}: builds_on '${b}' is not a nexus course`);
  const used = new Set<string>();
  let gapNo = 0;
  const uniq = (base: string): string => {
    const root = base && !RESERVED_STEP_SLUGS.has(base) ? base : `${base || 'step'}-1`;
    let s = root;
    let n = 1;
    while (used.has(s)) s = `${root}-${++n}`;
    used.add(s);
    return s;
  };
  const modules: PlanModule[] = c.tracks.map((tid) => {
    const t = trackById.get(tid);
    if (!t) { problems.push(`${c.id}: unknown track ${tid}`); return { id: tid, title: tid, steps: [] }; }
    const steps: PlanStep[] = t.steps.map((s): PlanStep => {
      if (typeof s !== 'string') {
        gapNo++;
        return laterStep(uniq(`gap-${gapNo}`), s.gap, null, s.gap);
      }
      const cap = caps.get(s);
      if (!cap) {
        problems.push(`${c.id}/${tid}: step '${s}' is not an atlas capability`);
        return laterStep(uniq(slugify(s)), s, null, s);
      }
      const entry = typeof cap.entry === 'string' ? cap.entry : null;
      // A task step needs an entry the dock can use: a course action (person/org scope) that has registry-data.
      let why = '';
      if (entry) {
        if (!catalogueById.has(entry)) why = `entry ${entry} not in the catalogue`;
        else if (!courseActionIds.has(entry)) why = `entry ${entry} is not a course action (scope ${catalogueById.get(entry)!.scope} or appOnly)`;
        else if (!REGISTRY_DATA[entry]) why = `entry ${entry} has no registry-data`;
      }
      if (why) notes.push(`${c.id}/${tid}: ${s}: ${why}`);
      if (entry && !why) {
        const scope = catalogueById.get(entry)!.scope === 'org' ? 'org' : 'person';
        return {
          slug: uniq(slugify(s)), kind: 'task', type: 'task', title: cap.label, summary: firstSentence(cap.does), bodyHtml: null,
          settings: { task: { id: entry, scope, ...(TASK_PARAMS[s] ? { params: TASK_PARAMS[s] } : {}) } }, detail: `${entry} (${scope}) <- ${s}`,
        };
      }
      const step = placeStep(uniq(slugify(s)), cap);
      return why ? { ...step, detail: `${step.detail}  [${why}]` } : step;
    });
    return { id: tid, title: t.label, steps };
  });
  return {
    slug: PREFIX + c.id, id: c.id, title: c.label,
    summary: `Track path: ${c.tracks.join(', ')} (test course)`,
    area: c.area, buildsOn: c.builds_on.map((b) => PREFIX + b), modules,
  };
});
if (notes.length) console.log('NOTES (capability has an entry the dock cannot use as a task step; made a place step):\n' + notes.map((p) => '  ' + p).join('\n') + '\n');
if (problems.length) console.error('PROBLEMS:\n' + problems.map((p) => '  ' + p).join('\n'));

// ── executor: reads always run; writes run in the transaction, or are printed in a dry run ──
type Handle = { unsafe: (q: string, p?: any[]) => Promise<any[]> };
const sqlSeen = new Map<string, number>();
const sqlLog: string[] = [];
const shortParam = (v: unknown) => (typeof v === 'string' ? JSON.stringify(clip(v, 60)) : typeof v === 'object' ? clip(JSON.stringify(v), 60) : String(v));
function makeExec(h: Handle) {
  return {
    read: (q: string, p: unknown[] = []) => h.unsafe(q, p as any[]),
    write: async (q: string, p: unknown[] = []): Promise<any[]> => {
      const key = q.replace(/\s+/g, ' ').trim();
      sqlSeen.set(key, (sqlSeen.get(key) ?? 0) + 1);
      if (SQL_ALL || sqlSeen.get(key) === 1) sqlLog.push(`${key}\n    -- params: ${p.map(shortParam).join(' | ')}`);
      if (DRY) return [];
      return h.unsafe(q, p as any[]);
    },
  };
}
type Exec = ReturnType<typeof makeExec>;

interface ModelRow { id: string; org_id: string; created_by: string | null }
async function loadModel(x: Exec): Promise<ModelRow> {
  const [m] = await x.read(`SELECT id, org_id, created_by FROM lms_courses WHERE slug = $1 AND archived_at IS NULL`, [MODEL_SLUG]);
  if (!m) throw new Error(`model course '${MODEL_SLUG}' not found`);
  return m as ModelRow;
}

const stats = { created: 0, updated: 0, unchanged: 0, versions: 0, stepsAdded: 0, stepsUpdated: 0, stepsRemoved: 0 };

async function applyCourse(x: Exec, model: ModelRow, c: PlanCourse): Promise<void> {
  const [have] = await x.read(`SELECT id, published_version_id FROM lms_courses WHERE slug = $1`, [c.slug]);
  const courseId: string = have?.id ?? newId();
  if (have) {
    stats.updated++;
    await x.write(
      `UPDATE lms_courses SET title = $2, summary = $3, visibility = 'public', area = $4, builds_on = $5::text[], archived_at = NULL, updated_at = NOW() WHERE id = $1`,
      [courseId, c.title, c.summary, c.area, c.buildsOn],
    );
  } else {
    stats.created++;
    await x.write(
      `INSERT INTO lms_courses (id, org_id, slug, title, summary, visibility, area, builds_on, created_by) VALUES ($1, $2, $3, $4, $5, 'public', $6, $7::text[], $8)`,
      [courseId, model.org_id, c.slug, c.title, c.summary, c.area, c.buildsOn, model.created_by],
    );
  }

  // Steps, matched by slug within the course.
  const existing: Array<{ id: string; slug: string }> = have ? await x.read(`SELECT id, slug FROM lms_steps WHERE course_id = $1`, [courseId]) : [];
  const idBySlug = new Map(existing.map((s) => [s.slug, s.id]));
  const wanted = new Set(c.modules.flatMap((m) => m.steps.map((s) => s.slug)));
  const stale = existing.filter((s) => !wanted.has(s.slug)).map((s) => s.id);
  if (stale.length) {
    stats.stepsRemoved += stale.length;
    await x.write(`UPDATE lms_enrolments SET last_step_id = NULL WHERE last_step_id = ANY($1::text[])`, [stale]);
    await x.write(`DELETE FROM lms_steps WHERE id = ANY($1::text[])`, [stale]);
  }
  type Ref = { stepId: string; required: boolean; unlock: { kind: 'open' } };
  const outline: { modules: Array<{ id: string; title: string; summary: null; steps: Ref[] }> } = { modules: [] };
  const draftOf = new Map<string, { title: string; summary: string; body: string | null; settings: unknown; refs: unknown }>();
  for (const m of c.modules) {
    if (!m.steps.length) continue;
    const refs: Ref[] = [];
    for (const s of m.steps) {
      let stepId = idBySlug.get(s.slug);
      if (stepId) {
        stats.stepsUpdated++;
        await x.write(`UPDATE lms_steps SET type = $2, archived_at = NULL WHERE id = $1`, [stepId, s.type]);
      } else {
        stats.stepsAdded++;
        stepId = newId();
        await x.write(`INSERT INTO lms_steps (id, course_id, type, slug) VALUES ($1, $2, $3, $4)`, [stepId, courseId, s.type, s.slug]);
      }
      await x.write(
        `INSERT INTO lms_step_drafts (step_id, title, summary, body_html, settings, refs, updated_by) VALUES ($1, $2, $3, $4, $5::text::jsonb, $6::text::jsonb, $7)
         ON CONFLICT (step_id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, body_html = EXCLUDED.body_html, settings = EXCLUDED.settings, refs = EXCLUDED.refs, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [stepId, s.title, s.summary, s.bodyHtml, JSON.stringify(s.settings), '{}', model.created_by],
      );
      draftOf.set(stepId, { title: s.title, summary: s.summary, body: s.bodyHtml, settings: s.settings, refs: {} });
      refs.push({ stepId, required: true, unlock: { kind: 'open' } });
    }
    outline.modules.push({ id: m.id, title: m.title, summary: null, steps: refs });
  }
  await x.write(`UPDATE lms_courses SET draft_outline = $2::text::jsonb WHERE id = $1`, [courseId, JSON.stringify(outline)]);

  // Publish: freeze changed steps, then the course, as publishCourse does.
  const ids = [...draftOf.keys()];
  const latest: Array<{ step_id: string; id: string; version_no: number; content_hash: string }> = have && ids.length
    ? await x.read(`SELECT DISTINCT ON (step_id) step_id, id, version_no, content_hash FROM lms_step_versions WHERE step_id = ANY($1::text[]) ORDER BY step_id, version_no DESC`, [ids])
    : [];
  const latestById = new Map(latest.map((l) => [l.step_id, l]));
  const versionOf = new Map<string, string>();
  let frozen = 0;
  for (const [stepId, d] of draftOf) {
    const hash = hashContent([d.title, d.summary, d.body, d.settings, d.refs]);
    const last = latestById.get(stepId);
    if (last?.content_hash === hash) { versionOf.set(stepId, last.id); continue; }
    const vid = newId();
    await x.write(
      `INSERT INTO lms_step_versions (id, step_id, version_no, title, summary, body_html, settings, refs, plain_text, content_hash, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8::text::jsonb, $9, $10, $11)`,
      [vid, stepId, (last?.version_no ?? 0) + 1, d.title, d.summary, d.body, JSON.stringify(d.settings), '{}', [d.title, d.summary, plainText(d.body)].filter(Boolean).join('\n'), hash, model.created_by],
    );
    versionOf.set(stepId, vid);
    frozen++;
  }
  const snapshot = { modules: outline.modules.map((m) => ({ ...m, steps: m.steps.map((s) => ({ ...s, stepVersionId: versionOf.get(s.stepId) ?? '<new>' })) })) };
  const shape = (o: { modules: Array<{ id: string; steps: Ref[] }> }) => JSON.stringify(o.modules.map((m) => [m.id, m.steps.map((s) => [s.stepId, s.required, s.unlock])]));
  let nextNo = 1;
  let changeKind: 'fix' | 'structural' = 'structural';
  let skip = false;
  if (have?.published_version_id) {
    const [pv] = await x.read(`SELECT version_no, outline, title, summary FROM lms_course_versions WHERE id = $1`, [have.published_version_id]);
    if (pv) {
      nextNo = pv.version_no + 1;
      if (shape(pv.outline) === shape(outline)) changeKind = 'fix';
      if (frozen === 0 && shape(pv.outline) === shape(outline) && pv.title === c.title && pv.summary === c.summary) skip = true;
    }
  }
  if (skip) { stats.unchanged++; stats.updated--; return; }
  const versionId = newId();
  stats.versions++;
  await x.write(
    `INSERT INTO lms_course_versions (id, course_id, version_no, title, summary, outline, change_kind, notes, published_by) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8, $9)`,
    [versionId, courseId, nextNo, c.title, c.summary, JSON.stringify(snapshot), changeKind, 'seed-rails-courses', model.created_by],
  );
  await x.write(`UPDATE lms_courses SET published_version_id = $2, updated_at = NOW() WHERE id = $1`, [courseId, versionId]);
  // The default run, as ensureDefaultRun makes it; an existing one follows the new version.
  const [run] = have ? await x.read(`SELECT id FROM lms_runs WHERE course_id = $1 AND is_default`, [courseId]) : [];
  if (run) {
    await x.write(`UPDATE lms_runs SET course_version_id = $2, updated_at = NOW() WHERE id = $1`, [run.id, versionId]);
  } else {
    const runId = newId();
    await x.write(
      `INSERT INTO lms_runs (id, course_id, org_id, slug, title, mode, course_version_id, is_default) VALUES ($1, $2, $3, 'open', 'At your own pace', 'open', $4, TRUE)`,
      [runId, courseId, model.org_id, versionId],
    );
    if (model.created_by) await x.write(`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES ($1, $2, 'guide') ON CONFLICT DO NOTHING`, [runId, model.created_by]);
  }
  await x.write(
    `INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, result) VALUES ($1, $2, 'published', 'course', $3, $4, $5::text::jsonb)`,
    [model.org_id, model.created_by, courseId, versionId, JSON.stringify({ changeKind, stepsFrozen: frozen, seed: 'rails' })],
  );
}

// ── print the plan ──────────────────────────────────────────────────────────
const kinds: Record<Kind, number> = { task: 0, place: 0, gap: 0 };
console.log(`mode: ${DRY ? 'DRY RUN (writes nothing)' : WRITE ? 'WRITE' : 'REMOVE'}\n`);
console.log(`=== plan: ${plan.length} courses ===`);
for (const c of plan) {
  const per: Record<Kind, number> = { task: 0, place: 0, gap: 0 };
  for (const m of c.modules) for (const s of m.steps) { per[s.kind]++; kinds[s.kind]++; }
  console.log(`\n${c.slug}  [${c.area}]  builds_on: ${c.buildsOn.length ? c.buildsOn.join(', ') : '-'}  | task ${per.task}, place ${per.place}, gap ${per.gap}`);
  console.log(`  "${c.title}" -- ${c.summary}`);
  for (const m of c.modules) {
    console.log(`  section ${m.id}: ${m.title}`);
    for (const s of m.steps) console.log(`    [${s.kind.padEnd(9)}] ${s.slug}: ${s.detail}`);
  }
}
const total = kinds.task + kinds.place + kinds.gap;
console.log(`\n=== totals: ${plan.length} courses, ${total} steps: task ${kinds.task}, place ${kinds.place}, gap ${kinds.gap} ===`);
const taskEntries = new Set(plan.flatMap((c) => c.modules.flatMap((m) => m.steps.filter((s) => s.kind === 'task').map((s) => (s.settings.task as { id: string }).id))));
console.log(`distinct task entries: ${taskEntries.size}; all in registry-data: ${[...taskEntries].every((e) => REGISTRY_DATA[e]) ? 'yes' : 'NO'}`);

// ── existing courses that get tags ──────────────────────────────────────────
console.log('\n=== existing courses tagged (only with --write) ===');
for (const [slug, t] of Object.entries(EXISTING_TAGS)) {
  const [r] = (await db.unsafe(`SELECT slug, area, builds_on FROM lms_courses WHERE slug = $1`, [slug])) as any[];
  console.log(`${slug}: ${r ? `now area=${r.area ?? 'null'} builds_on={${(r.builds_on ?? []).join(',')}}` : 'NOT FOUND'} -> area=${t.area} builds_on={${t.builds_on.join(',')}}`);
}
const nonRails = ((await db.unsafe(`SELECT count(*)::int AS n FROM lms_courses WHERE slug NOT LIKE $1`, [PREFIX + '%'])) as any[])[0].n;
const railsNow = ((await db.unsafe(`SELECT count(*)::int AS n FROM lms_courses WHERE slug LIKE $1`, [PREFIX + '%'])) as any[])[0].n;
console.log(`\nnon-rails courses in the DB: ${nonRails} (never touched, apart from the tags above); rails-* courses now: ${railsNow}`);

if (problems.length && !DRY) throw new Error('refusing to write with plan problems');

// ── run ─────────────────────────────────────────────────────────────────────
if (REMOVE) {
  await db.begin(async (tx) => {
    const x = makeExec(tx as unknown as Handle);
    const rows = await x.read(`SELECT slug FROM lms_courses WHERE slug LIKE $1 ORDER BY slug`, [PREFIX + '%']);
    await x.write(`DELETE FROM lms_courses WHERE slug LIKE $1`, [PREFIX + '%']);
    console.log(`\nremoved ${rows.length} course(s): ${rows.map((r: { slug: string }) => r.slug).join(', ')}`);
  });
} else {
  const run = async (h: Handle) => {
    const x = makeExec(h);
    const model = await loadModel(x);
    for (const c of plan) await applyCourse(x, model, c);
    for (const [slug, t] of Object.entries(EXISTING_TAGS)) {
      await x.write(`UPDATE lms_courses SET area = $2, builds_on = $3::text[] WHERE slug = $1 AND slug NOT LIKE $4`, [slug, t.area, t.builds_on, PREFIX + '%']);
    }
  };
  if (WRITE) await db.begin(async (tx) => run(tx as unknown as Handle));
  else await run(db as unknown as Handle);
  console.log(`\n=== SQL ${DRY ? 'it would run' : 'run'} (${SQL_ALL ? 'every statement' : 'first of each kind; --sql-all for all'}) ===`);
  console.log(sqlLog.join('\n'));
  console.log(`\nstatements by kind:\n  ${[...sqlSeen.entries()].map(([k, n]) => `${n} x ${k.slice(0, 60)}`).join('\n  ')}`);
  console.log(`\ncourses: ${stats.created} to create, ${stats.updated} to update, ${stats.unchanged} unchanged; ${stats.versions} versions; steps +${stats.stepsAdded} ~${stats.stepsUpdated} -${stats.stepsRemoved}`);
}
await (db as any).end?.({ timeout: 2 });
