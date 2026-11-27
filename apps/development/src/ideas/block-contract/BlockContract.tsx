"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as RMouseEvent } from "react";
import {
  CONTRACT,
  NOTES,
  ROLES,
  RULES,
  TEXT_STYLES,
  TOOLBARS,
  TOUR_CARDS_CODE,
  TOUR_CARDS_ID,
  appLabel,
  type BlockRow,
  type Role,
  type Status,
  type Target,
} from "./data";
import "./block-contract.css";

// ============================================================================
// The block contract (Manjushri, 2026-11-23): what a block tells the editor, what the editor may do, and the stages a
// block grows through. Numbers come from src/data/block-contract.json (scripts/refresh-block-contract.mjs).
// Answers and choices are kept in this browser's localStorage only; nothing here changes a site.
// ============================================================================

const KEY = "bc:v1";
const SHOW = 30;

interface Saved { notes: boolean; answers: Record<string, { pick?: string; text?: string }>; pencils: boolean; role: Role }
const fresh = (): Saved => ({ notes: true, answers: {}, pencils: false, role: "owner" });

// ---- pins ------------------------------------------------------------------------------------------------------------

type Answers = Saved["answers"];
const PinCtx = createContext<{ on: boolean; open: string[]; toggle: (id: string) => void; answers: Answers; answer: (id: string, a: { pick?: string; text?: string }) => void }>({
  on: true, open: [], toggle: () => {}, answers: {}, answer: () => {},
});
const noteOf = (id: string) => NOTES.find((n) => n.id === id)!;

function Pin({ id }: { id: string }) {
  const { on, open, toggle, answers } = useContext(PinCtx);
  if (!on) return null;
  const isOpen = open.includes(id);
  const done = !!(answers[id]?.pick || answers[id]?.text);
  return (
    <button type="button" className={`bc-pin${done ? " is-done" : ""}`} aria-expanded={isOpen} aria-controls={`note-${id}`} aria-label={`Question ${id}: ${noteOf(id).where}${done ? " (answered)" : ""}`} onClick={() => toggle(id)} data-pin={id}>
      <span>{id}</span>
    </button>
  );
}
function AnswerBox({ id }: { id: string }) {
  const { answers, answer } = useContext(PinCtx);
  const n = noteOf(id);
  const a = answers[id] ?? {};
  return (
    <div className="bc-answer">
      {n.choices ? (
        <div className="bc-seg" role="group" aria-label={`Answer to ${id}`}>
          {n.choices.map((c) => (
            <button key={c} type="button" aria-pressed={a.pick === c} onClick={() => answer(id, { ...a, pick: a.pick === c ? undefined : c })}>{c}</button>
          ))}
        </div>
      ) : null}
      <label className="bc-sr" htmlFor={`ans-${id}`}>Your words for {id}</label>
      <textarea id={`ans-${id}`} rows={2} placeholder="In your own words, if you want" value={a.text ?? ""} onChange={(e) => answer(id, { ...a, text: e.target.value })} />
    </div>
  );
}
function PinNote({ id }: { id: string }) {
  const { on, open } = useContext(PinCtx);
  if (!on || !open.includes(id)) return null;
  return (
    <aside className="bc-note" id={`note-${id}`} role="note" data-note={id}>
      <p><strong>{id}</strong> {noteOf(id).text}</p>
      <AnswerBox id={id} />
    </aside>
  );
}
function Head({ title, pin, children }: { title: string; pin?: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="bc-head">
        <h2>{title}</h2>
        {pin ? <Pin id={pin} /> : null}
      </div>
      {children}
      {pin ? <PinNote id={pin} /> : null}
    </>
  );
}

// ---- helpers over the scan -------------------------------------------------------------------------------------------

const B = CONTRACT.blocks;
const total = B.length;
const stageHere = (n: number) => B.filter((b) => (n === 5 ? b.settings.places > 0 : b.stage === n)).length;
const ruleName = (id: string) => CONTRACT.rules.find((r) => r.id === id)?.name ?? id;
const mark: Record<Status, string> = { pass: "Passes", fail: "Fails", unknown: "Cannot tell", na: "Not applicable" };
const tourCards = B.find((b) => b.id === TOUR_CARDS_ID)!;

