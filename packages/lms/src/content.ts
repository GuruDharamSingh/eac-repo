// ============================================================================
// CONTENT layer — courses, steps, drafts, publish.
// ============================================================================
import { db } from '@elkdonis/db';
import { sanitizeRichText } from '@elkdonis/utils';
import type {
  Course, LmsViewer, Outline, OutlineModule, PublishedCourse, PublishedModule, PublishedStep,
  StepContent, StepRefs, StepSettings, UnlockRule, WriteResult, CourseVisibility,
} from './types';
import { DEFAULT_RULE } from './unlock';
import { hashContent, isOrgStaff, newId, plainText, slugify, RESERVED_COURSE_SLUGS, RESERVED_STEP_SLUGS } from './util';

interface CourseRow {
  id: string; org_id: string; org_name: string; org_slug: string; slug: string; title: string;
  summary: string | null; description_html: string | null; cover_url: string | null; language: string;
  visibility: CourseVisibility; published_version_id: string | null; updated_at: Date;
}
const COURSE_SELECT = db`
  c.id, c.org_id, o.name AS org_name, o.slug AS org_slug, c.slug, c.title, c.summary,
  c.description_html, c.cover_url, c.language, c.visibility, c.published_version_id, c.updated_at
`;
function mapCourse(r: CourseRow): Course {
  return {
    id: r.id, orgId: r.org_id, orgName: r.org_name, orgSlug: r.org_slug, slug: r.slug, title: r.title,
    summary: r.summary, descriptionHtml: r.description_html, coverUrl: r.cover_url, language: r.language,
    visibility: r.visibility, publishedVersionId: r.published_version_id, updatedAt: r.updated_at,
  };
}

// ── authorisation ───────────────────────────────────────────────────────────
export async function canEditCourse(viewer: LmsViewer, course: Pick<Course, 'id' | 'orgId'>): Promise<boolean> {
  if (!viewer.userId) return false;
  if (isOrgStaff(viewer, course.orgId)) return true;
  const [row] = await db`SELECT 1 FROM lms_course_staff WHERE course_id = ${course.id} AND user_id = ${viewer.userId}`;
  return Boolean(row);
}

// ── reads ───────────────────────────────────────────────────────────────────
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const [r] = await db<CourseRow[]>`
    SELECT ${COURSE_SELECT} FROM lms_courses c JOIN organizations o ON o.id = c.org_id
    WHERE c.slug = ${slug} AND c.archived_at IS NULL
  `;
  return r ? mapCourse(r) : null;
}
export async function getCourseById(id: string): Promise<Course | null> {
  const [r] = await db<CourseRow[]>`
    SELECT ${COURSE_SELECT} FROM lms_courses c JOIN organizations o ON o.id = c.org_id WHERE c.id = ${id}
  `;
  return r ? mapCourse(r) : null;
}

/** Where an old course or step slug went. For 301s. */
export async function resolveRedirect(courseSlug: string, stepSlug?: string): Promise<{ courseSlug: string; stepSlug?: string } | null> {
  if (!stepSlug) {
    const [r] = await db<Array<{ slug: string }>>`
      SELECT c.slug FROM lms_slug_redirects x JOIN lms_courses c ON c.id = x.course_id
      WHERE x.old_slug = ${courseSlug} AND x.step_id IS NULL LIMIT 1
    `;
    return r ? { courseSlug: r.slug } : null;
  }
  const [r] = await db<Array<{ course_slug: string; step_slug: string }>>`
    SELECT c.slug AS course_slug, s.slug AS step_slug
    FROM lms_slug_redirects x JOIN lms_courses c ON c.id = x.course_id JOIN lms_steps s ON s.id = x.step_id
    WHERE x.old_slug = ${stepSlug} AND c.slug = ${courseSlug} LIMIT 1
  `;
  return r ? { courseSlug: r.course_slug, stepSlug: r.step_slug } : null;
}

/** Published, listed courses. `orgId` narrows to one org's catalogue. */
export async function listCatalogue(opts: { orgId?: string } = {}): Promise<Array<Course & { stepCount: number; minutes: number }>> {
  const rows = await db<Array<CourseRow & { outline: Outline }>>`
    SELECT ${COURSE_SELECT}, v.outline
    FROM lms_courses c
    JOIN organizations o ON o.id = c.org_id
    JOIN lms_course_versions v ON v.id = c.published_version_id
    WHERE c.visibility = 'public' AND c.archived_at IS NULL
      ${opts.orgId ? db`AND c.org_id = ${opts.orgId}` : db``}
    ORDER BY c.created_at
  `;
  return rows.map((r) => ({
    ...mapCourse(r),
    stepCount: r.outline.modules.reduce((n, m) => n + m.steps.length, 0),
    minutes: 0,
  }));
}

