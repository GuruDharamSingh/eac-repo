import { getCourseBySlug, getLearnerOutline } from "@elkdonis/lms";
import { getLmsViewer, ONBOARDING_COURSE_SLUG } from "@/lib/lms/connectors";

/**
 * The hub's course section (phase 5 of the onboarding brief, 2026-10-30):
 * where this person stands on the getting-started course at /learn — one
 * progress line, the modules with their counts, and "Continue" to the first
 * open step not yet done. A signed-in visitor who has not opened the course
 * yet is enrolled on their first visit to it, so the button reads "Begin".
 * Returns null when the course is not published, so the page draws nothing.
 */
export async function CourseCard({ sophia }: { sophia: string | null }) {
  const course = await getCourseBySlug(ONBOARDING_COURSE_SLUG).catch(() => null);
  if (!course?.publishedVersionId) return null;
  const viewer = await getLmsViewer();
  const o = await getLearnerOutline(viewer, { courseId: course.id }).catch(() => null);
  if (!o) return null;

  const isDone = (s: { status: string | null }) => s.status === "completed" || s.status === "waived";
  const modules = o.modules.map((m) => {
    const required = m.steps.filter((s) => s.required);
    const counted = required.length ? required : m.steps;
    return { id: m.id, title: m.title, summary: m.summary, done: counted.filter(isDone).length, total: counted.length, optional: required.length === 0 };
  });
  const pct = o.totalRequired ? Math.round((o.doneRequired / o.totalRequired) * 100) : 0;
  const finished = Boolean(o.enrolment) && o.continueStep === null && o.doneRequired >= o.totalRequired;
  const href = o.continueStep ? `/learn/${course.slug}/${o.continueStep.slug}` : `/learn/${course.slug}`;
  const label = !o.enrolment ? "Begin" : finished ? "Back to the course" : o.doneRequired === 0 ? "Start the first step" : `Continue — ${o.continueStep?.title ?? "the course"}`;

  return (
    <section className="ekh-course" aria-labelledby="ekh-course">
      <div className="ekh-course__intro">
        <span className="ekh-kicker">{!o.enrolment ? "Your way in" : finished ? "Walked" : `${o.doneRequired} of ${o.totalRequired} done`}</span>
        <h2 id="ekh-course">{course.title}</h2>
        <p>{course.summary}</p>
        {o.enrolment && (
          <div className="ekh-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Course progress">
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <ol className="ekh-course__shape">
        {modules.map((m) => (
          <li key={m.id} className={m.done >= m.total && m.total > 0 ? "ekh-course__module ekh-course__module--done" : "ekh-course__module"}>
            <strong>{m.title}</strong>
            <span>{m.summary}{m.summary ? " " : ""}<em className="ekh-course__count">{m.optional ? "optional" : `${m.done}/${m.total}`}</em></span>
          </li>
        ))}
      </ol>
      <div className="ekh-course__foot">
        <p className="ekh-small">
          {finished
            ? "Every required step is done. The optional ones stay open."
            : "Each step does the real thing — the profile you fill in is your profile. Steps tick themselves when done."}
        </p>
        <div className="ekh-welcome__actions">
          <a className="ekh-btn ekh-btn--gold" href={href}>{label}</a>
          {sophia && (
            <a className="ekh-btn ekh-btn--ghost" href={`${sophia}/elkdonis-path`} target="_blank" rel="noopener">The Elkdonis Path</a>
          )}
        </div>
      </div>
    </section>
  );
}
