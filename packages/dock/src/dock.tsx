"use client";

/**
 * The dock (docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md §3.3, shape B; slice 1,
 * 2026-11-06): a corner tab that opens a small box with the signed-in person's
 * current course step (its state and one control) and the actions that apply to
 * the page they are on (a post's Publish / Lead the site).
 *
 * Data from the host's `GET <endpoint>?path=` (arts-collective: /api/actions/dock;
 * 401 signed out and 204 nothing to show both render nothing). Actions run through
 * the host's server action `run` (arts-collective: runDockAction → runAction, via
 * 'app'), then the data is read again and the page refreshed.
 *
 * The control is the registry's (`presentAction`). Surfaces and frames need the
 * lesson's surface stack, so for those the dock links to the lesson step instead.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { presentAction, type PresentField, type Presentation } from "@elkdonis/actions/present";
import type { ActionResult, ActionStatus } from "@elkdonis/actions";
import "./dock.css";

/** The route's JSON (packages/actions/src/server/dock.ts `DockData`; kept in step by hand: that file is server-only). */
export interface DockWire {
  step: null | {
    courseSlug: string;
    courseTitle: string;
    stepSlug: string;
    stepTitle: string;
    href: string;
    doneRequired: number;
    totalRequired: number;
    task: null | { id: string; params: Record<string, string> | null; orgId: string | null; status: ActionStatus };
  };
  post: null | {
    id: string;
    title: string;
    status: string;
    detail: string | null;
    actions: Array<{ id: string; label: string; busyLabel: string; input?: Record<string, unknown> }>;
  };
  links: { artdirect: string; nextcloud?: string };
}

export type DockRun = (id: string, input?: unknown, opts?: { org?: string | null; subject?: string | null }) => Promise<ActionResult>;

export interface DockProps {
  /** The host's server action that performs an entry. */
  run: DockRun;
  /** Default `/api/actions/dock`. */
  endpoint?: string;
  /** Paths where the dock never shows. Default: the lesson itself (`/learn`). */
  hiddenOn?: (path: string) => boolean;
}

const HIDDEN_KEY = "eac-dock-hidden";
const OPEN_KEY = "eac-dock-open";

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts until the page is left */
  }
}

const defaultHidden = (path: string) => path === "/learn" || path.startsWith("/learn/");

