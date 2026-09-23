// Shared by the seed scripts: turn a plain course spec into drafts, an outline
// and a publish. Idempotent — steps are matched by slug, and publish only
// writes a version when something changed.
import {
  createCourse, getCourseBySlug, getCourseById, upsertStepDraft, setDraftOutline, publishCourse, ensureDefaultRun, getDraft,
  updateCourse, type Course, type CourseVisibility, type LmsViewer, type UnlockRule, type UpsertStepInput, type Run,
} from '../src/index.ts';

export type SeedStep = UpsertStepInput & { slug: string; required?: boolean; unlock?: UnlockRule };
export interface SeedModule { id: string; title: string; summary?: string; steps: SeedStep[] }
export interface SeedCourse {
  orgId: string; slug: string; title: string; summary: string; descriptionHtml?: string;
  visibility: CourseVisibility; modules: SeedModule[]; notes?: string;
}

export async function seedCourse(viewer: LmsViewer, spec: SeedCourse): Promise<{ course: Course; defaultRun: Run }> {
  let course = await getCourseBySlug(spec.slug);
  if (!course) {
    const r = await createCourse(viewer, spec);
    if (r.ok === false) throw new Error(r.error);
    course = r.course;
  } else {
    const r = await updateCourse(viewer, course.id, { title: spec.title, summary: spec.summary, descriptionHtml: spec.descriptionHtml, visibility: spec.visibility });
    if (r.ok === false) throw new Error(r.error);
  }
  const existing = await getDraft(viewer, course.id);
  const bySlug = new Map(existing?.steps.map((s) => [s.slug, s.stepId]));
  const outline = { modules: [] as Array<{ id: string; title: string; summary?: string; steps: Array<{ stepId: string; required: boolean; unlock?: UnlockRule }> }> };
  for (const m of spec.modules) {
    if (!m.steps.length) continue;
    const refs = [];
    for (const { required, unlock, ...s } of m.steps) {
      const r = await upsertStepDraft(viewer, course.id, { ...s, stepId: bySlug.get(s.slug) });
      if (r.ok === false) throw new Error(`${s.title}: ${r.error}`);
      refs.push({ stepId: r.stepId, required: required !== false, unlock });
    }
    outline.modules.push({ id: m.id, title: m.title, summary: m.summary, steps: refs });
  }
  const o = await setDraftOutline(viewer, course.id, outline);
  if (o.ok === false) throw new Error(o.error);
  const pub = await publishCourse(viewer, course.id, spec.notes ?? 'Seeded');
  console.log(`[${spec.slug}] publish:`, pub.ok ? `v${pub.versionNo} ${pub.changeKind}, ${pub.stepsFrozen} step(s) frozen` : pub.error);
  course = (await getCourseById(course.id))!;
  return { course, defaultRun: (await ensureDefaultRun(course))! };
}
