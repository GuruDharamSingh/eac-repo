import {
  canEditCourse, draftDiff, getCourseBySlug, getDraft, listAuthorOrgs, listEditableCourses, listLooseSteps, listRunGuides, listRuns,
  listStepTypes, stepTypeDef, type OutlineStepRef, type Run, type UnlockRule,
} from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";
import { ActionForm, Flash } from "./parts";
import type { PageQuery, PageResult } from "./pages";

const RULE_WORDS: Record<UnlockRule["kind"], string> = {
  sequential: "In order (after the previous required step)", open: "Always open", after_module: "After a module is done",
  offset_days: "Some days after they begin", date: "On a date",
};
const ruleLine = (s: OutlineStepRef, moduleTitle: (id: string) => string) => {
  const u = s.unlock ?? { kind: "sequential" as const };
  const w = u.kind === "after_module" ? `after “${moduleTitle(u.moduleId)}”` : u.kind === "offset_days" ? `day ${u.days}` : u.kind === "date" ? `from ${u.at.slice(0, 10)}` : u.kind === "open" ? "always open" : "in order";
  return `${s.required === false ? "optional" : "required"} · ${w}`;
};
const toLocalInput = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

// ── /studio ─────────────────────────────────────────────────────────────────
export async function StudioHomePage({ c, q }: { c: LmsConnectors; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studio()) };
  const [courses, orgs] = await Promise.all([listEditableCourses(viewer), listAuthorOrgs(viewer)]);
  if (!courses.length && !orgs.length) return { kind: "not-found" };
  const node = (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker">Studio</span>
        <h1>Your courses</h1>
        <p>Write here as freely as you like. Nothing reaches a reader until you publish, and publishing never changes a lesson under someone who is part-way through it.</p>
      </header>
      <ul className="so-cards">
        {courses.map((k) => (
          <li key={k.id} className="so-card">
            <span className="so-kicker">{k.orgName} · {k.visibility}{k.hasPublished ? "" : " · never published"}</span>
            <h3><a href={c.hrefs.studioCourse(k.slug)}>{k.title}</a></h3>
            {k.summary && <p>{k.summary}</p>}
          </li>
        ))}
      </ul>
      {orgs.length > 0 && (
        <section aria-labelledby="new-h">
          <h2 id="new-h" className="so-h2">Start a course</h2>
          <ActionForm c={c} action="studio-create-course" back={c.hrefs.studio()} className="so-form so-fields">
            <label>Title<input name="title" required maxLength={160} /></label>
            <label>In one line — who is it for, and what changes for them?<input name="summary" maxLength={200} /></label>
            <label>Organization<select name="org">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <button type="submit" className="so-btn">Start</button>
          </ActionForm>
        </section>
      )}
    </main>
  );
  return { kind: "ok", node };
}

