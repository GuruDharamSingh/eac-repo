import { enrol, ensureDefaultRun, getActiveEnrolment, getCourseBySlug, settleTaskStep, type Course } from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";
import { courseMetadata, stepMetadata, type LmsMetadata } from "./metadata";
import { CarePage, CataloguePage, CoursePage, JournalPage, StepPage, type PageQuery, type PageResult } from "./pages";

/**
 * One mountable route for a host that is not Sophia (lms/ORG_SITES.md):
 * `/<base>` the catalogue, `/<base>/journal`, `/<base>/care`,
 * `/<base>/<course>`, `/<base>/<course>/<step>`. The host's hrefs decide the
 * base; this function only reads the segments after it. Hub pages (Inner/Outer,
 * guides, traditions, schedule) and the studio stay on Sophia.
 */
export interface LmsRouteInput {
  c: LmsConnectors;
  segments: string[];
  searchParams: Record<string, string | string[] | undefined>;
  /**
   * Enrol a signed-in visitor in the course's default run the first time
   * they open it, instead of asking them to press Begin. For a course that is
   * the way in (onboarding), not for one a person browses.
   */
  autoEnrol?: (course: Course) => boolean;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function prepare(input: LmsRouteInput, courseSlug: string, stepSlug?: string): Promise<void> {
  const course = await getCourseBySlug(courseSlug);
  if (!course?.publishedVersionId) return;
  const viewer = await input.c.viewer();
  if (!viewer.userId) return;
  if (input.autoEnrol?.(course) && course.visibility !== "private") {
    const have = await getActiveEnrolment(viewer.userId, course.id);
    if (!have) {
      const run = await ensureDefaultRun(course);
      if (run) {
        const r = await enrol(viewer, run.id);
        if (r.ok === false) console.warn("[lms] auto-enrol:", course.slug, r.error);
      }
    }
  }
  if (stepSlug && input.c.tasks) {
    const { tasks } = input.c;
    const orgId = tasks.orgFor ? await tasks.orgFor(viewer, one(input.searchParams.org) ?? null) : null;
    await settleTaskStep(viewer, { courseId: course.id, stepSlug, status: (task) => tasks.status(task, viewer, { orgId }) });
  }
}

export async function renderLmsRoute(input: LmsRouteInput): Promise<PageResult> {
  const { c, segments } = input;
  const q: PageQuery = { notice: one(input.searchParams.notice), error: one(input.searchParams.error) };
  const [a, b, ...rest] = segments;
  if (rest.length) return { kind: "not-found" };
  if (!a) return { kind: "ok", node: await CataloguePage({ c, q }) };
  if (a === "journal" && !b) return JournalPage({ c, q, courseSlug: one(input.searchParams.course), all: one(input.searchParams.all) === "1" });
  if (a === "care" && !b) return { kind: "ok", node: CarePage({ c }) };
  await prepare(input, a, b);
  return b ? StepPage({ c, courseSlug: a, stepSlug: b, q }) : CoursePage({ c, courseSlug: a, q });
}

export async function lmsRouteMetadata(c: LmsConnectors, segments: string[]): Promise<LmsMetadata | null> {
  const [a, b, ...rest] = segments;
  if (!a || rest.length) return null;
  if (a === "journal" || a === "care") return null;
  return b ? stepMetadata(c, a, b) : courseMetadata(c, a);
}