export function Dock({ run, endpoint = "/api/actions/dock", hiddenOn = defaultHidden }: DockProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [data, setData] = React.useState<DockWire | null>(null);
  const [dismissed, setDismissed] = React.useState(true); // until sessionStorage is read
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const hidden = hiddenOn(pathname);
  const seq = React.useRef(0);

  React.useEffect(() => {
    setDismissed(readSession(HIDDEN_KEY) === "1");
    setOpen(readSession(OPEN_KEY) === "1");
  }, []);

  const load = React.useCallback(async () => {
    const n = ++seq.current;
    try {
      const res = await fetch(`${endpoint}?path=${encodeURIComponent(pathname)}`, { credentials: "same-origin", cache: "no-store" });
      if (n !== seq.current) return;
      setData(res.status === 200 ? ((await res.json()) as DockWire) : null);
    } catch {
      if (n === seq.current) setData(null);
    }
  }, [endpoint, pathname]);

  React.useEffect(() => {
    setMessage(null);
    if (hidden || dismissed) return;
    void load();
  }, [hidden, dismissed, load]);

  if (hidden || dismissed || !data || (!data.step && !data.post)) return null;

  const toggle = () => {
    setOpen((o) => {
      writeSession(OPEN_KEY, o ? null : "1");
      return !o;
    });
  };
  const dismiss = () => {
    writeSession(HIDDEN_KEY, "1");
    setDismissed(true);
  };

  /** Perform an entry, then read the dock again and refresh the page under it. */
  const perform = async (key: string, id: string, input: unknown, opts: { org?: string | null; subject?: string | null }) => {
    setBusy(key);
    setMessage(null);
    const r = await run(id, input, opts).catch((): ActionResult => ({ ok: false, error: "Could not reach the server." }));
    setBusy(null);
    if (r.ok === false) setMessage({ kind: "error", text: r.error });
    else setMessage({ kind: "ok", text: "Done." });
    await load();
    router.refresh();
  };

  const { step, post } = data;
  const tabLabel = step ? "Your next step" : "This post";

  return (
    <div className="eac-dock" data-open={open ? "true" : "false"}>
      {open && (
        <section className="eac-dock__box" id="eac-dock-box" aria-label="Your next step and this page">
          <header className="eac-dock__head">
            <span className="eac-dock__eyebrow">{step ? step.courseTitle : "On this page"}</span>
            <span className="eac-dock__headbtns">
              <button type="button" className="eac-dock__icon" onClick={toggle} aria-label="Fold the dock away" title="Fold away">–</button>
              <button type="button" className="eac-dock__icon" onClick={dismiss} aria-label="Hide the dock until the browser is closed" title="Hide for this visit">×</button>
            </span>
          </header>
          {step && <StepPart step={step} links={data.links} busy={busy} perform={perform} onReturn={load} />}
          {post && (
            <div className="eac-dock__part eac-dock__post">
              <p className="eac-dock__label">This post</p>
              <p className="eac-dock__title">{post.title}</p>
              {post.detail && <p className="eac-dock__detail">{post.detail}</p>}
              {post.actions.length > 0 && (
                <div className="eac-dock__act">
                  {post.actions.map((a) => {
                    const key = `post:${a.id}:${JSON.stringify(a.input ?? null)}`;
                    return (
                      <button key={key} type="button" className="eac-dock__btn" disabled={busy !== null} onClick={() => perform(key, a.id, a.input, { subject: post.id })}>
                        {busy === key ? a.busyLabel : a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {message && (
            <p className={message.kind === "error" ? "eac-dock__msg eac-dock__msg--error" : "eac-dock__msg"} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
        </section>
      )}
      <button type="button" className="eac-dock__tab" onClick={toggle} aria-expanded={open} aria-controls="eac-dock-box">
        {tabLabel}
        {step?.task && <span className={stateClass(step.task.status)}>{stateWord(step.task.status)}</span>}
      </button>
    </div>
  );
}

const stateWord = (s: ActionStatus) => (s.done ? "Done" : s.partial ? "Begun" : "Not yet");
const stateClass = (s: ActionStatus) => `eac-dock__state${s.done ? " eac-dock__state--done" : s.partial ? " eac-dock__state--partial" : ""}`;

function StepPart({ step, links, busy, perform, onReturn }: {
  step: NonNullable<DockWire["step"]>;
  links: DockWire["links"];
  busy: string | null;
  perform: (key: string, id: string, input: unknown, opts: { org?: string | null }) => Promise<void>;
  onReturn: () => void;
}) {
  const task = step.task;
  const c: Presentation | null = task ? presentAction({ id: task.id, status: task.status, orgId: task.orgId, links, params: task.params }) : null;
  const key = task ? `step:${task.id}` : "";
  return (
    <div className="eac-dock__part">
      <p className="eac-dock__label">
        Next step · {step.doneRequired} of {step.totalRequired} done
      </p>
      <p className="eac-dock__title">{step.stepTitle}</p>
      {task && (
        <p className="eac-dock__row">
          <span className={stateClass(task.status)}>{stateWord(task.status)}</span>
          {task.status.detail && <span className="eac-dock__detail">{task.status.detail}</span>}
        </p>
      )}
      {task && c && (
        c.kind === "form" ? (
          <DockForm
            key={JSON.stringify(task.status.values ?? {})}
            fields={c.fields}
            values={task.status.values ?? {}}
            label={busy === key ? c.busyLabel : c.label}
            busy={busy !== null}
            onSubmit={(values) => perform(key, task.id, values, { org: task.orgId })}
          />
        ) : (
          <Control c={c} step={step} done={task.status.done} busy={busy !== null} label={busy === key && c.kind === "run" ? c.busyLabel : null} onRun={() => perform(key, task.id, undefined, { org: task.orgId })} onReturn={onReturn} />
        )
      )}
      <p className="eac-dock__back">
        <a href={step.href}>Back to the lesson</a>
      </p>
    </div>
  );
}

function Control({ c, step, done, busy, label, onRun, onReturn }: {
  c: Exclude<Presentation, { kind: "form" }>;
  step: NonNullable<DockWire["step"]>;
  done: boolean;
  busy: boolean;
  label: string | null;
  onRun: () => void;
  onReturn: () => void;
}) {
  const cls = done ? "eac-dock__btn eac-dock__btn--quiet" : "eac-dock__btn";
  switch (c.kind) {
    // A surface or a framed page opens over the lesson, which has the surface stack.
    case "surface":
    case "frame":
      return (
        <div className="eac-dock__act">
          <a className={cls} href={step.href}>{c.label}</a>
          <span className="eac-dock__hint">Opens in the lesson.</span>
        </div>
      );
    case "link":
      return (
        <div className="eac-dock__act">
          <a className={cls} href={c.href} {...(c.external ? { target: "_blank", rel: "noopener" } : {})}>{c.label}{c.external ? " ↗" : ""}</a>
        </div>
      );
    case "popup":
      return (
        <div className="eac-dock__act">
          <a
            className={cls}
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
                  onReturn();
                }
              }, 800);
            }}
          >
            {c.label} ↗
          </a>
          {c.hint && <span className="eac-dock__hint">{c.hint}</span>}
        </div>
      );
    case "run":
      return done ? null : (
        <div className="eac-dock__act">
          <button type="button" className="eac-dock__btn" disabled={busy} onClick={onRun}>{label ?? c.label}</button>
        </div>
      );
    case "none":
      return <p className="eac-dock__hint">{c.hint}</p>;
    default:
      return null;
  }
}

function DockForm({ fields, values, label, busy, onSubmit }: {
  fields: PresentField[];
  values: Record<string, string>;
  label: string;
  busy: boolean;
  onSubmit: (values: Record<string, string>) => void;
}) {
  return (
    <form
      className="eac-dock__form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit(Object.fromEntries(fields.map((f) => [f.name, String(fd.get(f.name) ?? "")])));
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="eac-dock__field">
          <span>{f.label}</span>
          <input name={f.name} type={f.type} defaultValue={values[f.name] ?? ""} maxLength={f.maxLength} placeholder={f.placeholder} />
        </label>
      ))}
      <div className="eac-dock__act">
        <button type="submit" className="eac-dock__btn" disabled={busy}>{label}</button>
      </div>
    </form>
  );
}
