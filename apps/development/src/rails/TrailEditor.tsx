"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isFail, type History, type VersionRow } from "@/lib/versions-types";
import { railsAutosave, railsDiscard, railsKeep, railsList, railsSave } from "./actions";
import type { Cap, LevelNo, RailDoc, RailStep, SlimCap, Weight } from "./types";
import { LEVELS, WEIGHTS, levelOf, stepAnchor } from "./types";
import { LevelTag } from "./ui";

// ============================================================================
// The trail as a list you can change: reorder, drop, add, mark essential / optional / later,
// write a note per step. Saved into dev_versions (subject rail:<course>) as drafts and versions.
// Nothing here changes the atlas or the live courses.
// ============================================================================

export interface BaseStep {
  cap?: string;
  gap?: string;
  trackLabel: string;
}

interface Row extends RailStep {
  key: string;
}

const sig = (s: { cap?: string; gap?: string }) => (s.cap ? `cap:${s.cap}` : `gap:${s.gap}`);
let counter = 0;
const newKey = () => `r${++counter}`;
const toRows = (steps: RailStep[]): Row[] => steps.map((s) => ({ ...s, key: newKey() }));
const fromRows = (rows: Row[]): RailStep[] => rows.map(({ cap, gap, weight, note }) => ({ ...(cap ? { cap } : { gap }), weight, note }));
const stamp = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";

function asDoc(doc: unknown): RailDoc | null {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as RailDoc).steps)) return null;
  const d = doc as RailDoc;
  return { steps: d.steps.filter((s) => s && (s.cap || s.gap)).map((s) => ({ ...(s.cap ? { cap: s.cap } : { gap: s.gap }), weight: (s.weight ?? "essential") as Weight, note: s.note ?? "" })), note: d.note ?? "" };
}