// ── /studio/<course> ────────────────────────────────────────────────────────
export async function StudioCoursePage({ c, courseSlug, q }: { c: LmsConnectors; courseSlug: string; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioCourse(courseSlug)) };
  const course = await getCourseBySlug(courseSlug);
  if (!course || !(await canEditCourse(viewer, course))) return { kind: "not-found" };
  const [draft, diff, runs, loose] = await Promise.all([getDraft(viewer, course.id), draftDiff(course.id), listRuns(course.id, { includeClosed: true }), listLooseSteps(course.id)]);
  if (!draft) return { kind: "not-found" };
  const here = c.hrefs.studioCourse(course.slug);
  const stepById = new Map(draft.steps.map((s) => [s.stepId, s]));
  const modules = draft.outline.modules;
  const moduleTitle = (id: string) => modules.find((m) => m.id === id)?.title ?? "a module that’s gone";
  const dirty = diff.neverPublished || diff.changedStepIds.length > 0 || diff.outlineChanged || diff.detailsChanged;
  const needSummaries = course.visibility !== "private" ? diff.missingSummaries : [];
  const types = listStepTypes();
  const guides = await Promise.all(runs.map((r) => listRunGuides(r.id)));
  const F = { course: course.id, courseSlug: course.slug };

  const node = (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker"><a href={c.hrefs.studio()}>Studio</a> · {course.orgName} · {course.visibility}</span>
        <h1>{course.title}</h1>
        <div className="so-hero__act">
          {course.publishedVersionId && <a className="so-btn so-btn--quiet" href={c.hrefs.course(course.slug)}>See it as a reader</a>}
          <a className="so-btn so-btn--quiet" href={c.hrefs.studioPool(course.slug)}>The pool</a>
          <a className="so-btn so-btn--quiet" href={`${c.hrefs.guide()}?course=${course.slug}`}>Guide desk</a>
        </div>
      </header>

      <section className="so-publish" aria-labelledby="pub-h" data-dirty={dirty || undefined}>
        <h2 id="pub-h" className="so-h2">Publish</h2>
        {!dirty ? <p className="so-meta">Readers have everything you’ve written. Nothing is waiting.</p> : (
          <>
            <ul className="so-plain">
              {diff.neverPublished && <li>This course has never been published — no one can read it yet.</li>}
              {diff.detailsChanged && !diff.neverPublished && <li>The title, summary or description changed.</li>}
              {diff.outlineChanged && !diff.neverPublished && <li><strong>The shape changed</strong> (modules, order, or how steps open). Groups already under way keep their version until their guide moves them.</li>}
              {diff.changedStepIds.length > 0 && <li>{diff.changedStepIds.length} step{diff.changedStepIds.length === 1 ? "" : "s"} with new wording: {diff.changedStepIds.map((id) => stepById.get(id)?.title).filter(Boolean).join(", ")}.</li>}
            </ul>
            {needSummaries.length > 0 && <p className="so-flash so-flash--err">Each step of a course people can find needs a one-line summary — it is what search engines and the outline show. Missing: {needSummaries.join(", ")}.</p>}
            {diff.empty ? <p className="so-meta">Add a step first.</p> : (
              <ActionForm c={c} action="studio-publish" back={here} fields={F} className="so-form so-fields">
                <label>A note to yourself about this version (optional)<input name="notes" maxLength={200} /></label>
                <button type="submit" className="so-btn">Publish</button>
              </ActionForm>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="out-h">
        <h2 id="out-h" className="so-h2">Outline</h2>
        <p className="so-meta">Small units, long paths: three to five steps make a course. Every module wants at least one practice — something to do, make or notice.</p>
        {modules.map((m, mi) => (
          <section key={m.id} className="so-smodule">
            <details>
              <summary><span className="so-module__n">{mi + 1}</span> {m.title} <span className="so-meta">· {m.steps.length} step{m.steps.length === 1 ? "" : "s"} · rename, move</span></summary>
              <ActionForm c={c} action="studio-outline" back={here} fields={{ ...F, op: "edit-module", module: m.id }} className="so-form so-fields">
                <label>Module title<input name="title" defaultValue={m.title} required /></label>
                <label>What this module is, in a line<input name="summary" defaultValue={m.summary ?? ""} /></label>
                <button type="submit" className="so-btn so-btn--quiet">Save module</button>
              </ActionForm>
              <div className="so-tools">
                <Mini c={c} back={here} label="↑ Move up" fields={{ ...F, op: "move-module", module: m.id, dir: "-1" }} />
                <Mini c={c} back={here} label="↓ Move down" fields={{ ...F, op: "move-module", module: m.id, dir: "1" }} />
                {m.steps.length === 0 && <Mini c={c} back={here} label="Remove module" fields={{ ...F, op: "remove-module", module: m.id }} />}
              </div>
            </details>
            <ol className="so-ssteps">
              {m.steps.map((s) => {
                const d = stepById.get(s.stepId);
                return (
                  <li key={s.stepId}>
                    <div>
                      <a href={c.hrefs.studioStep(course.slug, s.stepId)}>{d?.title ?? "Untitled"}</a>
                      <span className="so-meta">{stepTypeDef(d?.type ?? "").label} · {ruleLine(s, moduleTitle)}{diff.changedStepIds.includes(s.stepId) ? " · unpublished changes" : ""}</span>
                    </div>
                    <div className="so-tools">
                      <Mini c={c} back={here} label="↑" title={`Move “${d?.title ?? "step"}” up`} fields={{ ...F, op: "move-step", step: s.stepId, dir: "-1" }} />
                      <Mini c={c} back={here} label="↓" title={`Move “${d?.title ?? "step"}” down`} fields={{ ...F, op: "move-step", step: s.stepId, dir: "1" }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <ActionForm c={c} action="studio-outline" back={here} fields={{ ...F, op: "add-step", module: m.id }} className="so-form so-form--row">
              <label className="so-sr" htmlFor={`t-${m.id}`}>New step title</label>
              <input id={`t-${m.id}`} name="title" required placeholder="New step…" />
              <label className="so-sr" htmlFor={`k-${m.id}`}>Kind</label>
              <select id={`k-${m.id}`} name="type">{types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
              <button type="submit" className="so-btn so-btn--quiet">Add step</button>
            </ActionForm>
          </section>
        ))}
        <ActionForm c={c} action="studio-outline" back={here} fields={{ ...F, op: "add-module" }} className="so-form so-form--row">
          <label className="so-sr" htmlFor="newmod">New module title</label>
          <input id="newmod" name="title" required placeholder="New module…" />
          <button type="submit" className="so-btn so-btn--quiet">Add module</button>
        </ActionForm>
        {loose.length > 0 && modules.length > 0 && (
          <details className="so-note">
            <summary>Steps taken out of the outline ({loose.length})</summary>
            <ul className="so-plain">{loose.map((s) => (
              <li key={s.stepId} className="so-tools">
                <a href={c.hrefs.studioStep(course.slug, s.stepId)}>{s.title}</a>
                <Mini c={c} back={here} label={`Put back into “${modules[modules.length - 1].title}”`} fields={{ ...F, op: "send-step", step: s.stepId, module: modules[modules.length - 1].id }} />
              </li>
            ))}</ul>
          </details>
        )}
      </section>

      <section aria-labelledby="det-h">
        <h2 id="det-h" className="so-h2">About the course</h2>
        <ActionForm c={c} action="studio-save-course" back={here} fields={{ course: course.id }} className="so-form so-fields">
          <label>Title<input name="title" defaultValue={course.title} required maxLength={160} /></label>
          <label>Summary — one or two lines; also what search engines show<textarea name="summary" rows={2} maxLength={300} defaultValue={course.summary ?? ""} /></label>
          {c.editor ? <div className="so-field"><span>Description</span><c.editor name="description" defaultValue={course.descriptionHtml ?? ""} ariaLabel="Course description" /></div>
            : <label>Description<textarea name="description" rows={6} defaultValue={course.descriptionHtml ?? ""} /></label>}
          <label>Address: {c.origin}/<input name="slug" defaultValue={course.slug} pattern="[a-z0-9\-]+" /></label>
          <fieldset className="so-vis">
            <legend>Who can find it</legend>
            {([["private", "Private — only your organization’s members, its guides, and people you enrol."], ["unlisted", "Unlisted — anyone with the link can read it; search engines are asked not to index it."], ["public", "Public — listed on the front page, indexed, in the sitemap."]] as const).map(([v, help]) => (
              <label key={v}><input type="radio" name="visibility" value={v} defaultChecked={course.visibility === v} /><span>{help}</span></label>
            ))}
          </fieldset>
          <button type="submit" className="so-btn so-btn--quiet">Save</button>
        </ActionForm>
      </section>

      <section aria-labelledby="runs-h">
        <h2 id="runs-h" className="so-h2">Groups</h2>
        <p className="so-meta">Everyone can always take a published course at their own pace. A group is for walking it together: reflections default to the circle, each step can have a forum conversation, and it can be tied to a gathering that already exists — its RSVPs become the group.</p>
        {runs.map((r, i) => <RunEditor key={r.id} c={c} run={r} back={here} guides={guides[i].map((g) => g.name)} courseSlug={course.slug} />)}
        {course.publishedVersionId ? (
          <details className="so-note">
            <summary>Open a new group</summary>
            <ActionForm c={c} action="studio-create-run" back={here} fields={{ course: course.id }} className="so-form so-fields">
              <label>Name<input name="title" required placeholder="Autumn circle" /></label>
              <label>Kind<select name="mode" defaultValue="cohort"><option value="cohort">Together, with a guide</option><option value="circle">A study circle (peer-led)</option><option value="drip">At their own pace, a little at a time</option></select></label>
              <label>Begins<input type="datetime-local" name="starts" /></label>
              <label>Places (blank = no limit)<input type="number" name="capacity" min={1} /></label>
              <label>A gathering it is tied to — paste its forum link (optional)<input name="thread" /></label>
              <label>Forum category for its conversations (optional)<input name="feed" placeholder="elkdonis-path" /></label>
              <button type="submit" className="so-btn so-btn--quiet">Open group</button>
            </ActionForm>
          </details>
        ) : <p className="so-meta">Publish once before opening a group.</p>}
      </section>
    </main>
  );
  return { kind: "ok", node };
}

function Mini({ c, back, label, title, fields }: { c: LmsConnectors; back: string; label: string; title?: string; fields: Record<string, string> }) {
  return (
    <ActionForm c={c} action="studio-outline" back={back} fields={fields}>
      <button type="submit" className="so-mini" title={title} aria-label={title}>{label}</button>
    </ActionForm>
  );
}

function RunEditor({ c, run, back, guides, courseSlug }: { c: LmsConnectors; run: Run & { enrolled: number }; back: string; guides: string[]; courseSlug: string }) {
  return (
    <details className="so-smodule">
      <summary>{run.title} <span className="so-meta">· {run.isDefault ? "always open" : run.status} · {run.enrolled} enrolled{guides.length ? ` · guided by ${guides.join(", ")}` : ""}</span></summary>
      <ActionForm c={c} action="studio-save-run" back={back} fields={{ run: run.id }} className="so-form so-fields">
        <label>Name<input name="title" defaultValue={run.title} required /></label>
        {!run.isDefault && (
          <label>State<select name="status" defaultValue={run.status}><option value="draft">Draft — not shown to anyone</option><option value="open">Open — people can join</option><option value="closed">Closed — under way, no new joiners</option><option value="archived">Archived</option></select></label>
        )}
        <label>Begins<input type="datetime-local" name="starts" defaultValue={toLocalInput(run.startsAt)} /></label>
        <label>Places (blank = no limit)<input type="number" name="capacity" min={1} defaultValue={run.capacity ?? ""} /></label>
        <label>Who joins<select name="policy" defaultValue={run.enrolPolicy}><option value="open">Anyone who may take the course</option><option value="invite">Only people the guide brings in</option></select></label>
        <label>A new reflection starts as<select name="vis" defaultValue={run.defaultVisibility}><option value="me">Only me</option><option value="guide">My guide</option><option value="circle">My circle</option></select></label>
        <label>Tied to a gathering — forum link or id<input name="thread" defaultValue={run.workshopThreadId ?? ""} /></label>
        <label>Forum category for its conversations<input name="feed" defaultValue={run.discussionFeed ?? ""} /></label>
        <button type="submit" className="so-btn so-btn--quiet">Save group</button>
      </ActionForm>
      <div className="so-tools">
        {run.workshopThreadId && (
          <ActionForm c={c} action="studio-sync-rsvps" back={back} fields={{ run: run.id }}><button type="submit" className="so-btn so-btn--quiet">Bring in everyone who RSVP’d to the gathering</button></ActionForm>
        )}
        {run.discussionFeed && c.createDiscussionThread && (
          <ActionForm c={c} action="open-discussions" back={back} fields={{ run: run.id, course: courseSlug }}><button type="submit" className="so-btn so-btn--quiet">Open a forum conversation for each step</button></ActionForm>
        )}
      </div>
      <ActionForm c={c} action="studio-add-guide" back={back} fields={{ run: run.id }} className="so-form so-form--row">
        <label className="so-sr" htmlFor={`g-${run.id}`}>Guide’s email</label>
        <input id={`g-${run.id}`} type="email" name="email" required placeholder="Add a guide by email…" />
        <button type="submit" className="so-btn so-btn--quiet">Add guide</button>
      </ActionForm>
    </details>
  );
}

// ── /studio/<course>/<stepId> ───────────────────────────────────────────────
export async function StudioStepPage({ c, courseSlug, stepId, q }: { c: LmsConnectors; courseSlug: string; stepId: string; q: PageQuery }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioStep(courseSlug, stepId)) };
  const course = await getCourseBySlug(courseSlug);
  if (!course || !(await canEditCourse(viewer, course))) return { kind: "not-found" };
  const draft = await getDraft(viewer, course.id);
  const step = draft?.steps.find((s) => s.stepId === stepId);
  if (!draft || !step) return { kind: "not-found" };
  const here = c.hrefs.studioStep(course.slug, step.stepId);
  const modules = draft.outline.modules;
  const ref = modules.flatMap((m) => m.steps).find((s) => s.stepId === stepId);
  const inModule = modules.find((m) => m.steps.some((s) => s.stepId === stepId));
  const unlock: UnlockRule = ref?.unlock ?? { kind: "sequential" };
  const def = stepTypeDef(step.type);
  const types = listStepTypes();
  const media = [...(step.refs.media ?? []), { kind: "audio" as const, url: "", title: "", transcript: "" }];
  const F = { course: course.id, courseSlug: course.slug, step: step.stepId };

  const node = (
    <main className="so-page so-page--step">
      <nav className="so-crumbs" aria-label="Breadcrumb"><a href={c.hrefs.studio()}>Studio</a><span aria-hidden> › </span><a href={c.hrefs.studioCourse(course.slug)}>{course.title}</a>{inModule && <><span aria-hidden> › </span>{inModule.title}</>}</nav>
      <Flash {...q} />
      <header className="so-step-head">
        <span className="so-kicker">Editing a step · {def.label}</span>
        <h1>{step.title}</h1>
        <p className="so-meta">This is your working copy. Readers see it when you publish the course.</p>
      </header>
      <ActionForm c={c} action="studio-save-step" back={here} fields={F} className="so-form so-fields">
        <label>Title<input name="title" defaultValue={step.title} required maxLength={200} /></label>
        <label>Kind<select name="type" defaultValue={step.type}>{types.map((t) => <option key={t.type} value={t.type}>{t.label} — {t.describe}</option>)}{!types.some((t) => t.type === step.type) && <option value={step.type}>{step.type}</option>}</select></label>
        <label>Summary — one line; shown in the outline and to search engines<input name="summary" defaultValue={step.summary ?? ""} maxLength={200} /></label>
        <label>Minutes to give it<input type="number" name="minutes" min={0} max={600} defaultValue={step.settings.minutes ?? ""} /></label>
        {c.editor ? <div className="so-field"><span>What to read</span><c.editor name="body" defaultValue={step.bodyHtml ?? ""} ariaLabel="Step body" /></div>
          : <label>What to read<textarea name="body" rows={12} defaultValue={step.bodyHtml ?? ""} placeholder={"Blank lines make paragraphs.\n## makes a heading, > a quotation, - a list."} /></label>}
        <fieldset className="so-group">
          <legend>The practice</legend>
          <p className="so-meta">Every lesson ends in something to do, make or notice. A step with only reading is a draft.</p>
          <label>What to do<textarea name="practice" rows={4} defaultValue={String(step.settings.practice ?? "")} /></label>
          <label>Another way in — a gentler or different version, always offered for a hard practice<textarea name="alternative" rows={2} defaultValue={String(step.settings.alternative ?? "")} /></label>
          <label>A question to reflect on{def.completion === "response" ? " (answering it is what completes this step)" : ""}<textarea name="prompt" rows={2} defaultValue={String(step.settings.prompt ?? "")} /></label>
        </fieldset>
        <fieldset className="so-group">
          <legend>Something that already exists on the network</legend>
          <label>A gathering, event, workshop or forum thread — paste its forum link{def.needsThread ? " (this kind of step needs one)" : ""}<input name="thread" defaultValue={step.refs.threadId ?? ""} placeholder="https://forum.arts-collective.com/t/…" /></label>
        </fieldset>
        <fieldset className="so-group">
          <legend>Audio, video, images, files</legend>
          <p className="so-meta">Paste a link to the file. Give audio and video a transcript: it is how people who can’t listen take part, and what search engines read.</p>
          {media.map((m, i) => (
            <div key={i} className="so-mediarow">
              <label>Kind<select name={`media_kind_${i}`} defaultValue={m.kind}><option value="audio">Audio</option><option value="video">Video</option><option value="image">Image</option><option value="file">File</option></select></label>
              <label>Link{i === media.length - 1 ? " (add another)" : " (clear to remove)"}<input name={`media_url_${i}`} defaultValue={m.url} /></label>
              <label>Title<input name={`media_title_${i}`} defaultValue={m.title ?? ""} /></label>
              <label>Transcript<textarea name={`media_transcript_${i}`} rows={2} defaultValue={m.transcript ?? ""} /></label>
            </div>
          ))}
        </fieldset>
        {(step.refs.links ?? []).length > 0 && (
          <fieldset className="so-group">
            <legend>Links from the pool</legend>
            {step.refs.links!.map((l) => (
              <label key={l.url} className="so-check"><input type="checkbox" name="drop_link" value={l.url} /><span>Remove “{l.title}” <span className="so-meta">{l.url}</span></span></label>
            ))}
          </fieldset>
        )}
        <label>Address: …/{course.slug}/<input name="slug" defaultValue={step.slug} pattern="[a-z0-9\-]+" /></label>
        <div className="so-savebar"><button type="submit" className="so-btn">Save this step</button><a href={c.hrefs.studioCourse(course.slug)}>Back to the outline</a></div>
      </ActionForm>

      <p className="so-meta"><a href={`${c.hrefs.studioPool(course.slug)}?for=${step.stepId}`}>Add something from the course’s pool →</a></p>

      {c.uploadMedia && (
        <section id="media" aria-labelledby="up-h">
          <h2 id="up-h" className="so-h2">Upload a file</h2>
          <p className="so-meta">Audio, video, an image or a document. It is stored in your organization’s media on the collective’s own storage and added to this step. Save the form above first — uploading reloads the page.</p>
          <ActionForm c={c} action="studio-upload" back={here} fields={{ course: course.id, step: step.stepId }} className="so-form so-fields" multipart>
            <label>File<input type="file" name="file" required accept="audio/*,video/*,image/*,.pdf,.txt,.md,.doc,.docx,.odt" /></label>
            <label>Title<input name="title" maxLength={200} /></label>
            <label>Transcript (audio and video)<textarea name="transcript" rows={3} /></label>
            <button type="submit" className="so-btn so-btn--quiet">Upload and add</button>
          </ActionForm>
        </section>
      )}

      {ref && (
        <section aria-labelledby="rule-h">
          <h2 id="rule-h" className="so-h2">When it opens</h2>
          <ActionForm c={c} action="studio-outline" back={here} fields={{ ...F, op: "set-rule" }} className="so-form so-fields">
            <fieldset className="so-vis">
              <legend>Does finishing the course need it?</legend>
              <label><input type="radio" name="required" value="1" defaultChecked={ref.required !== false} /><span>Required</span></label>
              <label><input type="radio" name="required" value="0" defaultChecked={ref.required === false} /><span>Optional — never holds anyone back</span></label>
            </fieldset>
            <label>Opens<select name="rule" defaultValue={unlock.kind}>{(Object.keys(RULE_WORDS) as UnlockRule["kind"][]).map((k) => <option key={k} value={k}>{RULE_WORDS[k]}</option>)}</select></label>
            <label>…which module<select name="after" defaultValue={unlock.kind === "after_module" ? unlock.moduleId : ""}><option value="">—</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
            <label>…how many days<input type="number" name="days" min={0} defaultValue={unlock.kind === "offset_days" ? unlock.days : ""} /></label>
            <label>…which date<input type="date" name="at" defaultValue={unlock.kind === "date" ? unlock.at.slice(0, 10) : ""} /></label>
            <button type="submit" className="so-btn so-btn--quiet">Save when it opens</button>
          </ActionForm>
          <p className="so-meta">Changing this changes the course’s shape: groups already under way keep their version until their guide moves them.</p>
          <div className="so-tools">
            <Mini c={c} back={c.hrefs.studioCourse(course.slug)} label="Take this step out of the outline" fields={{ ...F, op: "remove-step" }} />
          </div>
        </section>
      )}
    </main>
  );
  return { kind: "ok", node };
}

// ── /studio/<course>/pool ───────────────────────────────────────────────────
import { listPool, type PoolItem } from "@elkdonis/lms";

const POOL_KIND: Record<PoolItem["kind"], string> = { thread: "From the network", url: "From the web", media: "A file", note: "A note" };

export async function StudioPoolPage({ c, courseSlug, q }: { c: LmsConnectors; courseSlug: string; q: PageQuery & { find?: string; tag?: string; unused?: string; for?: string; files?: string } }): Promise<PageResult> {
  const viewer = await c.viewer();
  if (!viewer.userId) return { kind: "redirect", to: c.hrefs.signIn(c.hrefs.studioPool(courseSlug)) };
  const course = await getCourseBySlug(courseSlug);
  if (!course || !(await canEditCourse(viewer, course))) return { kind: "not-found" };
  const [items, draft] = await Promise.all([listPool(viewer, course.id, { tag: q.tag, unusedOnly: q.unused === "1" }), getDraft(viewer, course.id)]);
  if (!items || !draft) return { kind: "not-found" };
  const qs = new URLSearchParams(Object.entries({ tag: q.tag, unused: q.unused, for: q.for }).filter(([, v]) => v) as [string, string][]).toString();
  const here = `${c.hrefs.studioPool(course.slug)}${qs ? `?${qs}` : ""}`;
  const hits = q.find && c.searchThreads ? await c.searchThreads(q.find, viewer) : [];
  const files = q.files === "1" && c.listOrgMedia ? await c.listOrgMedia(course.orgId) : [];
  const inPool = new Set(items.flatMap((i) => [i.threadId, i.url]).filter(Boolean));
  const tags = [...new Set(items.flatMap((i) => i.tags))].sort();
  const modules = draft.outline.modules;
  const stepTitle = new Map(draft.steps.map((s) => [s.stepId, s.title]));
  const forStep = q.for && stepTitle.has(q.for) ? q.for : null;
  const F = { course: course.id, courseSlug: course.slug };

  const node = (
    <main className="so-page">
      <Flash {...q} />
      <header className="so-hero">
        <span className="so-kicker"><a href={c.hrefs.studio()}>Studio</a> · <a href={c.hrefs.studioCourse(course.slug)}>{course.title}</a></span>
        <h1>The pool</h1>
        <p>Gather what this course might draw on — threads from anywhere on the network, links from the web, files, loose notes — then pull from here into steps. The pool holds references, not copies, and readers never see it.</p>
        {forStep && <p className="so-callout">Choosing for <strong>{stepTitle.get(forStep)}</strong>. <a href={c.hrefs.studioStep(course.slug, forStep)}>Back to the step</a></p>}
      </header>

      <section aria-labelledby="add-h">
        <h2 id="add-h" className="so-h2">Add</h2>
        <ActionForm c={c} action="pool-add" back={here} fields={F} className="so-form so-fields">
          <label>Paste a link — from the forum, any site on the network, or anywhere on the web. Or just write a note.<textarea name="input" rows={2} required /></label>
          <label>Why it’s here (optional)<input name="note" maxLength={500} /></label>
          <label>Tags, separated by commas (optional)<input name="tags" placeholder="week one, breath, reading" /></label>
          <button type="submit" className="so-btn">Add to the pool</button>
        </ActionForm>
        <div className="so-tools">
          {c.searchThreads && (
            <form method="get" action={c.hrefs.studioPool(course.slug)} className="so-form so-form--row" role="search">
              {forStep && <input type="hidden" name="for" value={forStep} />}
              <label className="so-sr" htmlFor="find">Search the network</label>
              <input id="find" name="find" defaultValue={q.find ?? ""} placeholder="Search the network’s threads…" required />
              <button type="submit" className="so-btn so-btn--quiet">Search</button>
            </form>
          )}
          {c.listOrgMedia && q.files !== "1" && <a className="so-btn so-btn--quiet" href={`${c.hrefs.studioPool(course.slug)}?files=1${forStep ? `&for=${forStep}` : ""}`}>Browse {course.orgName}’s files</a>}
        </div>
        {q.find && (
          <ul className="so-poolhits">
            {hits.length === 0 && <li className="so-empty">Nothing found for “{q.find}”.</li>}
            {hits.map((h) => (
              <li key={h.threadId}>
                <div><strong>{h.title}</strong><span className="so-meta">{h.orgName}</span><span className="so-meta" dangerouslySetInnerHTML={{ __html: h.snippet }} /></div>
                {inPool.has(h.threadId) ? <span className="so-chip">in the pool</span> : (
                  <ActionForm c={c} action="pool-add" back={here} fields={{ ...F, input: h.threadId }}><button type="submit" className="so-mini">Add</button></ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        {q.files === "1" && (
          <ul className="so-poolhits">
            {files.length === 0 && <li className="so-empty">No files in this organization’s media yet.</li>}
            {files.map((f) => (
              <li key={f.url}>
                <div><strong>{f.filename}</strong><span className="so-meta">{f.kind}</span></div>
                {inPool.has(f.url) ? <span className="so-chip">in the pool</span> : (
                  <ActionForm c={c} action="pool-add" back={here} fields={{ ...F, media_url: f.url, media_kind: f.kind, media_title: f.filename }}><button type="submit" className="so-mini">Add</button></ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pool-h">
        <h2 id="pool-h" className="so-h2">In the pool <span className="so-meta">· {items.length}</span></h2>
        <nav className="so-tools" aria-label="Filter">
          <a className="so-chip" href={c.hrefs.studioPool(course.slug)} aria-current={!q.tag && q.unused !== "1" ? "true" : undefined}>All</a>
          <a className="so-chip" href={`${c.hrefs.studioPool(course.slug)}?unused=1`} aria-current={q.unused === "1" ? "true" : undefined}>Not used yet</a>
          {tags.map((t) => <a key={t} className="so-chip" href={`${c.hrefs.studioPool(course.slug)}?tag=${encodeURIComponent(t)}`} aria-current={q.tag === t ? "true" : undefined}>#{t}</a>)}
        </nav>
        {items.length === 0 ? <p className="so-empty">Nothing here yet.</p> : (
          <ul className="so-pool">
            {items.map((it) => (
              <li key={it.id} id={`p-${it.id}`} className="so-poolitem" data-kind={it.kind}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.imageUrl && <img src={it.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                <div className="so-poolitem__main">
                  <span className="so-kicker">{POOL_KIND[it.kind]}{it.thread ? ` · ${it.thread.orgName} · ${it.thread.kind}` : it.siteName ? ` · ${it.siteName}` : it.mediaKind ? ` · ${it.mediaKind}` : ""}</span>
                  <strong>
                    {it.kind === "thread" && it.thread ? <a href={c.hrefs.forumThread(it.threadId!, it.thread.slug)} target="_blank" rel="noopener">{it.title}</a>
                      : it.url ? <a href={it.kind === "media" ? c.mediaUrl(it.url) : it.url} target="_blank" rel="noopener noreferrer">{it.title}</a> : it.title}
                  </strong>
                  {it.kind === "thread" && !it.thread && <span className="so-flash so-flash--err">This thread has gone from the network.</span>}
                  {it.thread && !it.thread.available && <span className="so-meta">Not public — readers who aren’t members of its organization won’t be able to open it.</span>}
                  {it.kind !== "note" && it.description && <span className="so-poolitem__desc">{it.description}</span>}
                  {it.note && it.note !== it.title && <span className="so-poolitem__note">{it.note}</span>}
                  <span className="so-meta">
                    {it.usedIn.length ? <>Used in {it.usedIn.map((u, i) => <span key={u.stepId}>{i > 0 && ", "}<a href={c.hrefs.studioStep(course.slug, u.stepId)}>{u.title}</a></span>)}</> : it.kind === "note" ? "" : "Not used yet"}
                    {it.tags.length > 0 && <> · {it.tags.map((t) => `#${t}`).join(" ")}</>}
                  </span>
                </div>
                <div className="so-poolitem__act">
                  <ActionForm c={c} action="pool-use" back={here} fields={{ ...F, item: it.id }} className="so-form so-form--row">
                    <label className="so-sr" htmlFor={`u-${it.id}`}>Use in</label>
                    <select id={`u-${it.id}`} name="target" defaultValue={forStep ? `step:${forStep}` : ""} required>
                      <option value="" disabled>Use in…</option>
                      <optgroup label="A new step in">{modules.map((m) => <option key={m.id} value={`module:${m.id}`}>{m.title}</option>)}</optgroup>
                      {it.kind !== "note" && <optgroup label="An existing step">{modules.flatMap((m) => m.steps).map((s) => <option key={s.stepId} value={`step:${s.stepId}`}>{stepTitle.get(s.stepId)}</option>)}</optgroup>}
                    </select>
                    <button type="submit" className="so-mini">Use</button>
                  </ActionForm>
                  <details>
                    <summary className="so-meta">Note, tags, remove</summary>
                    <ActionForm c={c} action="pool-edit" back={here} fields={{ item: it.id }} className="so-form so-fields">
                      <label>Title — correct it if the site got it wrong<input name="title" defaultValue={it.title} maxLength={300} /></label>
                      <label>Why it’s here<input name="note" defaultValue={it.kind === "note" ? "" : it.note ?? ""} disabled={it.kind === "note"} /></label>
                      <label>Tags<input name="tags" defaultValue={it.tags.join(", ")} /></label>
                      <div className="so-tools"><button type="submit" className="so-mini">Save</button><button type="submit" name="archive" value="1" className="so-mini">Take out of the pool</button></div>
                    </ActionForm>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
  return { kind: "ok", node };
}
