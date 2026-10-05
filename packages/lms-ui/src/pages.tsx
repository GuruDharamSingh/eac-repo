import {
  courseJsonLd, stepJsonLd, getPublishedCourse, getCourseBySlug, getLearnerOutline, listCatalogue, listRuns, listRunGuides,
  listMyEnrolments, listMyResponses, listCircleResponses, listPublicResponses, getThreadRefs, getRunDiscussion, touchStep,
  listJournal, listPracticeDays, listAwards, listGuideQueue, listRoster, countUnseenAcknowledgements, markAcknowledgementsSeen,
  stepTypeDef, resolveRedirect, listEditableCourses,
  type OutlineStepView, type ResponseVisibility, type Run,
} from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";
import { ActionForm, CourseIndex, Flash, JournalEntryCard, JsonLd, ResponseCard, StepMark, StepMeta, VISIBILITY_WORDS, fmtDate, fmtWhen } from "./parts";
import { StepBody } from "./steps/StepBody";

export interface PageQuery { notice?: string; error?: string }
/** A page either renders, isn't there, or has moved. The host turns these into notFound()/redirect(). */
export type PageResult = { kind: "ok"; node: React.ReactNode } | { kind: "not-found" } | { kind: "redirect"; to: string };

const MODE_WORDS: Record<Run["mode"], string> = {
  open: "At your own pace", drip: "At your own pace, a little at a time", cohort: "Together, with a guide", circle: "A study circle",
};
const seoCtx = (c: LmsConnectors) => ({ origin: c.origin, mediaUrl: c.mediaUrl });
const guideNames = (guides: Array<{ name: string }>) => guides.map((g) => g.name.replace(/\.$/, "")).join(" and ");

/** Every course this viewer can open, for the index: the public catalogue, the ones they're in, the ones they teach. */
async function reachableCourses(viewer: Awaited<ReturnType<LmsConnectors["viewer"]>>): Promise<Array<{ slug: string; title: string }>> {
  const [open, mine, taught] = await Promise.all([
    listCatalogue(),
    viewer.userId ? listMyEnrolments(viewer.userId) : Promise.resolve([]),
    viewer.userId ? listEditableCourses(viewer).catch(() => []) : Promise.resolve([]),
  ]);
  const seen = new Map<string, string>();
  for (const k of open) seen.set(k.slug, k.title);
  for (const e of mine) if (!seen.has(e.courseSlug)) seen.set(e.courseSlug, e.courseTitle);
  for (const k of taught) if (k.hasPublished && !seen.has(k.slug)) seen.set(k.slug, k.title);
  return [...seen].map(([slug, title]) => ({ slug, title }));
}

/** Journal entries and guide-desk items, grouped under their course in the order they first appear. */
function byCourse<T extends { courseSlug: string; courseTitle: string }>(items: T[]): Array<{ slug: string; title: string; items: T[] }> {
  const groups = new Map<string, { slug: string; title: string; items: T[] }>();
  for (const it of items) {
    const g = groups.get(it.courseSlug) ?? { slug: it.courseSlug, title: it.courseTitle, items: [] };
    g.items.push(it);
    groups.set(it.courseSlug, g);
  }
  return [...groups.values()];
}

