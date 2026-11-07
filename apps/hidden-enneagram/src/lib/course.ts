import { withOrg } from "@elkdonis/db";
import { courseUrl, siteConfig } from "@/config/site";
import { STATIC_COURSE, type CourseModule, type CourseSummary } from "@/blocks/course-data";

// ============================================================================
// Ario's course, read from the lms tables: the PUBLISHED version's title,
// summary and outline (modules -> steps), so the card's counts follow what
// Sophia serves. Read-only, one query, cached for a minute per process. Any
// failure falls back to STATIC_COURSE (the card never breaks the page).
// The course stays `unlisted`; this reads it, it does not change it.
// ============================================================================

interface Row {
  title: string;
  summary: string | null;
  outline: { modules?: Array<{ title?: string; summary?: string; steps?: Array<{ stepId?: string }> }> } | null;
  slugs: Record<string, string> | null;
}

let cache: { at: number; value: CourseSummary } | null = null;
const TTL_MS = 60_000;

export async function loadCourse(): Promise<CourseSummary> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const rows = await withOrg(siteConfig.orgId, (sql) => sql<Row[]>`
      SELECT v.title, v.summary, v.outline,
             (SELECT jsonb_object_agg(s.id, s.slug) FROM lms_steps s WHERE s.course_id = c.id) AS slugs
        FROM lms_courses c
        JOIN lms_course_versions v ON v.id = c.published_version_id
       WHERE c.org_id = ${siteConfig.orgId}
         AND c.slug = ${siteConfig.courseSlug}
         AND c.archived_at IS NULL
       LIMIT 1
    `);
    const row = rows[0];
    if (!row) return STATIC_COURSE;
    const slugs = row.slugs ?? {};
    const modules: CourseModule[] = (row.outline?.modules ?? []).map((m) => {
      const steps = m.steps ?? [];
      const first = steps[0]?.stepId ? slugs[steps[0].stepId] : undefined;
      return {
        title: m.title ?? "",
        // The outline's summaries end with a full stop; the list reads better without.
        summary: (m.summary ?? "").replace(/\.\s*$/, ""),
        steps: steps.length,
        href: first ? courseUrl(first) : courseUrl(),
      };
    });
    const value: CourseSummary = {
      title: row.title,
      summary: row.summary ?? STATIC_COURSE.summary,
      steps: modules.reduce((n, m) => n + m.steps, 0),
      url: courseUrl(),
      modules,
      live: true,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("[hidden-enneagram] loadCourse:", err);
    return STATIC_COURSE;
  }
}