export function TrailEditor(props: {
  course: string;
  baseline: BaseStep[];
  details: Record<string, Cap>;
  pool: SlimCap[];
  initialDoc: RailDoc | null;
  initialBaseId: string | null;
  initialFrom: "draft" | "version" | "atlas";
  history: History | null;
  setupMessage: string | null;
}) {
  const { course, baseline, details, pool } = props;
  const baselineRows = useMemo<RailStep[]>(() => baseline.map((b) => ({ ...(b.cap ? { cap: b.cap } : { gap: b.gap }), weight: "essential" as Weight, note: "" })), [baseline]);
  const [rows, setRows] = useState<Row[]>(() => toRows((props.initialDoc ?? { steps: baselineRows, note: "" }).steps));
  const [note, setNote] = useState(props.initialDoc?.note ?? "");
  const [baseId, setBaseId] = useState<string | null>(props.initialBaseId);
  const [history, setHistory] = useState<History | null>(props.history);
  const [saveState, setSaveState] = useState<{ text: string; bad?: boolean }>({ text: props.setupMessage ?? (props.initialFrom === "draft" ? "Your unsaved draft was loaded." : "") });
  const [versionNote, setVersionNote] = useState("");
  const [ask, setAsk] = useState<{ suggested: string } | null>(null);
  const [branchName, setBranchName] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [gapText, setGapText] = useState("");
  const touched = useRef(false);
  const setupBroken = useRef(Boolean(props.setupMessage));

  const slimById = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const baseBySig = useMemo(() => new Map(baseline.map((b, i) => [sig(b), { ...b, index: i }])), [baseline]);

  // ---- what differs from the atlas ----
  const diff = useMemo(() => {
    const cur = new Set(rows.map(sig));
    const base = new Set(baseline.map(sig));
    const added = rows.filter((r) => !base.has(sig(r)));
    const dropped = baseline.map((b, i) => ({ ...b, index: i })).filter((b) => !cur.has(sig(b)));
    const commonCur = rows.filter((r) => base.has(sig(r))).map(sig);
    const commonBase = baseline.filter((b) => cur.has(sig(b))).map(sig);
    const moved = commonCur.filter((s, i) => commonBase[i] !== s).length;
    const marked = rows.filter((r) => r.weight !== "essential").length;
    const noted = rows.filter((r) => r.note.trim()).length;
    const edited = added.length + dropped.length + moved + marked + noted > 0 || note.trim().length > 0;
    return { added, dropped, moved, marked, noted, edited };
  }, [rows, baseline, note]);

  // ---- autosave ----
  useEffect(() => {
    if (!touched.current || setupBroken.current) return;
    const t = setTimeout(async () => {
      const r = await railsAutosave({ course, baseId, doc: { steps: fromRows(rows), note } });
      if (isFail(r)) {
        setSaveState({ text: `Not saved: ${r.message}`, bad: true });
        if (r.reason === "setup") setupBroken.current = true;
      } else setSaveState({ text: `Draft saved ${stamp((r as { updatedAt: string }).updatedAt)}` });
    }, 1200);
    return () => clearTimeout(t);
  }, [rows, note, baseId, course]);

  const change = (fn: (r: Row[]) => Row[]) => {
    touched.current = true;
    setRows(fn);
  };
  const move = (i: number, d: -1 | 1) =>
    change((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const c = r.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const patch = (key: string, p: Partial<RailStep>) => change((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const drop = (key: string) => change((r) => r.filter((x) => x.key !== key));
  const add = (s: RailStep) => change((r) => [...r, { ...s, key: newKey() }]);
  const putBack = (b: BaseStep & { index: number }) => change((r) => [...r.slice(0, b.index), { ...(b.cap ? { cap: b.cap } : { gap: b.gap }), weight: "essential", note: "", key: newKey() }, ...r.slice(b.index)]);

  async function refreshHistory() {
    const h = await railsList(course);
    if (!isFail(h)) setHistory({ versions: (h as { versions: VersionRow[] }).versions, draft: (h as { draft: History["draft"] }).draft });
  }

  async function save(withBranch?: string) {
    setBusy(true);
    const r = await railsSave({ course, baseId, note: versionNote, doc: { steps: fromRows(rows), note }, branchName: withBranch });
    setBusy(false);
    if (isFail(r)) {
      if (r.reason === "needs-name") {
        setAsk({ suggested: r.suggested ?? "Try 2" });
        setBranchName(r.suggested ?? "Try 2");
        return;
      }
      setSaveState({ text: `Not saved: ${r.message}`, bad: true });
      return;
    }
    const ok = r as { saved: VersionRow; newBranch: boolean };
    setAsk(null);
    setVersionNote("");
    setBaseId(ok.saved.id);
    touched.current = false;
    setSaveState({ text: `Saved a version on "${ok.saved.branch}".` });
    await refreshHistory();
  }

  function open(v: VersionRow) {
    const d = asDoc(v.doc);
    if (!d) return;
    touched.current = true;
    setRows(toRows(d.steps));
    setNote(d.note);
    setBaseId(v.id);
    setSaveState({ text: `Opened "${v.note || stamp(v.createdAt)}" on "${v.branch}". It is a draft until you save.` });
  }

  async function startAgain() {
    touched.current = false;
    setRows(toRows(baselineRows));
    setNote("");
    setBaseId(null);
    setAsk(null);
    const r = await railsDiscard(course);
    setSaveState(isFail(r) ? { text: `Could not clear the draft: ${r.message}`, bad: true } : { text: "Back to the atlas as it stands. Nothing was deleted from the saved versions." });
    await refreshHistory();
  }

  async function keep(v: VersionRow) {
    const r = await railsKeep(course, v.id, !v.kept);
    if (isFail(r)) setSaveState({ text: r.message, bad: true });
    await refreshHistory();
  }

  // ---- picker ----
  const have = useMemo(() => new Set(rows.map((r) => r.cap).filter(Boolean) as string[]), [rows]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return pool.filter((p) => !have.has(p.id) && (p.id.includes(s) || p.label.toLowerCase().includes(s) || p.does.toLowerCase().includes(s))).slice(0, 30);
  }, [q, pool, have]);

  const info = (r: Row) => {
    const full = r.cap ? details[r.cap] : undefined;
    const sl = r.cap ? slimById.get(r.cap) : undefined;
    const level = (full?.level ?? sl?.level ?? 0) as LevelNo;
    return { full, sl, level, where: full?.where ?? sl?.where, label: r.cap ? (full?.label ?? sl?.label ?? r.cap) : (r.gap ?? ""), base: baseBySig.get(sig(r)) };
  };

  const versions = history?.versions ?? [];
  const branches = [...new Set(versions.map((v) => v.branch))];

  return (
    <div data-dev-anchor={`rail:${course}`}>
      <div className={`dev-r-banner${diff.edited ? "" : " is-clean"}`} role="status">
        {diff.edited ? (
          <>
            <b>Edited draft, not live.</b> This is your version of the trail. The atlas and the live courses on Sophia are not changed.{" "}
            {[diff.added.length && `${diff.added.length} added`, diff.dropped.length && `${diff.dropped.length} dropped`, diff.moved && `${diff.moved} moved`, diff.marked && `${diff.marked} marked optional or later`, diff.noted && `${diff.noted} with a note`].filter(Boolean).join(", ")}.
          </>
        ) : (
          <>
            <b>No edits yet.</b> This is the trail as the atlas has it. Anything you change here is a draft: the live courses are not touched.
          </>
        )}
        {saveState.text ? <div className={`dev-r-status${saveState.bad ? " is-bad" : ""}`}>{saveState.text}</div> : null}
      </div>

      {rows.map((r, i) => {
        const x = info(r);
        const lv = levelOf(x.level);
        return (
          <div key={r.key} id={`step-${i + 1}`} className={`dev-r-row${r.weight === "later" ? " is-later" : ""}${r.gap ? " is-gap" : ""}`} style={{ ["--lv" as string]: r.gap ? "#5b6272" : lv.color }} data-dev-anchor={stepAnchor(course, r, i)}>
            <div className="dev-r-num">{i + 1}</div>
            <div className="dev-r-body">
              <h3>
                {r.cap ? x.label : <span>Not built yet: {r.gap}</span>}
                {r.cap ? <code>{r.cap}</code> : null}
                <LevelTag n={x.level} where={x.where} />
                {r.weight !== "essential" ? <span className="dev-r-pill">{r.weight === "optional" ? "Optional" : "Later"}</span> : null}
              </h3>
              <p className="dev-r-muted">{x.base ? `Module: ${x.base.trackLabel}` : "Added by you"}</p>
              {x.full ? (
                <>
                  <p>{x.full.does}</p>
                  <p>
                    <span className="k">Done at: </span>
                    {x.full.address ? (
                      <>
                        {x.full.address.app} <code>{x.full.address.path}</code>
                        {x.full.address.how ? ` (${x.full.address.how})` : ""}
                      </>
                    ) : (
                      "nowhere yet"
                    )}
                  </p>
                  <p>
                    <span className="k">Why it is at {lv.name}: </span>
                    {x.full.why}
                  </p>
                  <p>
                    <span className="k">What lifts it: </span>
                    {x.full.next}
                  </p>
                </>
              ) : x.sl ? (
                <>
                  <p>{x.sl.does}</p>
                  <p>
                    <span className="k">Why it is at {lv.name}: </span>
                    {x.sl.why}
                  </p>
                </>
              ) : r.gap ? (
                <p className="dev-r-muted">Nothing exists for this yet. It stays a gap until someone builds it.</p>
              ) : null}
            </div>
            <div className="dev-r-tools">
              <div className="dev-r-pair">
                <button className="dev-r-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}>
                  Up
                </button>
                <button className="dev-r-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move step ${i + 1} down`}>
                  Down
                </button>
              </div>
              <select className="dev-r-select" value={r.weight} onChange={(e) => patch(r.key, { weight: e.target.value as Weight })} aria-label="How important">
                {WEIGHTS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button className="dev-r-btn is-quiet" onClick={() => drop(r.key)}>
                Drop this step
              </button>
            </div>
            <textarea className="dev-r-note" rows={1} placeholder="A note on this step (why it matters, what to change)" value={r.note} maxLength={600} onChange={(e) => patch(r.key, { note: e.target.value })} />
          </div>
        );
      })}
      {rows.length === 0 ? <p className="dev-r-muted">No steps left. Add one below, or start again from the atlas.</p> : null}

      {diff.dropped.length ? (
        <div className="dev-r-box">
          <h2 style={{ fontSize: 14 }}>Dropped from this trail ({diff.dropped.length})</h2>
          {diff.dropped.map((b) => (
            <div key={sig(b)} className="dev-r-dropped" data-dev-anchor={`rail:${course}/${b.cap ?? `gap-${b.index + 1}`}`}>
              <s>{b.cap ? (details[b.cap]?.label ?? slimById.get(b.cap)?.label ?? b.cap) : `Not built yet: ${b.gap}`}</s>
              <button className="dev-r-btn" onClick={() => putBack(b)}>
                Put back
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="dev-r-box dev-r-picker">
        <h2 style={{ fontSize: 14 }}>Add something to this trail</h2>
        <input className="dev-r-input" type="search" placeholder="Search everything the platform can do (type 2 letters or more)" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length ? (
          <div className="dev-r-results">
            {results.map((p) => (
              <button
                key={p.id}
                className="dev-r-result"
                onClick={() => {
                  add({ cap: p.id, weight: "essential", note: "" });
                  setQ("");
                }}
              >
                <LevelTag n={p.level} where={p.where} />
                <span>
                  {p.label} <code>{p.id}</code> {p.does}
                </span>
                <span>Add</span>
              </button>
            ))}
          </div>
        ) : q.trim().length >= 2 ? (
          <p className="dev-r-muted">Nothing matches, or it is already in this trail.</p>
        ) : null}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input className="dev-r-input" style={{ flex: 1, minWidth: 220 }} placeholder="Or name something that is missing (a thing that does not exist yet)" value={gapText} maxLength={300} onChange={(e) => setGapText(e.target.value)} />
          <button
            className="dev-r-btn"
            disabled={!gapText.trim()}
            onClick={() => {
              add({ gap: gapText.trim(), weight: "essential", note: "" });
              setGapText("");
            }}
          >
            Add as a gap
          </button>
        </div>
      </div>

      <div className="dev-r-box">
        <h2 style={{ fontSize: 14 }}>Save this edit</h2>
        <textarea className="dev-r-note" style={{ gridColumn: "auto" }} rows={2} placeholder="A note on the whole trail (what you are trying here)" value={note} maxLength={600} onChange={(e) => { touched.current = true; setNote(e.target.value); }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <input className="dev-r-input" style={{ flex: 1, minWidth: 220 }} placeholder="Name this version (optional)" value={versionNote} maxLength={280} onChange={(e) => setVersionNote(e.target.value)} />
          <button className="dev-r-btn is-primary" disabled={busy} onClick={() => save()}>
            Save as a version
          </button>
          <button className="dev-r-btn is-quiet" disabled={busy} onClick={startAgain}>
            Start again from the atlas
          </button>
        </div>
        {ask ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
            <span className="dev-r-status">You changed an earlier version, so this starts a new branch. Name it:</span>
            <input className="dev-r-input" value={branchName} maxLength={40} onChange={(e) => setBranchName(e.target.value)} />
            <button className="dev-r-btn is-primary" disabled={busy || !branchName.trim()} onClick={() => save(branchName)}>
              Save as a new branch
            </button>
            <button className="dev-r-btn is-quiet" onClick={() => setAsk(null)}>
              Cancel
            </button>
          </div>
        ) : null}
        <p className="dev-r-status" style={{ marginBottom: 0 }}>
          Your working copy saves by itself a moment after each change. A saved version is never overwritten.
        </p>
      </div>

      <div className="dev-r-box">
        <h2 style={{ fontSize: 14 }}>Saved versions</h2>
        {history === null ? (
          <p className="dev-r-muted">Saved versions are not available yet{props.setupMessage ? `: ${props.setupMessage}` : "."}</p>
        ) : versions.length === 0 ? (
          <p className="dev-r-muted">None yet.</p>
        ) : (
          <div className="dev-r-hist">
            {branches.map((b) => (
              <div key={b}>
                <b>{b}</b>
                {versions
                  .filter((v) => v.branch === b)
                  .slice()
                  .reverse()
                  .map((v) => (
                    <div key={v.id} className={`dev-r-hist-row${v.id === baseId ? " is-base" : ""}`}>
                      <span>{stamp(v.createdAt)}</span>
                      <span>{v.note || "(no name)"}</span>
                      <span className="dev-r-muted">{v.author ?? ""}</span>
                      {v.kept ? <span className="dev-r-pill">Kept</span> : null}
                      {v.id === baseId ? <span className="dev-r-pill">Working from this</span> : null}
                      <button className="dev-r-btn" onClick={() => open(v)}>
                        Open
                      </button>
                      <button className="dev-r-btn is-quiet" onClick={() => keep(v)}>
                        {v.kept ? "Un-keep" : "Keep"}
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="dev-r-muted" style={{ fontSize: 11 }}>
        Levels: {LEVELS.map((l) => l.name).join(", ")}. A step marked Later or Optional is still in the trail; the mark is for whoever folds your edit into the live course.
      </p>
    </div>
  );
}
