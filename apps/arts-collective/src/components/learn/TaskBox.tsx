"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import type { LmsTaskBoxProps } from "@elkdonis/lms-ui";
import { presentAction, type PresentField, type Presentation } from "@elkdonis/actions/present";
import { runAction } from "@/lib/actions/run";
import { LEARN_FRAME, useLearnOrg } from "./LearnHost";

/**
 * The box under a task step: where the person stands, and the one control
 * that does the thing — here, in this host's own surface (the profile popup,
 * a journey dialog, the artwork queue, the org's composer, the Studio framed
 * over the lesson), a small form in the step, a window for a site that
 * cannot be framed, or a button that performs it through the action registry
 * (`runAction`). Which control each task gets is the registry's
 * (@elkdonis/actions/present, since 2026-11-06). When a dialog or window
 * closes the page refreshes and the step re-reads its state.
 */

const LINKS = {
  artdirect: (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, ""),
  nextcloud: (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "") || undefined,
};

export function TaskBox(p: LmsTaskBoxProps) {
  const surfaces = useSurfaceOptional();
  const learnOrg = useLearnOrg();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const { status } = p;
  const c = presentAction({ id: p.task.id, status, orgId: p.orgId, links: LINKS, params: p.task.params });

  // When a dialog opened from here closes, the page re-reads the task.
  React.useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const state = status.done ? "Done" : status.partial ? "Begun" : "Not yet";
  const stateClass = status.done ? "so-task__state so-task__state--done" : status.partial ? "so-task__state so-task__state--partial" : "so-task__state";

  if (!p.signedIn) {
    return (
      <>
        <p className={stateClass}><span>{state}</span></p>
        <p className="so-task__detail">This is something you do on your own account.</p>
        <div className="so-task__act"><a className="so-btn" href={p.signInHref}>Sign in to do this</a></div>
      </>
    );
  }

  const btn = status.done ? "so-btn so-btn--quiet" : "so-btn";

  /** Perform the entry through the registry; `values` for a form. */
  const run = async (values?: Record<string, string>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await runAction(p.task.id, values, { org: p.orgId }).catch(() => ({ ok: false as const, error: "Could not reach the server." }));
    setBusy(false);
    if (r.ok === false) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  };

  return (
    <>
      <p className={stateClass}><span>{state}</span>{status.done && status.href && <a href={status.href} target={status.href.startsWith("http") ? "_blank" : undefined} rel="noopener">See it →</a>}</p>
      {status.detail && <p className="so-task__detail">{status.detail}</p>}
      {!p.enrolled && <p className="so-meta">Begin the course below to have this recorded.</p>}
      {c.kind === "form" ? (
        <TaskForm key={JSON.stringify(status.values ?? {})} fields={c.fields} values={status.values ?? {}} label={busy ? c.busyLabel : c.label} busy={busy} onSubmit={run} hint={c.hint} note={c.note} saved={saved} />
      ) : (
        <div className="so-task__act">
          <Control c={c} btn={btn} done={status.done} busy={busy} canOpen={(d) => canOpen(d, surfaces !== null, learnOrg, p.orgId)} open={(d) => surfaces?.open(d)} onRun={() => run()} onClosed={() => router.refresh()} />
          {c.hint && <span className="so-meta">{c.hint}</span>}
          {c.note && <span className="so-meta">{c.note}</span>}
        </div>
      )}
      {error && <p className="so-meta" role="alert">{error}</p>}
    </>
  );
}

/** A compose surface opens only for the org this stack composes for; anything else needs a surface stack at all. */
function canOpen(d: SurfaceDescriptor, hasStack: boolean, learnOrg: ReturnType<typeof useLearnOrg>, orgId: string | null): boolean {
  if (!hasStack) return false;
  if (d.type === "compose") return Boolean(learnOrg?.canCompose && orgId && learnOrg.orgId === orgId);
  return true;
}

function Control({ c, btn, done, busy, canOpen, open, onRun, onClosed }: {
  c: Exclude<Presentation, { kind: "form" }>;
  btn: string;
  done: boolean;
  busy: boolean;
  canOpen: (d: SurfaceDescriptor) => boolean;
  open: (d: SurfaceDescriptor) => void;
  onRun: () => void;
  onClosed: () => void;
}) {
  switch (c.kind) {
    case "surface":
      if (canOpen(c.descriptor)) {
        return <button type="button" className={btn} onClick={() => open(c.descriptor)}>{done && c.descriptor.type !== "compose" ? "Open again" : c.label}</button>;
      }
      if (c.fallback) return <a className={btn} href={c.fallback.href}>{c.fallback.label}</a>;
      if (c.descriptor.type === "compose") return null;
      return <a className="so-btn" href={`/hub/network?surface=${encodeURIComponent(serialize(c.descriptor))}`}>{c.label}</a>;
    case "link":
      return <a className={btn} href={c.href} {...(c.external ? { target: "_blank", rel: "noopener" } : {})}>{c.label}{c.external ? " ↗" : ""}</a>;
    case "frame": {
      const d: SurfaceDescriptor = { type: "custom", key: LEARN_FRAME, title: c.title, size: "full", props: { src: c.src } };
      return canOpen(d)
        ? <button type="button" className={btn} onClick={() => open(d)}>{c.label}</button>
        : <a className={btn} href={c.src}>{c.label}</a>;
    }
    case "popup":
      return (
        <a
          className={btn}
          href={c.href}
          target="_blank"
          rel="noopener"
          onClick={(e) => {
            const w = window.open(c.href, "eac-task", "popup,width=560,height=760");
            if (!w) return; // blocked: the link opens a tab instead
            e.preventDefault();
            const timer = window.setInterval(() => {
              if (w.closed) {
                window.clearInterval(timer);
                onClosed();
              }
            }, 800);
          }}
        >
          {c.label} ↗
        </a>
      );
    case "run":
      return done ? null : <button type="button" className="so-btn" disabled={busy} onClick={onRun}>{busy ? c.busyLabel : c.label}</button>;
    default:
      return null;
  }
}

/** The step's own small form: the fields the registry names, prefilled from the task's current values. */
function TaskForm({ fields, values, label, busy, onSubmit, hint, note, saved }: {
  fields: PresentField[];
  values: Record<string, string>;
  label: string;
  busy: boolean;
  onSubmit: (values: Record<string, string>) => void;
  hint?: string;
  note?: string;
  saved: boolean;
}) {
  return (
    <form
      className="so-task__form so-form so-fields"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit(Object.fromEntries(fields.map((f) => [f.name, String(fd.get(f.name) ?? "")])));
      }}
    >
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          <input name={f.name} type={f.type} defaultValue={values[f.name] ?? ""} maxLength={f.maxLength} placeholder={f.placeholder} />
        </label>
      ))}
      <div className="so-task__act">
        <button type="submit" className="so-btn" disabled={busy}>{label}</button>
        {saved && !busy && <span className="so-meta" role="status">Saved.</span>}
        {hint && <span className="so-meta">{hint}</span>}
        {note && <span className="so-meta">{note}</span>}
      </div>
    </form>
  );
}

/** The profile and journey descriptors as the URL scheme spells them (surface/url.ts). */
function serialize(d: SurfaceDescriptor): string {
  if (d.type === "profile") return d.tab ? `profile:${d.tab}` : "profile";
  if (d.type === "journey") return d.orgId ? `journey:${d.id}:${d.orgId}` : `journey:${d.id}`;
  if (d.type === "artwork") return "artwork";
  return "profile";
}
