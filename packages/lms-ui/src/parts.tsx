import type { ReactNode } from "react";
import type { LmsResponse, OutlineStepView, ResponseVisibility } from "@elkdonis/lms";
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

export function StepMeta({ step }: { step: OutlineStepView | { type: string; settings: { minutes?: number }; required: boolean } }) {
  const def = stepTypeDef(step.type);
  return (
    <span className="so-meta">
      {def.label}{step.settings.minutes ? ` · ${step.settings.minutes} min` : ""}{step.required ? "" : " · optional"}
    </span>
  );
}

export const VISIBILITY_WORDS: Record<ResponseVisibility, { label: string; help: string }> = {
  me: { label: "Only me", help: "Kept in your journal. Sophia shows it to no one else — not your guide, not the people who look after the site." },
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
