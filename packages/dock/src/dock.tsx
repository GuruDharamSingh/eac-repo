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
 *
 * Dock loop, slice 1 (2026-11-16; docs/open/mcp-foundations/DOCK_LOOP_SLICE1_2026-11-16.md):
 *   Confirm card  every run (a "do" step, a post's Publish, a channel move) asks first; Cancel runs nothing.
 *                 The route resolved the wording for who is looking (draft only in a preview or for an admin).
 *   Route card    a "go" step: Take me there. The server keeps a return ticket, the page opens with
 *                 `?eac-step=<ticket>`, the dock outlines the control (`data-eac-anchor`), and Back to the
 *                 trail is on every page while away.
 *   Done card     a step that just ticked, once, with the next step.
 *   Picker        choose a trail among the person's courses.
 *
 * Channel (2026-11-07): on Channel's inner pages and in the Studio the data also
 * carries the channel's top next move (`channel`), the same move Channel Home's next
 * row shows first; the dock shows it on one line with its registry entry as the button.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { presentAction, type PresentField, type Presentation } from "@elkdonis/actions/present";
import { withTicket } from "@elkdonis/actions/route";
import { CHANNEL_DOCK_ACTIONS, type ActionResult, type ActionStatus, type ChannelNextMove } from "@elkdonis/actions";
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
    kind?: "do" | "go" | "check" | "read";
    task: null | {
      id: string;
      label?: string;
      params: Record<string, string> | null;
      orgId: string | null;
      status: ActionStatus;
      route?: { href: string; anchor: string | null; how: string | null } | null;
      confirm?: { kind: "text" | "draft" | "generic"; text: string; risk: string[]; money: boolean } | null;
    };
  };
  away?: null | { returnHref: string; stepTitle: string | null; anchor: string | null; ticketOk: boolean };
  done?: null | { stepTitle: string; courseSlug: string; nextStepTitle: string | null; courseDone: boolean };
  picker?: null | Array<{ courseSlug: string; title: string; enrolled: boolean; doneRequired: number; totalRequired: number; current: boolean }>;
  post: null | {
    id: string;
    title: string;
    status: string;
    detail: string | null;
    actions: Array<{ id: string; label: string; busyLabel: string; input?: Record<string, unknown> }>;
  };
  /** The channel's top next move (2026-11-07; server/dock.ts DockChannel): Channel's inner pages and the Studio. */
  channel?: null | { label: string; move: ChannelNextMove; more: number; href: string };
  links: { artdirect: string; nextcloud?: string };
}

export type DockRun = (id: string, input?: unknown, opts?: { org?: string | null; subject?: string | null; confirmed?: boolean }) => Promise<ActionResult>;

/** The host's server actions that keep the person's place (arts-collective lib/actions/dock-actions.ts). Optional: without them there is no Take me there. */
export interface DockTrail {
  depart: (courseSlug: string, stepSlug: string, returnPath: string) => Promise<{ ticket: string | null }>;
  back: () => Promise<{ href: string | null }>;
  choose: (courseSlug: string) => Promise<void>;
  ack: () => Promise<void>;
}

/** A run waiting for the person's yes. */
interface Pending {
  key: string;
  id: string;
  input: unknown;
  opts: { org?: string | null; subject?: string | null };
  title: string;
  text: string;
  tag: "draft" | null;
  risk: string[];
}

