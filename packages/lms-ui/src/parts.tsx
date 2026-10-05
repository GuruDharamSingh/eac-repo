import type { ReactNode } from "react";
import type { JournalEntry, LmsResponse, OutlineStepView, Realm, ResponseVisibility } from "@elkdonis/lms";
import { stepTypeDef } from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";

export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
export const fmtWhen = (d: Date | string) =>
  new Date(d).toLocaleString("en-CA", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto", timeZoneName: "short" });

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return <p className={error ? "so-flash so-flash--err" : "so-flash"} role={error ? "alert" : "status"}>{error ?? notice}</p>;
}

export function JsonLd({ data }: { data: object | object[] }) {
  const list = Array.isArray(data) ? data : [data];
  return <>{list.map((d, i) => (
    // JSON.stringify never emits "</script" unescaped once "<" is escaped.
    <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />
  ))}</>;
}

/** A form that posts to the package's action handler. */
export function ActionForm({ c, action, back, children, className, fields, multipart }: {
  c: LmsConnectors; action: string; back: string; children: ReactNode; className?: string; fields?: Record<string, string | null | undefined>; multipart?: boolean;
}) {
  return (
    <form method="post" action={`${c.actionBase}/${action}`} className={className} encType={multipart ? "multipart/form-data" : undefined}>
      <input type="hidden" name="back" value={back} />
      {Object.entries(fields ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {children}
    </form>
  );
}

const MARK: Record<string, string> = { completed: "●", waived: "●", started: "◐" };
export function StepMark({ step }: { step: OutlineStepView }) {
  const done = step.status === "completed" || step.status === "waived";
  const label = done ? "Done" : step.status === "started" ? "Begun" : step.access.allowed ? "Open" : "Not open yet";
  return (
    <span className="so-mark" data-state={done ? "done" : step.status ?? (step.access.allowed ? "open" : "closed")} title={label}>
      <span aria-hidden>{MARK[step.status ?? ""] ?? "○"}</span><span className="so-sr">{label}: </span>
    </span>
  );
}

/** The left-hand index: this course's modules and steps, then every course the viewer can open. */
export function CourseIndex({ c, courseSlug, courseTitle, modules, currentStepId, courses }: {
  c: LmsConnectors;
  courseSlug: string;
  courseTitle: string;
  modules: Array<{ id: string; title: string; steps: OutlineStepView[] }>;
  currentStepId?: string;
  courses: Array<{ slug: string; title: string }>;
}) {
  const courseHref = c.hrefs.course(courseSlug);
  return (
    <div className="so-index">
      <section aria-labelledby="idx-this">
        <h2 id="idx-this" className="so-index__h">This course</h2>
        <a className="so-index__course" href={courseHref} aria-current={currentStepId ? undefined : "page"}>{courseTitle}</a>
        <ol className="so-index__mods">
          {modules.map((m) => (
            <li key={m.id}>
              <a className="so-index__mod" href={`${courseHref}#${m.id}`}>{m.title}</a>
              <ol className="so-index__steps">
                {m.steps.map((s) => (
                  <li key={s.stepId}>
                    <StepMark step={s} />
                    <a href={c.hrefs.step(courseSlug, s.slug)} aria-current={s.stepId === currentStepId ? "page" : undefined}>{s.title}</a>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>
      {courses.length > 0 && (
        <section aria-labelledby="idx-all">
          <h2 id="idx-all" className="so-index__h">All courses</h2>
          <ul className="so-index__courses">
            {courses.map((k) => (
              <li key={k.slug}><a href={c.hrefs.course(k.slug)} aria-current={k.slug === courseSlug ? "true" : undefined}>{k.title}</a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function StepMeta({ step }: { step: OutlineStepView | { type: string; settings: { minutes?: number }; required: boolean } }) {
  const def = stepTypeDef(step.type);
  return (
    <span className="so-meta">
      {def.label}{step.settings.minutes ? ` · ${step.settings.minutes} min` : ""}{step.required ? "" : " · optional"}
    </span>
  );
}

export const VISIBILITY_WORDS: Record<ResponseVisibility, { label: string; help: string }> = {
  me: { label: "Only me", help: "Kept in your journal. The Education Hub shows it to no one else — not your guide, not the people who look after the site." },
  guide: { label: "My guide", help: "Your guide can read it and may answer. No one else." },
  circle: { label: "My circle", help: "The people taking this alongside you, and the guide." },
  public: { label: "Anyone", help: "Shown on this page with your name, on the open web." },
};

export function ResponseCard({ r, c, back, own }: { r: LmsResponse; c: LmsConnectors; back: string; own: boolean }) {
  return (
    <article className="so-response" id={`r-${r.id}`}>
      <header>
        <span className="so-response__who">{own ? "You" : r.author?.name}</span>
        <time dateTime={new Date(r.createdAt).toISOString()}>{fmtDate(r.createdAt)}</time>
        <span className="so-chip" title={VISIBILITY_WORDS[r.visibility].help}>{r.kind === "note" ? "To your guide" : VISIBILITY_WORDS[r.visibility].label}</span>
      </header>
      <p className="so-response__body">{r.body}</p>
      {r.acknowledgements.map((a) => (
        <blockquote key={a.id} className="so-ack">
          <span className="so-ack__who">{a.guideName}</span>
          {a.body && <p>{a.body}</p>}
          {a.audioUrl && <audio controls preload="none" src={c.mediaUrl(a.audioUrl)} />}
        </blockquote>
      ))}
      {own && (
        <details className="so-response__tools">
          <summary className="so-linkbtn">Remove</summary>
          <ActionForm c={c} action="delete-response" back={back} fields={{ response: r.id }}>
            <p className="so-meta">This deletes your words for good{r.acknowledgements.length ? ", along with your guide’s answer" : ""}. It can’t be undone.</p>
            <button type="submit" className="so-btn so-btn--quiet">Yes, remove it</button>
          </ActionForm>
        </details>
      )}
    </article>
  );
}

/**
 * One journal entry, folded to a line: step, date, who can read it, the start
 * of the words. Open it to read the whole, see the guide's answer, edit or
 * remove it. Edits post to the same `respond` action as the step page.
 */
export function JournalEntryCard({ r, c, back }: { r: JournalEntry; c: LmsConnectors; back: string }) {
  const note = r.kind === "note";
  const choices: ResponseVisibility[] = ["me", "guide", ...(r.runMode === "cohort" || r.runMode === "circle" ? (["circle"] as const) : []), ...(r.courseVisibility === "public" ? (["public"] as const) : [])];
  const edited = new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 60_000;
  return (
    <details className="so-jentry" id={`r-${r.id}`}>
      <summary>
        <span className="so-jentry__line">
          <strong>{r.stepTitle}</strong>
          <time dateTime={new Date(r.createdAt).toISOString()}>{fmtDate(r.createdAt)}</time>
          <span className="so-chip" title={VISIBILITY_WORDS[r.visibility].help}>{note ? "To your guide" : VISIBILITY_WORDS[r.visibility].label}</span>
          {r.acknowledgements.length > 0 && <span className="so-jentry__ack">Your guide answered</span>}
        </span>
        <span className="so-jentry__excerpt">{r.body}</span>
      </summary>
      <div className="so-jentry__body">
        <p className="so-response__body">{r.body}</p>
        {edited && <p className="so-meta">Edited {fmtDate(r.updatedAt)}</p>}
        {r.acknowledgements.map((a) => (
          <blockquote key={a.id} className="so-ack">
            <span className="so-ack__who">{a.guideName}</span>
            {a.body && <p>{a.body}</p>}
            {a.audioUrl && <audio controls preload="none" src={c.mediaUrl(a.audioUrl)} />}
          </blockquote>
        ))}
        <div className="so-jentry__tools">
          <a href={c.hrefs.step(r.courseSlug, r.stepSlug)}>Open the step →</a>
          {r.canEdit && (
            <details className="so-jentry__edit">
              <summary className="so-linkbtn">Edit</summary>
              <ActionForm c={c} action="respond" back={back} fields={{ enrolment: r.enrolmentId, step: r.stepId, kind: r.kind, response: r.id }} className="so-form">
                <label className="so-sr" htmlFor={`e-${r.id}`}>Your words</label>
                <textarea id={`e-${r.id}`} name="body" rows={6} required defaultValue={r.body} />
                {!note && (
                  <fieldset className="so-vis">
                    <legend>Who can read this</legend>
                    {choices.map((v) => (
                      <label key={v}>
                        <input type="radio" name="visibility" value={v} defaultChecked={v === r.visibility} />
                        <span><strong>{VISIBILITY_WORDS[v].label}</strong> — {VISIBILITY_WORDS[v].help}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <button type="submit" className="so-btn">Save changes</button>
              </ActionForm>
            </details>
          )}
          <details className="so-response__tools">
            <summary className="so-linkbtn">Remove</summary>
            <ActionForm c={c} action="delete-response" back={back} fields={{ response: r.id }}>
              <p className="so-meta">This deletes your words for good{r.acknowledgements.length ? ", along with your guide’s answer" : ""}. It can’t be undone.</p>
              <button type="submit" className="so-btn so-btn--quiet">Yes, remove it</button>
            </ActionForm>
          </details>
        </div>
      </div>
    </details>
  );
}

// ── Inner / Outer ─────────────────────────────────────────────────────────
export const SIDES: Record<Realm, { kicker: string; title: string; blurb: string }> = {
  inner: {
    kicker: "Inner",
    title: "Spiritual teachings",
    blurb: "Teachings, practices and gatherings for the inner life, from guides teaching in living traditions.",
  },
  outer: {
    kicker: "Outer",
    title: "Art and classes",
    blurb: "Classes and workshops in art, making and the other outer crafts.",
  },
};

/** Inner / Outer / both, as radios named `realm` ("" = both sides). */
export function RealmChoice({ value, legend = "Which side of the hub" }: { value: Realm | null; legend?: string }) {
  return (
    <fieldset className="so-vis">
      <legend>{legend}</legend>
      <label><input type="radio" name="realm" value="inner" defaultChecked={value === "inner"} /><span><strong>Inner</strong> — {SIDES.inner.title.toLowerCase()}</span></label>
      <label><input type="radio" name="realm" value="outer" defaultChecked={value === "outer"} /><span><strong>Outer</strong> — {SIDES.outer.title.toLowerCase()}</span></label>
      <label><input type="radio" name="realm" value="" defaultChecked={!value} /><span><strong>Both</strong> — not sorted yet</span></label>
    </fieldset>
  );
}