// ---- the page --------------------------------------------------------------------------------------------------------

export function BlockContract() {
  const [saved, setSaved] = useState<Saved>(fresh);
  const [open, setOpen] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stage, setStage] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [app, setApp] = useState("");
  const [rule, setRule] = useState("");
  const [shown, setShown] = useState(SHOW);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setSaved({ ...fresh(), ...(p && typeof p === "object" ? p : {}) });
      }
    } catch { /* storage blocked or unreadable: the page works without it */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved, loaded]);

  const say = (t: string) => {
    setStatus(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 4000);
  };
  const toggle = useCallback((id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])), []);
  const answer = useCallback((id: string, a: { pick?: string; text?: string }) => setSaved((s) => ({ ...s, answers: { ...s.answers, [id]: a } })), []);

  const back = () => {
    setSaved(fresh());
    setOpen([]);
    setStage(null); setQ(""); setApp(""); setRule(""); setShown(SHOW);
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    say("Cleared. Back to the start.");
  };

  const summary = () => {
    const lines = NOTES.map((n) => {
      const a = saved.answers[n.id];
      const ans = [a?.pick, a?.text?.trim()].filter(Boolean).join(" / ");
      return `${n.id} ${n.where}: ${ans || "(not answered)"}`;
    });
    return ["My answers on the block contract page (nothing here changes a site)", ...lines].join("\n");
  };
  const copy = async () => {
    const text = summary();
    try {
      await navigator.clipboard.writeText(text);
      say("Copied. Paste it to Manjushri.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        say(ok ? "Copied. Paste it to Manjushri." : "Could not copy here. Your answers are listed at the end of the page.");
      } catch { say("Could not copy here. Your answers are listed at the end of the page."); }
    }
  };

  // ---- the list
  const apps = useMemo(() => Object.keys(CONTRACT.apps).sort(), []);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return B.filter((b) => {
      if (stage !== null && (stage === 5 ? b.settings.places === 0 : b.stage !== stage)) return false;
      if (app && b.app !== app) return false;
      if (rule && !["fail", "unknown"].includes(b.rules[rule]?.status)) return false;
      if (t && !`${b.id} ${b.label} ${b.app} ${b.file}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [q, app, stage, rule]);
  useEffect(() => setShown(SHOW), [q, app, stage, rule]);

  const pickStage = (n: number) => {
    setStage((s) => (s === n ? null : n));
    setTimeout(() => document.getElementById("bc-list")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
  };

  const noParts = CONTRACT.rules.find((r) => r.id === "parts")!.fail;

  return (
    <PinCtx.Provider value={{ on: saved.notes, open, toggle, answers: saved.answers, answer }}>
      <div className="bc">
        <p className="bc-plain">
          A block is code that draws part of a page. This page is the proposal for how a block tells the editor what it is, and what the editor may do with it. You can click everything. Nothing here changes a site.
        </p>
        <div className="bc-bar" role="toolbar" aria-label="Page controls">
          <button type="button" role="switch" aria-checked={saved.notes} className="bc-switch" onClick={() => setSaved((s) => ({ ...s, notes: !s.notes }))}>
            <span className="bc-knob" aria-hidden />
            Notes
          </button>
          <button type="button" className="bc-btn" onClick={back}>Clear my answers</button>
          <button type="button" className="bc-btn bc-primary" onClick={copy}>Copy my answers</button>
          <span className="bc-status" role="status" aria-live="polite">{status}</span>
        </div>

        {/* a. the idea */}
        <section className="bc-sec" aria-labelledby="h-idea">
          <h2 id="h-idea">The idea in three lines</h2>
          <ol className="bc-three">
            <li><strong>A block is code.</strong> The editor adjusts and arranges it. It never replaces it.</li>
            <li><strong>The contract is two lists.</strong> What the code tells the editor about itself, and what the editor may do to it.</li>
            <li><strong>The rules run both ways.</strong> The editor touches only what a block names. A block names everything it wants changed.</li>
          </ol>
        </section>

        {/* b. the pipeline */}
        <section className="bc-sec" aria-labelledby="h-pipe">
          <Head title="The pipeline: six stages a block passes" pin="C1" />
          <p id="h-pipe" className="bc-sub">
            Each stage counts how many of the {total} blocks pass its checks today. Choose a stage to list the blocks that stop there.
          </p>
          <ol className="bc-stages">
            {CONTRACT.stages.map((s) => {
              const here = stageHere(s.n);
              const on = stage === s.n;
              const pct = Math.round((s.meets / total) * 100);
              return (
                <li key={s.n} className={`bc-stage${on ? " is-on" : ""}${s.new ? " is-new" : ""}`} data-stage={s.n}>
                  <button type="button" aria-pressed={on} onClick={() => pickStage(s.n)}>
                    <span className="bc-stage-n">{s.n}</span>
                    <span className="bc-stage-name">{s.name}</span>
                    <span className="bc-stage-plain">{s.plain}</span>
                    <span className="bc-meter" aria-hidden><i style={{ width: `${pct}%` }} /></span>
                    <span className="bc-stage-count">
                      {s.new ? (
                        <>Not built. {CONTRACT.places.blocksWithPlaces} blocks have a place for others; {CONTRACT.places.offersDeclared} say what they offer.</>
                      ) : (
                        <>
                          <b>{s.meets}</b> of {total} pass. <span>{here} stop here.</span>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="bc-sub bc-small">
            A block has grown to a stage when it passes every earlier one. Hosts and guests is skipped in that count until it is built, so Listed for assistants follows Editable in place.
          </p>
          <Head title="Hosts and guests" pin="C5">
            <p className="bc-sub bc-small">Stage 5 is the new part. Today a block can have a place that takes other blocks ({CONTRACT.places.blocksWithPlaces} do), but it cannot say what it offers there, and a guest block cannot say what it looks for.</p>
          </Head>
        </section>

        {/* c. show and tell */}
        <section className="bc-sec" aria-labelledby="h-show">
          <h2 id="h-show">Show and tell: one block through the pipeline</h2>
          <p className="bc-sub">Elktours' tour cards, the row of tours on the landing page. Until 2026-11-23 it declared no parts, so a card's title could not be selected. Now it declares six.</p>
          <div className="bc-tell">
            <div className="bc-before-after">
              <div className="bc-ba is-before">
                <strong>Before</strong>
                <p>Parts: none.</p>
                <p className="bc-small">The editor could restyle the whole row only. Under E1 it touches only what is declared, so the title was out of reach.</p>
              </div>
              <div className="bc-ba is-after">
                <strong>Now</strong>
                <p>
                  Parts: {tourCards.parts.names.slice(0, 6).map((n, i) => (
                    <span key={n}>{i ? ", " : ""}{n}</span>
                  ))}{" "}
                  (all repeat).
                </p>
                <p className="bc-small">A look set on Card title is drawn once and applies to every card. Settings it names: {tourCards.settings.names.join(", ")}.</p>
              </div>
            </div>
            <details className="bc-code">
              <summary>Show the code</summary>
              <pre><code>{TOUR_CARDS_CODE}</code></pre>
              <p className="bc-small">Data only. Declaring parts changes no markup.</p>
            </details>
            <h3 className="bc-h3">Where it stands</h3>
            <ul className="bc-checks">
              {CONTRACT.rules.map((r) => {
                const res = tourCards.rules[r.id];
                return (
                  <li key={r.id} data-status={res.status}>
                    <span className={`bc-badge is-${res.status}`}>{mark[res.status]}</span>
                    <span className="bc-check-name">{r.name}</span>
                    <span className="bc-check-ev">{res.evidence}</span>
                  </li>
                );
              })}
            </ul>
            <p className="bc-sub bc-small">
              Result: it has reached stage {tourCards.stage}. The manifest assistants read still lists no parts for it, so a stage 6 pass waits on rebuilding the manifest. That is the whole path of a block, in one place.
            </p>
          </div>
        </section>

        {/* d. the toolbar mock */}
        <Toolbar saved={saved} setSaved={setSaved} />

        {/* e. the list */}
        <section className="bc-sec" id="bc-list" aria-labelledby="h-list">
          <Head title="Every block against the contract" pin="C2">
            <p id="h-list" className="bc-sub">This is the work queue. {total} blocks, read from their source on {CONTRACT.generated.slice(0, 10)}.</p>
          </Head>
          <div className="bc-totals" role="group" aria-label="Show blocks that fail a rule">
            {CONTRACT.rules.map((r) => (
              <button key={r.id} type="button" className={`bc-total${rule === r.id ? " is-on" : ""}`} aria-pressed={rule === r.id} onClick={() => setRule(rule === r.id ? "" : r.id)} data-rule={r.id}>
                <span className="bc-total-name">{r.name}</span>
                <span className="bc-total-nums">
                  <b className="is-fail">{r.fail}</b> fail
                  {r.unknown ? <> <b className="is-unknown">{r.unknown}</b> cannot tell</> : null}
                  <span> {r.pass} pass</span>
                </span>
              </button>
            ))}
          </div>
          <div className="bc-filters">
            <label>
              <span>Search</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, id or file" />
            </label>
            <label>
              <span>App</span>
              <select value={app} onChange={(e) => setApp(e.target.value)}>
                <option value="">All apps</option>
                {apps.map((a) => <option key={a} value={a}>{appLabel(a)} ({CONTRACT.apps[a]})</option>)}
              </select>
            </label>
            <label>
              <span>Stops at stage</span>
              <select value={stage ?? ""} onChange={(e) => setStage(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Any stage</option>
                {CONTRACT.stages.map((s) => <option key={s.n} value={s.n}>{s.n} {s.name}</option>)}
              </select>
            </label>
            <label>
              <span>Failing rule</span>
              <select value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value="">Any</option>
                {CONTRACT.rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          </div>
          <p className="bc-count" role="status" aria-live="polite" data-count={filtered.length}>
            {filtered.length} of {total} blocks
            {stage !== null ? <> that {stage === 5 ? "have a place for other blocks" : `stop at stage ${stage}, ${CONTRACT.stages[stage - 1].name}`}</> : null}
            {rule ? <>, failing or unclear on {ruleName(rule).toLowerCase()}</> : null}.
            {stage !== null || rule || app || q ? <button type="button" className="bc-link" onClick={() => { setStage(null); setRule(""); setApp(""); setQ(""); }}>Show all</button> : null}
          </p>
          <ul className="bc-rows">
            {filtered.slice(0, shown).map((b) => <Row key={b.id} b={b} rule={rule} />)}
          </ul>
          {filtered.length === 0 ? <p className="bc-empty">No block matches. Clear a filter to see more.</p> : null}
          {filtered.length > shown ? (
            <button type="button" className="bc-btn bc-more" onClick={() => setShown((n) => n + SHOW)}>Show {Math.min(SHOW, filtered.length - shown)} more</button>
          ) : null}
          <details className="bc-code bc-cannot">
            <summary>What this scan cannot see</summary>
            <ul>{CONTRACT.cannotTell.map((t) => <li key={t}>{t}</li>)}</ul>
          </details>
        </section>

        {/* f. the rules */}
        <section className="bc-sec" aria-labelledby="h-rules">
          <Head title="The rules, with a real example of each" pin="C4">
            <p id="h-rules" className="bc-sub">Five rules for the editor, five for a block. Each shows one place the repo keeps it and one place it does not.</p>
          </Head>
          {(["editor", "block"] as const).map((side) => (
            <div key={side} className="bc-rulegroup">
              <h3 className="bc-h3">{side === "editor" ? "The editor toward a block" : "A block toward the editor"}</h3>
              <ul className="bc-rules">
                {RULES.filter((r) => r.side === side).map((r) => (
                  <li key={r.id} className="bc-rule" data-rule-id={r.id}>
                    <div className="bc-rule-head"><span className="bc-rule-id">{r.id}</span><strong>{r.rule}</strong></div>
                    <div className="bc-eg">
                      <div className="bc-eg-kept"><span className="bc-badge is-pass">Kept</span><p>{r.kept.text}</p><code>{r.kept.where}</code></div>
                      <div className="bc-eg-broken"><span className="bc-badge is-fail">Broken</span><p>{r.broken.text.replace("{noParts}", String(noParts))}</p><code>{r.broken.where}</code></div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* g. all questions */}
        <section className="bc-sec" id="all-notes" aria-labelledby="h-all">
          <h2 id="h-all">Questions for you</h2>
          <p className="bc-sub">Seven questions, pinned where they come up. Your answers are kept in this browser. Copy my answers at the top sends them to Manjushri.</p>
          <ol className="bc-all">
            {NOTES.map((n) => {
              const a = saved.answers[n.id];
              return (
                <li key={n.id}>
                  <span className="bc-all-id">{n.id}</span>
                  <div>
                    <strong>{n.where}</strong>
                    <p>{n.text}</p>
                    <AnswerBoxAll id={n.id} answers={saved.answers} answer={answer} />
                    {a?.pick || a?.text ? <p className="bc-small bc-yours">Your answer: {[a.pick, a.text].filter(Boolean).join(" / ")}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </PinCtx.Provider>
  );
}

function AnswerBoxAll({ id, answers, answer }: { id: string; answers: Answers; answer: (id: string, a: { pick?: string; text?: string }) => void }) {
  const n = noteOf(id);
  const a = answers[id] ?? {};
  return (
    <div className="bc-answer">
      {n.choices ? (
        <div className="bc-seg" role="group" aria-label={`Answer to ${id} (list)`}>
          {n.choices.map((c) => (
            <button key={c} type="button" aria-pressed={a.pick === c} onClick={() => answer(id, { ...a, pick: a.pick === c ? undefined : c })}>{c}</button>
          ))}
        </div>
      ) : null}
      <label className="bc-sr" htmlFor={`all-${id}`}>Your words for {id}</label>
      <textarea id={`all-${id}`} rows={2} placeholder="In your own words, if you want" value={a.text ?? ""} onChange={(e) => answer(id, { ...a, text: e.target.value })} />
    </div>
  );
}

// ---- one row of the list --------------------------------------------------------------------------------------------

function Row({ b, rule }: { b: BlockRow; rule: string }) {
  const bad = CONTRACT.rules.filter((r) => ["fail", "unknown"].includes(b.rules[r.id].status));
  const shownRules = rule ? bad.filter((r) => r.id === rule) : bad;
  return (
    <li className="bc-row" data-block={b.id}>
      <div className="bc-row-top">
        <strong className="bc-row-name">{b.label}</strong>
        <code className="bc-row-id">{b.id}</code>
        <span className="bc-chip">{appLabel(b.app)}</span>
        <span className={`bc-chip bc-stagechip s${b.stage}`}>Stage {b.stage}: {CONTRACT.stages[b.stage - 1]?.name ?? "none"}</span>
      </div>
      <div className="bc-dots" aria-label="Checks by stage">
        {CONTRACT.stages.map((s, i) => (
          <span key={s.n} className={`bc-dot${b.meets[i] ? " is-on" : ""}${s.new ? " is-new" : ""}`} title={`${s.n} ${s.name}: ${s.new ? "not built" : b.meets[i] ? "passes" : "does not pass yet"}`} />
        ))}
        <span className="bc-row-src">{b.file}:{b.line}</span>
      </div>
      {bad.length === 0 ? <p className="bc-ok">Passes every check.</p> : (
        <ul className="bc-ev">
          {shownRules.map((r) => (
            <li key={r.id} data-status={b.rules[r.id].status}>
              <span className={`bc-badge is-${b.rules[r.id].status}`}>{b.rules[r.id].status === "fail" ? "Fails" : "Cannot tell"}</span>
              <span className="bc-ev-name">{r.name}.</span> {b.rules[r.id].evidence}
            </li>
          ))}
          {rule && bad.length > shownRules.length ? <li className="bc-more-rules">{bad.length - shownRules.length} more not shown.</li> : null}
        </ul>
      )}
    </li>
  );
}

// ---- d. the cursor toolbar (a mock) ----------------------------------------------------------------------------------

const PencilIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false"><path d="M2 14l.8-3.2L11 2.6a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2L5.2 13.2 2 14z" fill="currentColor" /></svg>
);

function Toolbar({ saved, setSaved }: { saved: Saved; setSaved: React.Dispatch<React.SetStateAction<Saved>> }) {
  const stage = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState<{ t: Target; x: number; y: number } | null>(null);
  const [said, setSaid] = useState("");
  const [blocked, setBlocked] = useState("");
  const role = ROLES.find((r) => r.id === saved.role)!;
  const can = (t: Target) => role.can.includes(t);

  const openAt = (t: Target, e: RMouseEvent | KeyboardEvent, el: HTMLElement) => {
    const s = stage.current!.getBoundingClientRect();
    let x: number, y: number;
    const me = e as RMouseEvent;
    if (me.clientX || me.clientY) { x = me.clientX - s.left; y = me.clientY - s.top; }
    else { const r = el.getBoundingClientRect(); x = r.left - s.left + r.width / 2; y = r.top - s.top + r.height / 2; }
    setSaid("");
    if (!can(t)) {
      setCur(null);
      setBlocked(role.id === "visitor" ? "A visitor cannot change this. Sign in to edit." : t === "field" ? "An author cannot change this. It belongs to the tour record, which a guide or owner changes." : "You cannot change this.");
      return;
    }
    setBlocked("");
    setCur({ t, x, y });
  };

  useLayoutEffect(() => {
    const b = bar.current, s = stage.current;
    if (!cur || !b || !s) return;
    const sw = s.clientWidth, sh = s.clientHeight;
    const bw = b.offsetWidth, bh = b.offsetHeight;
    const left = Math.max(8, Math.min(cur.x - 24, sw - bw - 8));
    const top = cur.y - bh - 14 >= 8 ? cur.y - bh - 14 : Math.min(cur.y + 16, Math.max(8, sh - bh - 4));
    b.style.left = `${left}px`;
    b.style.top = `${top}px`;
    // the little pointer under the cursor
    b.style.setProperty("--tip", `${Math.max(12, Math.min(cur.x - left, bw - 12))}px`);
  }, [cur, said]);

  useEffect(() => {
    if (!cur) return;
    const down = (e: MouseEvent) => {
      const n = e.target as Node;
      if (bar.current?.contains(n)) return;
      if ((n as HTMLElement).closest?.("[data-target], .bc-pencil")) return;
      setCur(null);
    };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setCur(null); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [cur]);

  const tgt = (t: Target) => ({
    "data-target": t,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `${t === "title" ? "Card title" : t === "text" ? "Card paragraph" : t === "picture" ? "Card picture" : "Next date, from the tour record"}: show the toolbar`,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": cur?.t === t,
    className: `bc-t${cur?.t === t ? " is-sel" : ""}`,
    onClick: (e: RMouseEvent) => openAt(t, e, e.currentTarget as HTMLElement),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAt(t, e, e.currentTarget as HTMLElement); } },
  });
  const pencil = (t: Target) => saved.pencils && can(t) ? (
    <button type="button" className="bc-pencil" data-pencil={t} aria-label={`Edit ${t === "title" ? "the title" : t === "text" ? "the paragraph" : t === "picture" ? "the picture" : "the next date"}`} onClick={(e) => { e.stopPropagation(); const p = (e.currentTarget as HTMLElement); openAt(t, e as unknown as RMouseEvent, p); }}>
      <PencilIcon />
    </button>
  ) : null;

  const spec = cur ? TOOLBARS[cur.t] : null;
  const isWords = cur && (cur.t === "title" || cur.t === "text");

  return (
    <section className="bc-sec" aria-labelledby="h-tool">
      <Head title="The live editor's cursor toolbar" pin="C3">
        <p id="h-tool" className="bc-sub">
          A mock. Click the title, the paragraph, the picture or the date on the card. A small toolbar opens at the pointer with what the editor would offer for that kind of thing, and the line under it says which declaration made it appear. It changes nothing.
        </p>
      </Head>
      <div className="bc-tool-controls">
        <button type="button" role="switch" aria-checked={saved.pencils} className="bc-switch" onClick={() => { setSaved((s) => ({ ...s, pencils: !s.pencils })); setCur(null); }}>
          <span className="bc-knob" aria-hidden />
          Show pencils
        </button>
        <Pin id="C7" />
        <div className="bc-seg" role="group" aria-label="Viewing as">
          {ROLES.map((r) => (
            <button key={r.id} type="button" aria-pressed={saved.role === r.id} onClick={() => { setSaved((s) => ({ ...s, role: r.id })); setCur(null); setBlocked(""); }}>{r.label}</button>
          ))}
        </div>
      </div>
      <PinNote id="C7" />
      <p className="bc-sub bc-small">
        A pencil appears wherever a block has declared words, a picture or a record field, and only for people allowed to change that thing. {role.line}
      </p>

      <div className="bc-stage-mock" ref={stage}>
        <article className="bc-card" aria-label="Sample card">
          <div className="bc-card-pic-wrap">
            <div {...tgt("picture")} className={`bc-t bc-card-pic${cur?.t === "picture" ? " is-sel" : ""}`}>
              <svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
                <rect width="320" height="160" className="pic-sky" />
                <circle cx="236" cy="48" r="20" className="pic-sun" />
                <path d="M0 120 L70 62 L118 104 L178 48 L250 112 L320 78 V160 H0Z" className="pic-hill" />
                <path d="M0 140 Q80 112 160 134 T320 124 V160 H0Z" className="pic-near" />
              </svg>
            </div>
            {pencil("picture")}
          </div>
          <div className="bc-card-body">
            <p className="bc-card-kicker">Paris, in person</p>
            <div className="bc-line">
              <h3 {...tgt("title")} className={`bc-t bc-card-title${cur?.t === "title" ? " is-sel" : ""}`}>Evening drawing circle</h3>
              {pencil("title")}
            </div>
            <div className="bc-line">
              <p {...tgt("text")} className={`bc-t bc-card-text${cur?.t === "text" ? " is-sel" : ""}`}>An unhurried walk along the river with a sketchbook. We stop wherever the light is good and draw what is there.</p>
              {pencil("text")}
            </div>
            <div className="bc-line bc-card-foot">
              <span {...tgt("field")} className={`bc-t bc-card-field${cur?.t === "field" ? " is-sel" : ""}`}>Next: Thursday 4 December</span>
              {pencil("field")}
              <Pin id="C6" />
            </div>
          </div>
        </article>
        <PinNote id="C6" />

        {cur && spec ? (
          <div className="bc-bar-pop" ref={bar} role="dialog" aria-label={`${spec.title} tools (mock)`} data-kind={cur.t}>
            <div className="bc-pop-head">
              <strong>{spec.title}</strong>
              <button type="button" className="bc-x" aria-label="Close the toolbar" onClick={() => setCur(null)}>Close</button>
            </div>
            <div className="bc-tools">
              {spec.tools.map((t) => (
                <button key={t.id} type="button" data-tool={t.id} onClick={() => setSaid(`Mock: this ${t.says}. Nothing changed.`)}>{t.label}</button>
              ))}
              {isWords ? (
                <label className="bc-style">
                  <span className="bc-sr">Text style</span>
                  <select defaultValue={cur.t === "title" ? "Heading" : "Body"} onChange={(e) => setSaid(`Mock: this would set the text style to ${e.target.value}, one of the theme's six. Nothing changed.`)}>
                    {TEXT_STYLES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            {spec.extra ? <p className="bc-pop-extra">{spec.extra}</p> : null}
            <p className="bc-pop-why"><em>Why you see this.</em> {spec.why}</p>
            {said ? <p className="bc-pop-said" role="status">{said}</p> : null}
          </div>
        ) : null}
      </div>
      {blocked ? <p className="bc-blocked" role="status">{blocked} <span>(E4: it says why, in one line.)</span></p> : null}
      {!cur && !blocked ? <p className="bc-hint bc-small">Nothing selected. Click something on the card.</p> : null}
    </section>
  );
}