interface StepVersionRow {
  id: string; step_id: string; slug: string; type: string; title: string; summary: string | null;
  body_html: string | null; settings: StepSettings; refs: StepRefs;
}

/** One immutable course version, resolved to its exact step versions. */
export async function getCourseVersion(course: Course, versionId: string): Promise<PublishedCourse | null> {
  const [v] = await db<Array<{ id: string; version_no: number; outline: Outline; published_at: Date; title: string; summary: string | null; description_html: string | null }>>`
    SELECT id, version_no, outline, published_at, title, summary, description_html
    FROM lms_course_versions WHERE id = ${versionId} AND course_id = ${course.id}
  `;
  if (!v) return null;
  const versionIds = v.outline.modules.flatMap((m) => m.steps.map((s) => s.stepVersionId!).filter(Boolean));
  const rows: StepVersionRow[] = versionIds.length
    ? await db<StepVersionRow[]>`
        SELECT sv.id, sv.step_id, s.slug, s.type, sv.title, sv.summary, sv.body_html, sv.settings, sv.refs
        FROM lms_step_versions sv JOIN lms_steps s ON s.id = sv.step_id
        WHERE sv.id = ANY(${versionIds})
      `
    : [];
  const byId = new Map<string, StepVersionRow>(rows.map((r) => [r.id, r] as [string, StepVersionRow]));
  const steps: PublishedStep[] = [];
  const modules: PublishedModule[] = v.outline.modules.map((m) => {
    const ms: PublishedStep[] = [];
    for (const ref of m.steps) {
      const r = ref.stepVersionId ? byId.get(ref.stepVersionId) : undefined;
      if (!r) continue;
      const step: PublishedStep = {
        stepId: r.step_id, stepVersionId: r.id, slug: r.slug, type: r.type,
        title: r.title, summary: r.summary, bodyHtml: r.body_html, settings: r.settings ?? {}, refs: r.refs ?? {},
        moduleId: m.id, moduleTitle: m.title, index: steps.length,
        required: ref.required !== false, unlock: ref.unlock ?? DEFAULT_RULE,
      };
      steps.push(step);
      ms.push(step);
    }
    return { id: m.id, title: m.title, summary: m.summary ?? null, steps: ms };
  });
  // The version's own title/summary are what was published, not the live row.
  return {
    course: { ...course, title: v.title, summary: v.summary, descriptionHtml: v.description_html },
    versionId: v.id, versionNo: v.version_no, publishedAt: v.published_at, modules, steps,
  };
}

/** The course as the public sees it: its current published version. */
export async function getPublishedCourse(slug: string): Promise<PublishedCourse | null> {
  const course = await getCourseBySlug(slug);
  if (!course?.publishedVersionId) return null;
  return getCourseVersion(course, course.publishedVersionId);
}

// ── authoring ───────────────────────────────────────────────────────────────
export interface CreateCourseInput {
  orgId: string; title: string; slug?: string; summary?: string | null;
  descriptionHtml?: string | null; coverUrl?: string | null; visibility?: CourseVisibility;
}
export async function createCourse(viewer: LmsViewer, input: CreateCourseInput): Promise<WriteResult<{ course: Course }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  if (!isOrgStaff(viewer, input.orgId)) return { ok: false, error: 'Only an organization’s owners and guides can start a course.' };
  const title = input.title.trim();
  if (title.length < 2) return { ok: false, error: 'Give the course a title.' };
  const slug = slugify(input.slug || title);
  if (!slug || RESERVED_COURSE_SLUGS.has(slug)) return { ok: false, error: 'That address is taken by the site itself.' };
  const [clash] = await db`SELECT 1 FROM lms_courses WHERE slug = ${slug}`;
  if (clash) return { ok: false, error: 'Another course already has that address.' };
  const id = newId();
  await db`
    INSERT INTO lms_courses (id, org_id, slug, title, summary, description_html, cover_url, visibility, created_by)
    VALUES (${id}, ${input.orgId}, ${slug}, ${title}, ${input.summary ?? null},
            ${sanitizeRichText(input.descriptionHtml) || null}, ${input.coverUrl ?? null},
            ${input.visibility ?? 'private'}, ${viewer.userId})
  `;
  return { ok: true, course: (await getCourseById(id))! };
}