// ── home / catalogue ────────────────────────────────────────────────────────
export async function CataloguePage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<React.ReactNode> {
  const viewer = await c.viewer();
  const [courses, mine] = await Promise.all([listCatalogue(), viewer.userId ? listMyEnrolments(viewer.userId) : Promise.resolve([])]);
  return (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">Courses</span>
        <h1>All courses</h1>
        <p>{c.site.tagline}</p>
      </header>
      {mine.length > 0 && (
        <section aria-labelledby="yours-h">
          <h2 id="yours-h" className="so-h2">Where you are</h2>
          <ul className="so-cards">
            {mine.map((e) => (
              <li key={e.id} className="so-card">
                <span className="so-kicker">{MODE_WORDS[e.runMode]}</span>
                <h3><a href={c.hrefs.course(e.courseSlug)}>{e.courseTitle}</a></h3>
                <p className="so-meta">{e.status === "completed" ? `Walked through ${fmtDate(e.completedAt!)}` : `Begun ${fmtDate(e.enrolledAt)}`}</p>
                <a className="so-btn" href={c.hrefs.course(e.courseSlug)}>{e.status === "completed" ? "Return" : "Continue"}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="courses-h">
        <h2 id="courses-h" className="so-h2">Courses</h2>
        {courses.length === 0 ? <p className="so-empty">The first course is being prepared.</p> : (
          <ul className="so-cards">
            {courses.map((k) => (
              <li key={k.id} className="so-card">
                <span className="so-kicker">{k.orgName} · {k.stepCount} steps · free</span>
                <h3><a href={c.hrefs.course(k.slug)}>{k.title}</a></h3>
                {k.summary && <p>{k.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// ── course ──────────────────────────────────────────────────────────────────
export async function CoursePage({ c, courseSlug, q }: { c: LmsConnectors; courseSlug: string; q: PageQuery }): Promise<PageResult> {
  const course = await getCourseBySlug(courseSlug);
  if (!course?.publishedVersionId) {
    const moved = await resolveRedirect(courseSlug);
    return moved ? { kind: "redirect", to: c.hrefs.course(moved.courseSlug) } : { kind: "not-found" };
  }
  const viewer = await c.viewer();
  const o = await getLearnerOutline(viewer, { courseId: course.id });
  if (!o) return { kind: "not-found" };
  if (course.visibility === "private" && !o.enrolment && !o.isStaff) return { kind: "not-found" };

  const [runs, guides, courses] = await Promise.all([listRuns(course.id), listRunGuides(o.run.id), reachableCourses(viewer)]);
  const here = c.hrefs.course(course.slug);
  const pc = o.published;
  const finished = o.enrolment?.status === "completed";
  const next = o.continueStep;
  const otherRuns = runs.filter((r) => r.id !== o.run.id && !r.isDefault);
  const showGuide = guides.length > 0 || otherRuns.length > 0 || o.isStaff;
  // Staff: every group of this course (closed ones too), who is in each, and what waits on them.
  const [staffRuns, waiting] = o.isStaff
    ? await Promise.all([
        listRuns(course.id, { includeClosed: true }).then((rs) => Promise.all(rs.map(async (r) => ({ run: r, roster: await listRoster(viewer, r.id) })))),
        listGuideQueue(viewer, { courseId: course.id, awaitingOnly: true }),
      ])
    : [[], []];
  const groups = staffRuns.filter((g) => g.roster);

  const node = (
    <div className={showGuide ? "so-shell so-shell--guide" : "so-shell"}>
    <main className="so-page">
      <JsonLd data={courseJsonLd(seoCtx(c), pc, runs)} />
      <a className="so-tocjump" href="#course-index">Contents</a>
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">{course.orgName} · free{o.enrolment ? ` · ${MODE_WORDS[o.run.mode].toLowerCase()}` : ""}</span>
        <h1>{pc.course.title}</h1>
        {pc.course.summary && <p>{pc.course.summary}</p>}
        <div className="so-hero__act">
          {!o.enrolment ? (
            <>
              <ActionForm c={c} action="begin" back={pc.steps[0] ? c.hrefs.step(course.slug, pc.steps[0].slug) : here} fields={{ course: course.slug }}>
                <button className="so-btn" type="submit">Begin</button>
              </ActionForm>
              {pc.steps[0] && <a className="so-btn so-btn--quiet" href={c.hrefs.step(course.slug, pc.steps[0].slug)}>Read the first step</a>}
            </>
          ) : next ? (
            <a className="so-btn" href={c.hrefs.step(course.slug, next.slug)}>Continue — {next.title}</a>
          ) : (
            <p className="so-done">{finished ? `You walked the whole of it${o.enrolment.completedAt ? `, ${fmtDate(o.enrolment.completedAt)}` : ""}. Everything stays open to return to.` : "Nothing more is open just now."}</p>
          )}
        </div>
        {!viewer.userId && <p className="so-meta">Everything here is free to read. Signing in only keeps your place and your reflections.</p>}
      </header>

      {pc.course.descriptionHtml && <div className="so-prose" dangerouslySetInnerHTML={{ __html: pc.course.descriptionHtml }} />}

      <section aria-labelledby="outline-h">
        <h2 id="outline-h" className="so-h2">The way through</h2>
        {o.modules.map((m) => (
          <section key={m.id} id={m.id} className="so-module">
            <h3>{m.title}</h3>
            {m.summary && <p className="so-module__sum">{m.summary}</p>}
            <ol className="so-steps">
              {m.steps.map((s) => (
                <li key={s.stepId} data-here={o.enrolment && next?.stepId === s.stepId ? "" : undefined}>
                  <StepMark step={s} />
                  <div>
                    <a href={c.hrefs.step(course.slug, s.slug)}>{s.title}</a>
                    {o.enrolment && next?.stepId === s.stepId && <span className="so-here">You are here</span>}
                    <StepMeta step={s} />
                    {s.summary && <p>{s.summary}</p>}
                    {!s.access.allowed && s.access.unlocksAt && <p className="so-meta">{s.access.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </section>

      <footer className="so-foot">
        <a href={c.hrefs.care()}>Taking care while you practise</a>
        {o.enrolment && o.enrolment.status !== "completed" && (
          <ActionForm c={c} action="withdraw" back={here} fields={{ enrolment: o.enrolment.id }}>
            <button type="submit" className="so-linkbtn">Step out of this course</button>
          </ActionForm>
        )}
      </footer>
    </main>

    <nav id="course-index" className="so-side so-side--index" aria-label="Course contents">
      <CourseIndex c={c} courseSlug={course.slug} courseTitle={pc.course.title} modules={o.modules} courses={courses} />
    </nav>

    {showGuide && (
      <aside className="so-side so-side--guide" aria-labelledby="with-h">
        <div className="so-guide">
          <h2 id="with-h" className="so-guide__h">Who you’re with</h2>
          {guides.length > 0
            ? <p>Guided by {guideNames(guides)}. The guide is around, reads what you choose to show them, and answers when there’s something to say. Nothing waits on them.</p>
            : <p>No guide is named for this course yet.</p>}
          {otherRuns.length > 0 && (
            <ul className="so-cards">
              {otherRuns.map((r) => (
                <li key={r.id} className="so-card">
                  <span className="so-kicker">{MODE_WORDS[r.mode]}</span>
                  <h3>{r.title}</h3>
                  <p className="so-meta">{r.startsAt ? `Begins ${fmtDate(r.startsAt)}` : "Open now"}{r.capacity ? ` · ${Math.max(0, r.capacity - r.enrolled)} of ${r.capacity} places open` : ""}</p>
                  <ActionForm c={c} action="begin" back={here} fields={{ run: r.id }}>
                    <button className="so-btn so-btn--quiet" type="submit">Join this group</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </div>
        {o.isStaff && (
          <div className="so-guide so-guide--staff">
            <h2 className="so-guide__h">Your groups</h2>
            <p><a href={c.hrefs.guide(course.slug)}>{waiting.length ? `${waiting.length} ${waiting.length === 1 ? "reflection is" : "reflections are"} waiting on you →` : "Nothing is waiting on you."}</a></p>
            {groups.map(({ run, roster }) => (
              <details key={run.id} className="so-groupsum">
                <summary><strong>{run.title}</strong> <span className="so-meta">· {roster!.length} {roster!.length === 1 ? "person" : "people"}{run.status === "closed" ? " · closed" : ""}</span></summary>
                {roster!.length > 0 ? (
                  <ul className="so-roster">
                    {roster!.map((p) => (
                      <li key={p.enrolmentId}>
                        <span>{p.name}</span>
                        <span className="so-meta">{p.status === "completed" ? "finished" : `${p.done} done`} · {p.lastSeenAt ? `here ${fmtDate(p.lastSeenAt)}` : `began ${fmtDate(p.enrolledAt)}`}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="so-meta">No one yet.</p>}
                {course.publishedVersionId && course.publishedVersionId !== run.courseVersionId && (
                  <ActionForm c={c} action="adopt" back={here} fields={{ run: run.id }}>
                    <button type="submit" className="so-btn so-btn--quiet">Move this group to the latest version</button>
                  </ActionForm>
                )}
                {run.discussionFeed && c.createDiscussionThread && (
                  <ActionForm c={c} action="open-discussions" back={here} fields={{ run: run.id, course: course.slug }}>
                    <button type="submit" className="so-btn so-btn--quiet">Open a forum conversation for each step</button>
                  </ActionForm>
                )}
              </details>
            ))}
          </div>
        )}
      </aside>
    )}
    </div>
  );
  return { kind: "ok", node };
}

// ── step ────────────────────────────────────────────────────────────────────
export async function StepPage({ c, courseSlug, stepSlug, q }: { c: LmsConnectors; courseSlug: string; stepSlug: string; q: PageQuery }): Promise<PageResult> {
  const course = await getCourseBySlug(courseSlug);
  if (!course?.publishedVersionId) {
    const moved = await resolveRedirect(courseSlug);
    return moved ? { kind: "redirect", to: c.hrefs.step(moved.courseSlug, stepSlug) } : { kind: "not-found" };
  }
  const viewer = await c.viewer();
  const o = await getLearnerOutline(viewer, { courseId: course.id });
  if (!o) return { kind: "not-found" };
  if (course.visibility === "private" && !o.enrolment && !o.isStaff) return { kind: "not-found" };
  const step = o.steps.find((s) => s.slug === stepSlug);
  if (!step) {
    const moved = await resolveRedirect(courseSlug, stepSlug);
    return moved?.stepSlug ? { kind: "redirect", to: c.hrefs.step(moved.courseSlug, moved.stepSlug) } : { kind: "not-found" };
  }

  const here = c.hrefs.step(course.slug, step.slug);
  const def = stepTypeDef(step.type);
  const e = o.enrolment;
  // A dated step is genuinely closed. An out-of-order one on an open course is
  // only "ahead": the page is public anyway, so it reads, but doesn't complete.
  const timed = step.unlock.kind === "date" || step.unlock.kind === "offset_days";
  const closed = !step.access.allowed && (timed || course.visibility === "private");
  const ahead = !step.access.allowed && !closed;
  const done = step.status === "completed" || step.status === "waived";
  const community = o.run.mode === "cohort" || o.run.mode === "circle";

  if (e && !closed) await touchStep(viewer, e.id, step.stepId);

  const [threads, mine, circle, shared, discussion, courses] = await Promise.all([
    step.refs.threadId ? getThreadRefs([step.refs.threadId]) : Promise.resolve({}),
    e ? listMyResponses(viewer, e.id, step.stepId) : Promise.resolve([]),
    e && community ? listCircleResponses(viewer, o.run.id, step.stepId) : Promise.resolve([]),
    course.visibility === "public" ? listPublicResponses(step.stepId) : Promise.resolve([]),
    community ? getRunDiscussion(o.run.id, step.stepId) : Promise.resolve(null),
    reachableCourses(viewer),
  ]);
  const thread = step.refs.threadId ? (threads as Record<string, import("@elkdonis/lms").ThreadRef>)[step.refs.threadId] ?? null : null;
  if (mine.some((r) => r.acknowledgements.length) && viewer.userId) void markAcknowledgementsSeen(viewer.userId);

  const prev = o.steps[step.index - 1] ?? null;
  const next = o.steps[step.index + 1] ?? null;
  const nextHref = next ? c.hrefs.step(course.slug, next.slug) : c.hrefs.course(course.slug);
  const reflections = mine.filter((r) => r.kind !== "note");
  const notes = mine.filter((r) => r.kind === "note");
  const othersCircle = circle.filter((r) => r.author?.id !== viewer.userId);
  const othersPublic = shared.filter((r) => r.author?.id !== viewer.userId && !othersCircle.some((x) => x.id === r.id));
  const showReflection = def.invitesReflection || Boolean(step.settings.prompt);
  const defaultVis: ResponseVisibility = o.run.defaultVisibility;
  const visChoices: ResponseVisibility[] = ["me", "guide", ...(community ? (["circle"] as const) : []), ...(course.visibility === "public" ? (["public"] as const) : [])];

  const node = (
    <div className="so-shell">
    <main className="so-page so-page--step">
      {course.visibility === "public" && !closed && <JsonLd data={stepJsonLd(seoCtx(c), o.published, step)} />}
      <a className="so-tocjump" href="#course-index">Contents</a>
      <nav className="so-crumbs" aria-label="Breadcrumb">
        <a href={c.hrefs.course(course.slug)}>{o.published.course.title}</a>
        <span aria-hidden> › </span>
        <a href={`${c.hrefs.course(course.slug)}#${step.moduleId}`}>{step.moduleTitle}</a>
      </nav>
      <Flash {...q} />

      <article>
        <header className="so-step-head">
          <StepMeta step={step} />
          <h1>{step.title}</h1>
          {step.summary && <p className="so-lede">{step.summary}</p>}
        </header>

        {closed ? (
          <p className="so-callout">{step.access.reason} {step.access.unlocksAt ? "It will be here when the day comes." : ""}</p>
        ) : (
          <>
            {ahead && <p className="so-callout">You’re a little ahead of yourself — {step.access.reason?.replace(/^Opens/, "this follows").replace(/\.$/, "")}. Read on if you like; your place is kept where you left it.</p>}
            <StepBody step={step} c={c} thread={thread} />

            {showReflection && (
              <section id="reflection" className="so-reflect" aria-labelledby="reflect-h">
                <h2 id="reflect-h">{step.type === "reflection" ? "Your reflection" : "A few words, if you like"}</h2>
                {step.settings.prompt && <p className="so-prompt">{String(step.settings.prompt)}</p>}
                {reflections.map((r) => <ResponseCard key={r.id} r={r} c={c} back={here} own />)}
                {e ? (
                  !ahead && (
                    <ActionForm c={c} action="respond" back={here} fields={{ enrolment: e.id, step: step.stepId, kind: step.type === "practice" || step.type === "session" ? "practice_log" : "reflection" }} className="so-form">
                      <label className="so-sr" htmlFor="body">Your words</label>
                      <textarea id="body" name="body" rows={6} required placeholder={reflections.length ? "Add to it…" : "Write for yourself first."} />
                      <fieldset className="so-vis">
                        <legend>Who can read this</legend>
                        {visChoices.map((v) => (
                          <label key={v}>
                            <input type="radio" name="visibility" value={v} defaultChecked={v === defaultVis} />
                            <span><strong>{VISIBILITY_WORDS[v].label}</strong> — {VISIBILITY_WORDS[v].help}</span>
                          </label>
                        ))}
                      </fieldset>
                      <input type="hidden" name="next" value={nextHref} />
                      <div className="so-act">
                        {/* One form, so the loud button can never discard what was typed. */}
                        {def.completion === "manual" && !done && (
                          <button type="submit" name="also" value="complete" formNoValidate className="so-btn">{def.doneLabel}</button>
                        )}
                        <button type="submit" className={def.completion === "response" && !done ? "so-btn" : "so-btn so-btn--quiet"}>
                          {def.completion === "response" && !done ? def.doneLabel : "Keep these words"}
                        </button>
                      </div>
                    </ActionForm>
                  )
                ) : (
                  <p className="so-meta">
                    {viewer.userId ? "Begin the course to keep a reflection here." : <><a href={c.hrefs.signIn(here)}>Sign in</a> to keep a reflection here. It stays private unless you choose otherwise.</>}
                  </p>
                )}
              </section>
            )}

            <section className="so-act" aria-label="Your place">
              {!e ? (
                <ActionForm c={c} action="begin" back={here} fields={{ course: course.slug }}>
                  <button className="so-btn" type="submit">{viewer.userId ? "Begin, and keep my place" : "Sign in to keep my place"}</button>
                </ActionForm>
              ) : done ? (
                <a className="so-btn" href={nextHref}>{next ? `Continue — ${next.title}` : "Back to the course"}</a>
              ) : ahead || showReflection ? null : def.completion === "manual" ? (
                <ActionForm c={c} action="complete" back={here} fields={{ enrolment: e.id, step: step.stepId, next: nextHref }}>
                  <button className="so-btn" type="submit">{def.doneLabel}</button>
                </ActionForm>
              ) : null}
            </section>

            {community && e && (
              <section className="so-circle" aria-labelledby="circle-h">
                <h2 id="circle-h">{o.run.title}</h2>
                {discussion?.available && (
                  <p><a className="so-btn so-btn--quiet" href={c.hrefs.forumThread(discussion.id, discussion.slug)}>The conversation on this step · {discussion.replyCount} {discussion.replyCount === 1 ? "reply" : "replies"} →</a></p>
                )}
                {othersCircle.length === 0 ? <p className="so-meta">No one in the circle has shared on this step yet.</p> : othersCircle.map((r) => <ResponseCard key={r.id} r={r} c={c} back={here} own={false} />)}
              </section>
            )}
            {othersPublic.length > 0 && (
              <section className="so-circle" aria-labelledby="shared-h">
                <h2 id="shared-h">Shared by others</h2>
                {othersPublic.map((r) => <ResponseCard key={r.id} r={r} c={c} back={here} own={false} />)}
              </section>
            )}

            {e && (
              <details id="guide" className="so-note" open={notes.length > 0 || undefined}>
                <summary>A private word to your guide</summary>
                <p className="so-meta">If something in this was difficult, confusing or stirred something up, say so here. Only your guide reads it. <a href={c.hrefs.care()}>Taking care while you practise</a>.</p>
                {notes.map((r) => <ResponseCard key={r.id} r={r} c={c} back={here} own />)}
                <ActionForm c={c} action="respond" back={here} fields={{ enrolment: e.id, step: step.stepId, kind: "note" }} className="so-form">
                  <label className="so-sr" htmlFor="note">Your note</label>
                  <textarea id="note" name="body" rows={3} required />
                  <button type="submit" className="so-btn so-btn--quiet">Send to my guide</button>
                </ActionForm>
              </details>
            )}

          </>
        )}
      </article>

      <nav className="so-prevnext" aria-label="Steps">
        {prev ? <a rel="prev" href={c.hrefs.step(course.slug, prev.slug)}><span>Before</span>{prev.title}</a> : <span />}
        {next ? <a rel="next" href={c.hrefs.step(course.slug, next.slug)}><span>After</span>{next.title}</a> : <a href={c.hrefs.course(course.slug)}><span>After</span>Back to the course</a>}
      </nav>
    </main>

    <nav id="course-index" className="so-side so-side--index" aria-label="Course contents">
      <CourseIndex c={c} courseSlug={course.slug} courseTitle={o.published.course.title} modules={o.modules} currentStepId={step.stepId} courses={courses} />
    </nav>

    </div>
  );
  return { kind: "ok", node };
}

// ── journal (your writing; and, for guides, what is waiting on you) ────────
/**
 * One page for everything written in the Education Hub. A guide's queue —
 * what learners chose to show their guide — comes first, because it asks for
 * something; the viewer's own writing follows. The two never mix: the queue
 * holds other people's words, the rest only yours.
 */
export async function JournalPage({ c, q, courseSlug, all }: { c: LmsConnectors; q: PageQuery; courseSlug?: string; all?: boolean }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.journal()) };
  const filterCourse = courseSlug ? await getCourseBySlug(courseSlug) : null;
  const [entries, days, awards, queue, taught] = await Promise.all([
    listJournal(viewer), listPracticeDays(viewer.userId), listAwards(viewer.userId),
    listGuideQueue(viewer, { courseId: filterCourse?.id, awaitingOnly: !all }),
    listEditableCourses(viewer).catch(() => []),
  ]);
  void markAcknowledgementsSeen(viewer.userId);
  const deskCourses = taught.filter((k) => k.hasPublished);
  const guides = deskCourses.length > 0 || queue.length > 0 || Boolean(filterCourse);
  const deskHref = (course?: string | null, withAll = all) => {
    const qs = new URLSearchParams();
    if (course) qs.set("course", course);
    if (withAll) qs.set("all", "1");
    const query = qs.toString();
    return `${c.hrefs.journal()}${query ? `?${query}` : ""}#to-answer`;
  };
  const back = deskHref(filterCourse?.slug);
  const set = new Set(days);
  const journalGroups = byCourse(entries);
  const today = new Date();
  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today.getTime() - (83 - i) * 86_400_000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    return { key, on: set.has(key) };
  });
  const node = (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <h1>Your journal</h1>
        <p>Everything you’ve written here, in one place. It is yours: each entry says who can read it, and removing one really removes it.</p>
      </header>

      {guides && (
        <section id="to-answer" className="so-toanswer" aria-labelledby="ta-h">
          <h2 id="ta-h" className="so-h2">To answer{filterCourse ? ` · ${filterCourse.title}` : ""}</h2>
          <p className="so-meta">What people chose to show you as their guide. Private reflections never appear here. Nothing holds anyone up — answer when there is something to say. <a href={deskHref(filterCourse?.slug, !all)}>{all ? "Only what’s unanswered" : "Include what’s been answered"}</a></p>
          {deskCourses.length > 1 && (
            <nav className="so-chips" aria-label="Your courses">
              <a className="so-chip" href={deskHref(null)} aria-current={!filterCourse ? "true" : undefined}>All courses</a>
              {deskCourses.map((k) => (
                <a key={k.slug} className="so-chip" href={deskHref(k.slug)} aria-current={filterCourse?.slug === k.slug ? "true" : undefined}>{k.title}</a>
              ))}
            </nav>
          )}
          {queue.length === 0 ? <p className="so-empty">{all ? "Nothing has been shown to you yet." : "Nothing is waiting."}</p> : byCourse(queue).map((g) => (
            <section key={g.slug} className="so-bycourse" aria-labelledby={`qh-${g.slug}`}>
              <h3 id={`qh-${g.slug}`} className="so-bycourse__h">
                <a href={c.hrefs.course(g.slug)}>{g.title}</a> <span className="so-meta">· {g.items.length} {g.items.length === 1 ? "entry" : "entries"}</span>
              </h3>
              {g.items.map((r) => (
                <div key={r.id} className="so-entry">
                  <a className="so-kicker" href={c.hrefs.step(r.courseSlug, r.stepSlug)}>{r.runTitle} · {r.stepTitle}</a>
                  <ResponseCard r={r} c={c} back={back} own={false} />
                  <ActionForm c={c} action="acknowledge" back={back} fields={{ response: r.id }} className="so-form so-form--inline">
                    <label className="so-sr" htmlFor={`a-${r.id}`}>Your answer</label>
                    <textarea id={`a-${r.id}`} name="body" rows={2} required placeholder={`A word back to ${r.author?.name ?? "them"}…`} />
                    <button type="submit" className="so-btn so-btn--quiet">Answer</button>
                  </ActionForm>
                </div>
              ))}
            </section>
          ))}
        </section>
      )}

      <section aria-labelledby="days-h">
        <h2 id="days-h" className="so-h2">Days you practised</h2>
        <div className="so-days" role="img" aria-label={`${days.length} days with practice in the last twelve weeks`}>
          {cells.map((d) => <span key={d.key} data-on={d.on || undefined} title={d.key} />)}
        </div>
        <p className="so-meta">The last twelve weeks. A record, not a score — a gap is just a gap.</p>
      </section>
      {awards.length > 0 && (
        <section aria-labelledby="aw-h">
          <h2 id="aw-h" className="so-h2">Completed</h2>
          <ul className="so-plain">{awards.map((a) => <li key={a.id}><strong>{a.name}</strong> · {fmtDate(a.awardedAt)}</li>)}</ul>
        </section>
      )}
      <section aria-labelledby="ent-h">
        <h2 id="ent-h" className="so-h2">{guides ? "Your writing" : "Entries"}</h2>
        {entries.length === 0 ? <p className="so-empty">Nothing written yet.</p> : (
          <>
            {journalGroups.length > 1 && (
              <nav className="so-chips" aria-label="Courses in your journal">
                {journalGroups.map((g) => <a key={g.slug} className="so-chip" href={`#j-${g.slug}`}>{g.title} · {g.items.length}</a>)}
              </nav>
            )}
            {journalGroups.map((g) => (
              <section key={g.slug} id={`j-${g.slug}`} className="so-bycourse" aria-labelledby={`jh-${g.slug}`}>
                <h3 id={`jh-${g.slug}`} className="so-bycourse__h">
                  <a href={c.hrefs.course(g.slug)}>{g.title}</a> <span className="so-meta">· {g.items.length} {g.items.length === 1 ? "entry" : "entries"}</span>
                </h3>
                <div className="so-jentries">
                  {g.items.map((r) => <JournalEntryCard key={r.id} r={r} c={c} back={c.hrefs.journal()} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </section>
    </main>
  );
  return { kind: "ok", node };
}

// ── taking care ─────────────────────────────────────────────────────────────
export function CarePage({ c }: { c: LmsConnectors }): React.ReactNode {
  return (
    <main className="so-page so-page--step">
      <article className="so-prose">
        <h1>Taking care while you practise</h1>
        <p className="so-callout"><strong>If you need help now:</strong> in Canada, call or text <strong>9-8-8</strong> (Suicide Crisis Helpline, any hour). In an emergency call <strong>9-1-1</strong>. Elsewhere, use your local emergency number or crisis line.</p>
        <p>Inner work is not always gentle. Attention turned inward can bring up restlessness, grief, old memories, strong feeling or a sense of unreality. This is known and not rare, and it does not mean you are doing it wrong.</p>
        <h2>What to do</h2>
        <ul>
          <li><strong>Stop or soften.</strong> Open your eyes, move, go outside, eat something, talk to someone. Every practice here can be left half-done.</li>
          <li><strong>Use “another way in”.</strong> Harder practices offer an alternative. Taking it is part of the work, not a lesser version of it.</li>
          <li><strong>Tell your guide.</strong> Every step has “A private word to your guide”. Only they read it.</li>
          <li><strong>Go at your own pace.</strong> Nothing here expires, counts your days or notices a gap.</li>
        </ul>
        <h2>What this is not</h2>
        <p>These courses are teaching and shared practice. They are not therapy, medical care or crisis support, and the guides are not acting as clinicians. If you are in treatment for a mental-health condition, it is sensible to tell whoever is treating you what you are taking up.</p>
        <p><a href={c.hrefs.home()}>Back to {c.site.name}</a></p>
      </article>
    </main>
  );
}

// ── small things the host's chrome needs ────────────────────────────────────
export async function chromeState(c: LmsConnectors): Promise<{ name: string | null; signedIn: boolean; unseen: number; waiting: number; isGuide: boolean }> {
  const v = await c.viewer();
  if (!v.userId) return { name: null, signedIn: false, unseen: 0, waiting: 0, isGuide: false };
  const [unseen, waiting] = await Promise.all([
    countUnseenAcknowledgements(v.userId).catch(() => 0),
    // Reflections waiting on this person as a guide (their orgs' runs, or runs they're named on).
    listGuideQueue(v, { awaitingOnly: true, limit: 99 }).then((q) => q.length).catch(() => 0),
  ]);
  const isGuide = Boolean(v.isGlobalAdmin) || Object.values(v.roles).some((r) => r === "owner" || r === "guide");
  return { name: v.name, signedIn: true, unseen, waiting, isGuide };
}

export type { OutlineStepView };
export { fmtWhen };