export interface DockProps {
  /** The host's server action that performs an entry. */
  run: DockRun;
  /** Default `/api/actions/dock`. */
  endpoint?: string;
  /** Paths where the dock never shows. Default: the lesson itself (`/learn`). */
  hiddenOn?: (path: string) => boolean;
  /** Take me there, Back to the trail, the picker and the Done card. */
  trail?: DockTrail;
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

const RISK_WORD: Record<string, string> = { public: "Public", emails: "Sends email", others: "Affects other people", irreversible: "Cannot be undone", money: "Money" };

export function Dock({ run, endpoint = "/api/actions/dock", hiddenOn = defaultHidden, trail }: DockProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [data, setData] = React.useState<DockWire | null>(null);
  const [dismissed, setDismissed] = React.useState(true); // until sessionStorage is read
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [missing, setMissing] = React.useState(false);
  const hidden = hiddenOn(pathname);
  const seq = React.useRef(0);

  React.useEffect(() => {
    setDismissed(readSession(HIDDEN_KEY) === "1");
    setOpen(readSession(OPEN_KEY) === "1");
  }, []);

  const load = React.useCallback(async (withPicker = false) => {
    const n = ++seq.current;
    try {
      const ticket = new URLSearchParams(window.location.search).get("eac-step");
      const q = `path=${encodeURIComponent(pathname)}${ticket ? `&ticket=${encodeURIComponent(ticket)}` : ""}${withPicker ? "&picker=1" : ""}`;
      const res = await fetch(`${endpoint}?${q}`, { credentials: "same-origin", cache: "no-store" });
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

  const outlineAnchor = data?.away?.ticketOk ? data.away.anchor : null;
  React.useEffect(() => {
    if (!outlineAnchor || hidden) return;
    setMissing(false);
    let outlined: Element | null = null;
    const find = () => {
      const all = Array.from(document.querySelectorAll(`[data-eac-anchor="${CSS.escape(outlineAnchor)}"]`));
      return all.find((el) => (el as HTMLElement).getClientRects().length > 0) ?? null;
    };
    const apply = () => {
      const el = find();
      if (!el || el === outlined) return Boolean(el);
      outlined?.removeAttribute("data-eac-outlined");
      outlined = el;
      el.setAttribute("data-eac-outlined", "true");
      el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return true;
    };
    apply();
    const mo = new MutationObserver(() => { apply(); });
    mo.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(() => { if (!outlined) setMissing(true); mo.disconnect(); }, 12000);
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
      outlined?.removeAttribute("data-eac-outlined");
    };
  }, [outlineAnchor, hidden]);

  React.useEffect(() => {
    if (data?.done) setOpen(true);
  }, [data?.done]);

  if (hidden || dismissed || !data || (!data.step && !data.post && !data.channel && !data.away && !data.done && !data.picker)) return null;

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

  /** Ask first: every run goes through the Confirm card (the server also refuses an unconfirmed one). */
  const ask = (key: string, id: string, input: unknown, opts: { org?: string | null; subject?: string | null }, card: { title: string; confirm?: NonNullable<NonNullable<DockWire["step"]>["task"]>["confirm"] | null }) => {
    setMessage(null);
    const c = card.confirm;
    setPending({ key, id, input, opts, title: card.title, text: c?.text ?? `${card.title}. This runs now, on your account.`, tag: c?.kind === "draft" ? "draft" : null, risk: c?.risk ?? [] });
  };

  /** Perform an entry, then read the dock again and refresh the page under it. */
  const perform = async (key: string, id: string, input: unknown, opts: { org?: string | null; subject?: string | null }) => {
    setPending(null);
    setBusy(key);
    setMessage(null);
    const r = await run(id, input, { ...opts, confirmed: true }).catch((): ActionResult => ({ ok: false, error: "Could not reach the server." }));
    setBusy(null);
    if (r.ok === false) setMessage({ kind: "error", text: r.error });
    else setMessage({ kind: "ok", text: "Done." });
    await load();
    router.refresh();
  };

  const { step, post } = data;
  const channel = data.channel ?? null;
  const away = data.away ?? null;
  const done = data.done ?? null;
  const tabLabel = away ? "Back to the trail" : done ? "Step done" : step ? "Your next step" : post ? "This post" : channel ? channel.label : data.picker ? "Choose a trail" : "On your board";

  const goBack = async () => {
    if (!away) return;
    const r = await trail?.back().catch(() => ({ href: null }));
    router.push(r?.href ?? away.returnHref);
    window.setTimeout(() => void load(), 500);
  };
  const depart = async (s: NonNullable<DockWire["step"]>) => {
    const route = s.task?.route;
    if (!route || !trail) return;
    setBusy(`go:${s.stepSlug}`);
    const r = await trail.depart(s.courseSlug, s.stepSlug, pathname + window.location.search).catch(() => ({ ticket: null }));
    setBusy(null);
    router.push(withTicket(route.href, r.ticket));
    // Same-path navigation does not change , so read the dock again for the new departure.
    window.setTimeout(() => void load(), 500);
  };
  const nextStep = async () => {
    await trail?.ack().catch(() => undefined);
    await load();
  };
  const openPicker = () => void load(true);
  const choose = async (slug: string) => {
    await trail?.choose(slug).catch(() => undefined);
    await load();
  };

  return (
    <div className="eac-dock" data-open={open ? "true" : "false"}>
      {open && (
        <section className="eac-dock__box" id="eac-dock-box" aria-label="Your next step and this page">
          <header className="eac-dock__head">
            <span className="eac-dock__eyebrow">{step ? step.courseTitle : post ? "On this page" : channel ? "Channel" : "Your trails"}</span>
            <span className="eac-dock__headbtns">
              <button type="button" className="eac-dock__icon" onClick={toggle} aria-label="Fold the dock away" title="Fold away">–</button>
              <button type="button" className="eac-dock__icon" onClick={dismiss} aria-label="Hide the dock until the browser is closed" title="Hide for this visit">×</button>
            </span>
          </header>
          {pending && <ConfirmCard pending={pending} onConfirm={() => void perform(pending.key, pending.id, pending.input, pending.opts)} onCancel={() => setPending(null)} />}
          {!pending && away && (
            <div className="eac-dock__part eac-dock__away">
              <p className="eac-dock__label">You are away from the trail</p>
              {away.stepTitle && <p className="eac-dock__title">{away.stepTitle}</p>}
              {missing && step?.task?.route?.how && <p className="eac-dock__hint">Look for: {step.task.route.how}</p>}
              <div className="eac-dock__act"><button type="button" className="eac-dock__btn" onClick={() => void goBack()}>Back to the trail</button></div>
            </div>
          )}
          {!pending && done && (
            <div className="eac-dock__part eac-dock__done">
              <p className="eac-dock__label">Done</p>
              <p className="eac-dock__title">{done.stepTitle}</p>
              <p className="eac-dock__detail">{done.courseDone ? "That is the whole trail." : done.nextStepTitle ? `Next: ${done.nextStepTitle}` : "Ticked off."}</p>
              <div className="eac-dock__act">
                {!done.courseDone && <button type="button" className="eac-dock__btn" onClick={() => void nextStep()}>Next step</button>}
                {done.courseDone && <button type="button" className="eac-dock__btn" onClick={() => void nextStep()}>Close</button>}
              </div>
            </div>
          )}
          {!pending && !done && step && <StepPart step={step} links={data.links} busy={busy} ask={ask} depart={() => void depart(step)} onReturn={load} canTravel={Boolean(trail)} here={hereOn(step, pathname)} />}
          {!pending && !done && step && trail && !data.picker && <p className="eac-dock__back"><button type="button" className="eac-dock__link" onClick={openPicker}>Choose a trail</button></p>}
          {!pending && data.picker && (
            <div className="eac-dock__part eac-dock__picker">
              <p className="eac-dock__label">Choose a trail</p>
              <ul className="eac-dock__list">
                {data.picker.map((c) => (
                  <li key={c.courseSlug}>
                    {c.enrolled ? (
                      <button type="button" className={`eac-dock__btn eac-dock__btn--quiet${c.current ? " eac-dock__btn--on" : ""}`} aria-pressed={c.current} onClick={() => void choose(c.courseSlug)}>
                        {c.title} <span className="eac-dock__hint">{c.doneRequired} of {c.totalRequired} done</span>
                      </button>
                    ) : (
                      <a className="eac-dock__btn eac-dock__btn--quiet" href={`/learn/${encodeURIComponent(c.courseSlug)}`}>{c.title} <span className="eac-dock__hint">Begin</span></a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                      <button key={key} type="button" className="eac-dock__btn" disabled={busy !== null} onClick={() => ask(key, a.id, a.input, { subject: post.id }, { title: `${a.label}: ${post.title}` })}>
                        {busy === key ? a.busyLabel : a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {!pending && channel && <ChannelPart channel={channel} busy={busy} ask={ask} />}
          {message && (
            <p className={message.kind === "error" ? "eac-dock__msg eac-dock__msg--error" : "eac-dock__msg"} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
        </section>
      )}
      <button type="button" className="eac-dock__tab" onClick={toggle} aria-expanded={open} aria-controls="eac-dock-box">
        {tabLabel}
        {!away && !done && step?.task && <span className={stateClass(step.task.status)}>{stateWord(step.task.status)}</span>}
      </button>
    </div>
  );
}

/**
 * The channel's one next move, on one line (owner, 2026-11-07: the dock is the surface
 * of the board; one line at a time). The button is the move's registry entry, the same
 * one Channel Home's next row runs; a move without one opens in Channel.
 */
function ChannelPart({ channel, busy, ask }: {
  channel: NonNullable<DockWire["channel"]>;
  busy: string | null;
  ask: (key: string, id: string, input: unknown, opts: { org?: string | null }, card: { title: string }) => void;
}) {
  const { move } = channel;
  const run = move.run && CHANNEL_DOCK_ACTIONS.includes(move.run.id) ? move.run : null;
  const key = `channel:${move.id}`;
  // The quick sheet and the piece pop-up live in Channel's own surface stack; from the
  // dock a Channel address opens the piece there (`?piece=`), other addresses go as named.
  const where = move.href ?? channel.href;
  const whereLabel = where.startsWith("/channel") ? "Open in Channel" : move.open?.label ?? "Open";
  return (
    <div className="eac-dock__part eac-dock__channel">
      <p className="eac-dock__label">
        {channel.label} · {move.kicker}
      </p>
      <p className="eac-dock__line">
        <span className="eac-dock__line-text" title={move.reason ?? undefined}>{move.title}</span>
        {run ? (
          <button type="button" className="eac-dock__btn eac-dock__btn--small" disabled={busy !== null} onClick={() => ask(key, run.id, run.input, { org: null }, { title: `${run.label}: ${move.title}` })}>
            {busy === key ? run.busyLabel : run.label}
          </button>
        ) : (
          <a className="eac-dock__btn eac-dock__btn--small eac-dock__btn--quiet" href={where}>
            {whereLabel}
          </a>
        )}
      </p>
      <p className="eac-dock__back">
        {run ? <a href={where}>{whereLabel}</a> : <a href={channel.href}>Channel</a>}
        {channel.more > 0 && <span className="eac-dock__hint"> · {channel.more} more waiting</span>}
      </p>
    </div>
  );
}

const stateWord = (s: ActionStatus) => (s.done ? "Done" : s.partial ? "Begun" : "Not yet");
const stateClass = (s: ActionStatus) => `eac-dock__state${s.done ? " eac-dock__state--done" : s.partial ? " eac-dock__state--partial" : ""}`;

/** True when the page already shows the step's control (same path and surface). */
function hereOn(step: NonNullable<DockWire["step"]>, pathname: string): boolean {
  const href = step.task?.route?.href;
  if (!href || typeof window === "undefined") return false;
  try {
    const u = new URL(href, window.location.origin);
    const now = new URLSearchParams(window.location.search);
    return u.pathname === pathname && (u.searchParams.get("surface") ?? null) === (now.get("surface") ?? null);
  } catch {
    return false;
  }
}

function ConfirmCard({ pending, onConfirm, onCancel }: { pending: Pending; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="eac-dock__part eac-dock__confirm" role="alertdialog" aria-label="Confirm">
      <p className="eac-dock__label">Are you sure?{pending.tag === "draft" && <span className="eac-dock__draft"> Draft wording, not approved yet</span>}</p>
      <p className="eac-dock__title">{pending.title}</p>
      <p className="eac-dock__detail">{pending.text}</p>
      {pending.risk.length > 0 && (
        <p className="eac-dock__badges">{pending.risk.map((r) => <span key={r} className="eac-dock__badge">{RISK_WORD[r] ?? r}</span>)}</p>
      )}
      <div className="eac-dock__act">
        <button type="button" className="eac-dock__btn" onClick={onConfirm}>Confirm</button>
        <button type="button" className="eac-dock__btn eac-dock__btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function StepPart({ step, links, busy, ask, depart, onReturn, canTravel, here }: {
  step: NonNullable<DockWire["step"]>;
  links: DockWire["links"];
  busy: string | null;
  ask: (key: string, id: string, input: unknown, opts: { org?: string | null }, card: { title: string; confirm?: NonNullable<NonNullable<DockWire["step"]>["task"]>["confirm"] | null }) => void;
  depart: () => void;
  onReturn: () => void;
  canTravel: boolean;
  here: boolean;
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
            onSubmit={(values) => ask(key, task.id, values, { org: task.orgId }, { title: task.label ?? step.stepTitle, confirm: task.confirm })}
          />
        ) : step.kind === "go" && task.route && canTravel ? (
          <div className="eac-dock__act">
            {here ? (
              <span className="eac-dock__hint">You are here.{task.route.how ? ` Look for: ${task.route.how}` : ""}</span>
            ) : (
              <>
                <button type="button" className={task.status.done ? "eac-dock__btn eac-dock__btn--quiet" : "eac-dock__btn"} disabled={busy !== null} onClick={depart}>
                  {busy === `go:${step.stepSlug}` ? "Going…" : task.status.done ? "Open again" : "Take me there"}
                </button>
                {task.route.how && <span className="eac-dock__hint">{task.route.how}</span>}
              </>
            )}
          </div>
        ) : (
          <Control c={c} step={step} done={task.status.done} busy={busy !== null} label={busy === key && c.kind === "run" ? c.busyLabel : null} onRun={() => ask(key, task.id, undefined, { org: task.orgId }, { title: task.label ?? step.stepTitle, confirm: task.confirm })} onReturn={onReturn} />
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