export async function updateCourse(viewer: LmsViewer, courseId: string, patch: Partial<Omit<CreateCourseInput, 'orgId'>>): Promise<WriteResult> {
  const course = await getCourseById(courseId);
  if (!course) return { ok: false, error: 'No such course.' };
  if (!(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t edit this course.' };
  let slug = course.slug;
  if (patch.slug && slugify(patch.slug) !== course.slug) {
    slug = slugify(patch.slug);
    if (!slug || RESERVED_COURSE_SLUGS.has(slug)) return { ok: false, error: 'That address is taken by the site itself.' };
    const [clash] = await db`SELECT 1 FROM lms_courses WHERE slug = ${slug}`;
    if (clash) return { ok: false, error: 'Another course already has that address.' };
  }
  await db.begin(async (tx) => {
    if (slug !== course.slug) {
      await tx`INSERT INTO lms_slug_redirects (old_slug, course_id) VALUES (${course.slug}, ${course.id}) ON CONFLICT DO NOTHING`;
    }
    await tx`
      UPDATE lms_courses SET
        slug = ${slug},
        title = ${patch.title?.trim() || course.title},
        summary = ${patch.summary === undefined ? course.summary : patch.summary},
        description_html = ${patch.descriptionHtml === undefined ? course.descriptionHtml : sanitizeRichText(patch.descriptionHtml) || null},
        cover_url = ${patch.coverUrl === undefined ? course.coverUrl : patch.coverUrl},
        visibility = ${patch.visibility ?? course.visibility},
        updated_at = NOW()
      WHERE id = ${course.id}
    `;
  });
  return { ok: true };
}

export interface UpsertStepInput extends Partial<StepContent> {
  /** Omit to create. */
  stepId?: string;
  type?: string;
  slug?: string;
  title: string;
}
/** Create a step, or edit its draft. Published versions are never touched. */
export async function upsertStepDraft(viewer: LmsViewer, courseId: string, input: UpsertStepInput): Promise<WriteResult<{ stepId: string; slug: string }>> {
  const course = await getCourseById(courseId);
  if (!course) return { ok: false, error: 'No such course.' };
  if (!(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t edit this course.' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Give the step a title.' };

  let stepId = input.stepId ?? null;
  let slug = slugify(input.slug || title);
  if (!slug || RESERVED_STEP_SLUGS.has(slug)) slug = `${slug || 'step'}-1`;

  return db.begin(async (tx) => {
    if (stepId) {
      const [s] = await tx<Array<{ slug: string }>>`SELECT slug FROM lms_steps WHERE id = ${stepId} AND course_id = ${courseId}`;
      if (!s) return { ok: false as const, error: 'No such step.' };
      if (input.slug && slug !== s.slug) {
        const [clash] = await tx`SELECT 1 FROM lms_steps WHERE course_id = ${courseId} AND slug = ${slug}`;
        if (clash) return { ok: false as const, error: 'Another step already has that address.' };
        await tx`INSERT INTO lms_slug_redirects (old_slug, course_id, step_id) VALUES (${s.slug}, ${courseId}, ${stepId}) ON CONFLICT DO NOTHING`;
        await tx`UPDATE lms_steps SET slug = ${slug} WHERE id = ${stepId}`;
      } else {
        slug = s.slug;
      }
      if (input.type) await tx`UPDATE lms_steps SET type = ${input.type} WHERE id = ${stepId}`;
    } else {
      let n = 1;
      const base = slug;
      // eslint-disable-next-line no-await-in-loop
      while ((await tx`SELECT 1 FROM lms_steps WHERE course_id = ${courseId} AND slug = ${slug}`).length) slug = `${base}-${++n}`;
      stepId = newId();
      await tx`INSERT INTO lms_steps (id, course_id, type, slug) VALUES (${stepId}, ${courseId}, ${input.type ?? 'reading'}, ${slug})`;
    }
    const [prev] = await tx<Array<{ summary: string | null; body_html: string | null; settings: StepSettings; refs: StepRefs }>>`
      SELECT summary, body_html, settings, refs FROM lms_step_drafts WHERE step_id = ${stepId}
    `;
    const summary = input.summary === undefined ? prev?.summary ?? null : input.summary;
    const body = input.bodyHtml === undefined ? prev?.body_html ?? null : sanitizeRichText(input.bodyHtml) || null;
    const settings = input.settings ?? prev?.settings ?? {};
    const refs = input.refs ?? prev?.refs ?? {};
    await tx`
      INSERT INTO lms_step_drafts (step_id, title, summary, body_html, settings, refs, updated_by)
      VALUES (${stepId}, ${title}, ${summary}, ${body}, ${tx.json(settings as never)}, ${tx.json(refs as never)}, ${viewer.userId})
      ON CONFLICT (step_id) DO UPDATE SET
        title = EXCLUDED.title, summary = EXCLUDED.summary, body_html = EXCLUDED.body_html,
        settings = EXCLUDED.settings, refs = EXCLUDED.refs, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
    return { ok: true as const, stepId: stepId!, slug };
  });
}

/** Replace the working outline. Step ids must belong to the course. */
export async function setDraftOutline(viewer: LmsViewer, courseId: string, outline: Outline): Promise<WriteResult> {
  const course = await getCourseById(courseId);
  if (!course) return { ok: false, error: 'No such course.' };
  if (!(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t edit this course.' };
  const ids = outline.modules.flatMap((m) => m.steps.map((s) => s.stepId));
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'A step appears twice in the outline.' };
  const owned = await db<Array<{ id: string }>>`SELECT id FROM lms_steps WHERE course_id = ${courseId} AND id = ANY(${ids})`;
  if (owned.length !== ids.length) return { ok: false, error: 'The outline names a step that isn’t in this course.' };
  const clean: Outline = {
    modules: outline.modules.map((m): OutlineModule => ({
      id: m.id || newId(), title: m.title.trim() || 'Untitled', summary: m.summary ?? null,
      steps: m.steps.map((s) => ({ stepId: s.stepId, required: s.required !== false, unlock: (s.unlock ?? DEFAULT_RULE) as UnlockRule })),
    })),
  };
  await db`UPDATE lms_courses SET draft_outline = ${db.json(clean as never)}, updated_at = NOW() WHERE id = ${courseId}`;
  return { ok: true };
}

/**
 * Publish: ONE transaction that freezes every changed step and the course.
 * Runs that follow fixes (auto_fast_forward) move to the new version only when
 * the change is wording-only; a structural change waits to be adopted.
 */
export async function publishCourse(viewer: LmsViewer, courseId: string, notes?: string): Promise<WriteResult<{ versionId: string; versionNo: number; changeKind: 'fix' | 'structural'; stepsFrozen: number }>> {
  const course = await getCourseById(courseId);
  if (!course) return { ok: false, error: 'No such course.' };
  if (!(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t publish this course.' };

  return db.begin(async (tx) => {
    const [c] = await tx<Array<{ draft_outline: Outline; published_version_id: string | null; title: string; summary: string | null; description_html: string | null }>>`
      SELECT draft_outline, published_version_id, title, summary, description_html FROM lms_courses WHERE id = ${courseId} FOR UPDATE
    `;
    const outline = c.draft_outline;
    const refs = outline.modules.flatMap((m) => m.steps);
    if (!refs.length) return { ok: false as const, error: 'Add at least one step before publishing.' };

    const drafts = await tx<Array<{ step_id: string; title: string; summary: string | null; body_html: string | null; settings: StepSettings; refs: StepRefs }>>`
      SELECT step_id, title, summary, body_html, settings, refs FROM lms_step_drafts WHERE step_id = ANY(${refs.map((r) => r.stepId)})
    `;
    const draftById = new Map(drafts.map((d) => [d.step_id, d]));
    const missing = refs.find((r) => !draftById.get(r.stepId));
    if (missing) return { ok: false as const, error: 'A step in the outline has no content yet.' };
    if (course.visibility !== 'private') {
      const bare = drafts.find((d) => !d.summary?.trim());
      if (bare) return { ok: false as const, error: `“${bare.title}” needs a one-line summary — every public step page stands on its own.` };
    }

    const latest = await tx<Array<{ step_id: string; id: string; version_no: number; content_hash: string }>>`
      SELECT DISTINCT ON (step_id) step_id, id, version_no, content_hash
      FROM lms_step_versions WHERE step_id = ANY(${refs.map((r) => r.stepId)})
      ORDER BY step_id, version_no DESC
    `;
    const latestById = new Map(latest.map((l) => [l.step_id, l]));

    let frozen = 0;
    const versionOf = new Map<string, string>();
    for (const d of drafts) {
      const hash = hashContent([d.title, d.summary, d.body_html, d.settings, d.refs]);
      const last = latestById.get(d.step_id);
      if (last?.content_hash === hash) { versionOf.set(d.step_id, last.id); continue; }
      const id = newId();
      // eslint-disable-next-line no-await-in-loop
      await tx`
        INSERT INTO lms_step_versions (id, step_id, version_no, title, summary, body_html, settings, refs, plain_text, content_hash, created_by)
        VALUES (${id}, ${d.step_id}, ${(last?.version_no ?? 0) + 1}, ${d.title}, ${d.summary}, ${d.body_html},
                ${tx.json(d.settings as never)}, ${tx.json(d.refs as never)},
                ${[d.title, d.summary, plainText(d.body_html), d.settings?.practice, d.settings?.prompt].filter(Boolean).join('\n')},
                ${hash}, ${viewer.userId})
      `;
      versionOf.set(d.step_id, id);
      frozen++;
    }

    const snapshot: Outline = {
      modules: outline.modules.map((m) => ({ ...m, steps: m.steps.map((s) => ({ ...s, stepVersionId: versionOf.get(s.stepId)! })) })),
    };

    // Structural = anything but wording: the shape a learner's progress hangs on.
    const shape = (o: Outline) => JSON.stringify(o.modules.map((m) => [m.id, m.steps.map((s) => [s.stepId, s.required !== false, s.unlock ?? DEFAULT_RULE])]));
    let changeKind: 'fix' | 'structural' = 'structural';
    let nextNo = 1;
    if (c.published_version_id) {
      const [pv] = await tx<Array<{ version_no: number; outline: Outline }>>`SELECT version_no, outline FROM lms_course_versions WHERE id = ${c.published_version_id}`;
      nextNo = pv.version_no + 1;
      if (shape(pv.outline) === shape(snapshot)) changeKind = 'fix';
      if (changeKind === 'fix' && frozen === 0 && JSON.stringify(pv.outline) === JSON.stringify(snapshot)) {
        return { ok: false as const, error: 'Nothing has changed since the last publish.' };
      }
    }

    const versionId = newId();
    await tx`
      INSERT INTO lms_course_versions (id, course_id, version_no, title, summary, description_html, outline, change_kind, notes, published_by)
      VALUES (${versionId}, ${courseId}, ${nextNo}, ${c.title}, ${c.summary}, ${c.description_html}, ${tx.json(snapshot as never)}, ${changeKind}, ${notes ?? null}, ${viewer.userId})
    `;
    await tx`UPDATE lms_courses SET published_version_id = ${versionId}, updated_at = NOW() WHERE id = ${courseId}`;
    if (changeKind === 'fix') {
      await tx`UPDATE lms_runs SET course_version_id = ${versionId}, updated_at = NOW() WHERE course_id = ${courseId} AND auto_fast_forward AND course_version_id = ${c.published_version_id}`;
    }
    await tx`
      INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, result)
      VALUES (${course.orgId}, ${viewer.userId}, 'published', 'course', ${courseId}, ${versionId}, ${tx.json({ changeKind, stepsFrozen: frozen } as never)})
    `;
    return { ok: true as const, versionId, versionNo: nextNo, changeKind, stepsFrozen: frozen };
  });
}

/** Working copy for the authoring UI and the seed script. */
export async function getDraft(viewer: LmsViewer, courseId: string): Promise<{ course: Course; outline: Outline; steps: Array<StepContent & { stepId: string; slug: string; type: string }> } | null> {
  const course = await getCourseById(courseId);
  if (!course || !(await canEditCourse(viewer, course))) return null;
  const [c] = await db<Array<{ draft_outline: Outline }>>`SELECT draft_outline FROM lms_courses WHERE id = ${courseId}`;
  const rows = await db<Array<{ id: string; slug: string; type: string; title: string; summary: string | null; body_html: string | null; settings: StepSettings; refs: StepRefs }>>`
    SELECT s.id, s.slug, s.type, d.title, d.summary, d.body_html, d.settings, d.refs
    FROM lms_steps s JOIN lms_step_drafts d ON d.step_id = s.id WHERE s.course_id = ${courseId} AND s.archived_at IS NULL
  `;
  return {
    course, outline: c.draft_outline,
    steps: rows.map((r) => ({ stepId: r.id, slug: r.slug, type: r.type, title: r.title, summary: r.summary, bodyHtml: r.body_html, settings: r.settings, refs: r.refs })),
  };
}
