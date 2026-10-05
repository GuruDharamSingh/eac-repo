"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Circle, Download, ExternalLink, Maximize2, Mic, MicOff, Pause, Play, Square, Video, X } from "lucide-react";
import { withBase } from "@/lib/base-path";
import type { CallState, Passage, PaathProgress, RecentRead, Recording } from "@/lib/paath";
import { PassageCard, type TextView } from "./passage-card";

/**
 * The reading desk. Main column: the sitting (clock, recorder), the passage(s)
 * to read now with a check mark each, and "Manage the reading". Right column:
 * the passages coming next and the ones just read (click one to look at it),
 * and the Talk room, embedded like the circle page's. Preferences (how many
 * passages at a time, which text, type size, recording on or off) stay in
 * this browser.
 */

const COUNTS = [1, 2, 3, 5] as const;
const SIZES = [0.9, 1, 1.15, 1.3, 1.5] as const;
const AHEAD = 3;

function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* private mode: defaults */
    }
  }, [key]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key]
  );
  return [value, set];
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const size = (bytes: number) => (bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

type RecState = "idle" | "recording" | "paused" | "saving" | "saved" | "failed";

export function PaathReader(props: {
  initialPassages: Passage[];
  initialToday: Passage[];
  initialProgress: PaathProgress;
  initialRecordings: Recording[];
  initialCall: CallState;
  initialRecent: RecentRead[];
  talkUrl: string | null;
  dayLabel: string;
}) {
  const [count, setCount] = useStored<number>("paath:count2", 1);
  const [view, setView] = useStored<TextView>("paath:view3", "english");
  const [scale, setScale] = useStored<number>("paath:scale", 1);
  const [recordAudio, setRecordAudio] = useStored<boolean>("paath:record", true);

  // The unread passages from the reading point on: the first `count` are read now, the next AHEAD are "coming next".
  const [unread, setUnread] = useState(props.initialPassages);
  const [today, setToday] = useState(props.initialToday);
  const [progress, setProgress] = useState(props.initialProgress);
  const [recordings, setRecordings] = useState(props.initialRecordings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState<Passage | null>(null);

  const passages = unread.slice(0, count);
  const coming = unread.slice(count, count + AHEAD);

  const refill = useCallback(async (n: number) => {
    const res = await fetch(withBase(`/api/akhand-path/passages?limit=${n + AHEAD}`), { cache: "no-store" }).catch(() => null);
    if (res?.ok) setUnread(((await res.json()) as { passages: Passage[] }).passages);
  }, []);
  useEffect(() => {
    if (unread.length < Math.min(count + AHEAD, progress.total - progress.done)) refill(count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  function scrollToDesk() {
    window.scrollTo({ top: Math.max(0, (document.getElementById("paath-desk")?.offsetTop ?? 0) - 90), behavior: "smooth" });
  }

  async function mark(p: Passage, done: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(withBase("/api/akhand-path/read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId: p.id, done }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError("That did not save. Check the connection and try again.");
    }
    const json = (await res.json()) as { progress: PaathProgress; at: string };
    setProgress(json.progress);
    if (done) setToday((t) => [{ ...p, doneAt: json.at, doneBy: "you" }, ...t]);
    else setToday((t) => t.filter((x) => x.id !== p.id));
    if (looking?.id === p.id) setLooking(null);
    await refill(count);
    setBusy(false);
    if (done) scrollToDesk();
  }

  async function look(id: string, known?: Passage) {
    if (known) {
      setLooking(known);
      return scrollToDesk();
    }
    const res = await fetch(withBase(`/api/akhand-path/passage?id=${encodeURIComponent(id)}`), { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      setLooking(((await res.json()) as { passage: Passage }).passage);
      scrollToDesk();
    }
  }

  // ── Manage: put recently read passages back as unread ───────────────────
  const [recent, setRecent] = useState(props.initialRecent);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [recentLimit, setRecentLimit] = useState(10);
  const [manageMsg, setManageMsg] = useState<string | null>(null);

  const loadRecent = useCallback(async (limit: number) => {
    const res = await fetch(withBase(`/api/akhand-path/unread?limit=${limit}`), { cache: "no-store" }).catch(() => null);
    if (res?.ok) setRecent(((await res.json()) as { recent: RecentRead[] }).recent);
  }, []);
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    loadRecent(recentLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.done, recentLimit]);

  async function unreadPicked() {
    if (picked.size === 0) return;
    setBusy(true);
    setManageMsg(null);
    const res = await fetch(withBase("/api/akhand-path/unread"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitIds: [...picked] }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setManageMsg("That did not save. Try again.");
    }
    const json = (await res.json()) as { changed: number; progress: PaathProgress };
    setProgress(json.progress);
    setToday((t) => t.filter((x) => !picked.has(x.id)));
    if (looking && picked.has(looking.id)) setLooking(null);
    setPicked(new Set());
    await refill(count);
    setBusy(false);
    setManageMsg(`${json.changed} passage${json.changed === 1 ? "" : "s"} marked unread — back in the reading.`);
  }

  // ── The sitting: a clock and (optionally) the microphone ────────────────
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [rec, setRec] = useState<RecState>("idle");
  const [recError, setRecError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  useEffect(() => {
    if (rec !== "recording" && rec !== "paused" && rec !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [rec]);

  async function begin() {
    setRecError(null);
    setFallback(null);
    const at = Date.now();
    setStartedAt(at);
    setNow(at);
    if (!recordAudio) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.start(10_000);
      stream.current = s;
      recorder.current = r;
      setRec("recording");
    } catch {
      setRec("failed");
      setRecError("The microphone could not be opened. The reading goes on without a recording — allow the microphone in the browser to record next time.");
    }
  }

  function pause() {
    if (recorder.current?.state === "recording") {
      recorder.current.pause();
      setRec("paused");
    } else if (recorder.current?.state === "paused") {
      recorder.current.resume();
      setRec("recording");
    }
  }

  async function upload(blob: Blob, started: number) {
    setRec("saving");
    setUploadPct(0);
    const form = new FormData();
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    form.append("file", new File([blob], `reading.${ext}`, { type: blob.type }));
    form.append("startedAt", new Date(started).toISOString());
    const result = await new Promise<Recording | null>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", withBase("/api/akhand-path/recording"));
      xhr.upload.onprogress = (e) => e.lengthComputable && setUploadPct(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        try {
          resolve(xhr.status === 200 ? (JSON.parse(xhr.responseText) as { recording: Recording }).recording : null);
        } catch {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.send(form);
    });
    if (result) {
      setRecordings((r) => [...r, result]);
      setRec("saved");
    } else {
      // Never lose a reading: offer it to save by hand.
      setFallback(URL.createObjectURL(blob));
      setRec("failed");
      setRecError("The recording could not be uploaded. Save it to this device with the link below, and add it later.");
    }
  }

  async function finish() {
    const started = startedAt ?? Date.now();
    setStartedAt(null);
    const r = recorder.current;
    recorder.current = null;
    if (!r) return;
    const stopped = new Promise<void>((resolve) => (r.onstop = () => resolve()));
    if (r.state !== "inactive") r.stop();
    await stopped;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
    chunks.current = [];
    if (blob.size > 0) await upload(blob, started);
    else setRec("idle");
  }

  // ── The Talk room ───────────────────────────────────────────────────────
  const [call, setCall] = useState(props.initialCall);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!props.talkUrl) return;
    const t = setInterval(async () => {
      const res = await fetch(withBase("/api/akhand-path/call"), { cache: "no-store" }).catch(() => null);
      if (res?.ok) setCall(((await res.json()) as { call: CallState }).call);
    }, inRoom ? 15_000 : 45_000);
    return () => clearInterval(t);
  }, [props.talkUrl, inRoom]);

  async function recordCall(on: boolean) {
    setCallMsg(null);
    const res = await fetch(withBase("/api/akhand-path/call"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record: on }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { message?: string; call?: CallState } | null;
    if (json?.call) setCall(json.call);
    setCallMsg(json?.message ?? "Talk did not answer.");
  }

  const pct = progress.total ? (progress.done / progress.total) * 100 : 0;
  const sitting = startedAt != null;
  const stepSize = (d: number) => setScale(SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(scale as (typeof SIZES)[number]) + d))] ?? 1);

  return (
    <div className="paath" style={{ ["--paath-scale" as string]: scale }}>
      {/* ── Progress through the whole Granth ── */}
      <section className="paath-progress" aria-label="Progress">
        <div className="paath-progress__numbers">
          <strong>{progress.nextPosition == null ? "Complete" : `Ang ${progress.ang}`}</strong>
          <span>of 1430</span>
          <span className="paath-progress__sep">·</span>
          <span>{progress.done.toLocaleString()} of {progress.total.toLocaleString()} passages ({pct < 10 ? pct.toFixed(1) : Math.round(pct)}%)</span>
        </div>
        <div className="paath-bar" role="img" aria-label={`${Math.round(pct)}% read`}>
          {progress.sections.map((s) => (
            <span
              key={s.name}
              className="paath-bar__seg"
              style={{ flexGrow: s.total }}
              title={`${s.name}: ${s.done} of ${s.total}`}
              data-current={progress.nextPosition != null && progress.nextPosition >= s.from && progress.nextPosition <= s.to}
            >
              <span className="paath-bar__fill" style={{ width: `${(s.done / s.total) * 100}%` }} />
            </span>
          ))}
        </div>
      </section>

      <div className="paath-layout">
        <div className="paath-main">
          {/* ── The sitting ── */}
          <section className="paath-sitting" aria-label="Today's sitting">
            <p className="eyebrow">{props.dayLabel}</p>
            {sitting ? (
              <p className="paath-sitting__clock" aria-live="polite">
                {rec === "recording" ? <Circle size={12} className="paath-rec-dot" aria-hidden /> : rec === "paused" ? <Pause size={12} aria-hidden /> : null}
                {clock(now - startedAt)}
                <span className="paath-sitting__state">{rec === "recording" ? "recording" : rec === "paused" ? "paused" : "reading"}</span>
              </p>
            ) : (
              <p className="paath-sitting__hint">
                {today.length ? `${today.length} passage${today.length === 1 ? "" : "s"} read today.` : "Nothing read yet today."}
              </p>
            )}
            <div className="paath-sitting__actions">
              {!sitting ? (
                <>
                  <button type="button" className="btn btn--primary" onClick={begin} disabled={rec === "saving"}>
                    <Play size={14} aria-hidden /> Begin reading
                  </button>
                  <label className="paath-toggle">
                    <input type="checkbox" checked={recordAudio} onChange={(e) => setRecordAudio(e.target.checked)} />
                    {recordAudio ? <Mic size={13} aria-hidden /> : <MicOff size={13} aria-hidden />} Record the reading
                  </label>
                </>
              ) : (
                <>
                  {(rec === "recording" || rec === "paused") && (
                    <button type="button" className="btn" onClick={pause}>
                      {rec === "paused" ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />} {rec === "paused" ? "Resume" : "Pause"}
                    </button>
                  )}
                  <button type="button" className="btn btn--gold" onClick={finish}>
                    <Square size={13} aria-hidden /> Finish for now
                  </button>
                </>
              )}
            </div>
            {rec === "saving" && <p className="paath-sitting__note">Saving the recording… {uploadPct}%</p>}
            {rec === "saved" && <p className="paath-sitting__note">The recording is saved in today&rsquo;s entry.</p>}
            {recError && <p className="paath-error">{recError}</p>}
            {fallback && (
              <a className="paath-link" href={fallback} download={`akhand-path-${new Date().toISOString().slice(0, 10)}.webm`}>
                <Download size={13} aria-hidden /> Save the recording to this device
              </a>
            )}
            {recordings.length > 0 && (
              <ul className="paath-recordings">
                {recordings.map((r) => (
                  <li key={r.href}>
                    <span>{r.name}</span> <span className="paath-dim">{size(r.size)}</span>
                    <audio controls preload="none" src={r.href} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Reading preferences ── */}
          <div className="paath-tools" role="toolbar" aria-label="Reading preferences">
            <span className="paath-tools__group">
              <span className="paath-dim">At a time</span>
              {COUNTS.map((n) => (
                <button key={n} type="button" className="paath-chip" aria-pressed={count === n} onClick={() => setCount(n)}>{n}</button>
              ))}
            </span>
            <span className="paath-tools__group">
              {(["english", "gurmukhi", "both"] as const).map((v) => (
                <button key={v} type="button" className="paath-chip" aria-pressed={view === v || (view === "auto" && v === "both")} onClick={() => setView(v)}>
                  {v === "both" ? "Both" : v === "gurmukhi" ? "ਗੁਰਮੁਖੀ" : "English"}
                </button>
              ))}
            </span>
            <span className="paath-tools__group">
              <button type="button" className="paath-chip" aria-label="Smaller text" onClick={() => stepSize(-1)}>A−</button>
              <button type="button" className="paath-chip" aria-label="Larger text" onClick={() => stepSize(1)}>A+</button>
            </span>
          </div>

          {error && <p className="paath-error">{error}</p>}

          {/* ── The passage(s) to read now, or one picked from the side ── */}
          <section id="paath-desk" className="paath-desk" aria-label="Passages">
            {looking ? (
              <>
                <button type="button" className="paath-link" onClick={() => setLooking(null)}>
                  <ArrowLeft size={13} aria-hidden /> Back to the reading
                </button>
                <p className="paath-dim">
                  {looking.doneAt ? "Already read — you are looking back." : "Coming later — you are looking ahead."}
                </p>
                <PassageCard
                  key={`look-${looking.id}`}
                  passage={looking}
                  view={view}
                  busy={busy}
                  onUndo={looking.doneAt ? (x) => mark(x, false) : undefined}
                />
              </>
            ) : passages.length === 0 ? (
              <div className="empty">Every passage has been read. The Akhand Path is complete.</div>
            ) : (
              passages.map((p) => <PassageCard key={p.id} passage={p} view={view} busy={busy} onRead={(x) => mark(x, true)} />)
            )}
          </section>

          {/* ── Manage the reading ── */}
          <section className="paath-manage" aria-label="Manage the reading">
            <h2 className="band__title">Manage the reading</h2>
            <p className="paath-dim">Checked one by mistake? Tick it here and mark it unread; it goes back into the reading.</p>
            {recent.length === 0 ? (
              <p className="paath-dim">Nothing has been read yet.</p>
            ) : (
              <>
                <ul className="paath-manage__list">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={picked.has(r.id)}
                          onChange={(e) =>
                            setPicked((s) => {
                              const n = new Set(s);
                              if (e.target.checked) n.add(r.id);
                              else n.delete(r.id);
                              return n;
                            })
                          }
                        />
                        <span className="paath-manage__ang">{r.label}</span>
                        <span className="paath-manage__what">{r.heading || r.section}</span>
                        <span className="paath-dim">{when(r.doneAt)}{r.doneBy ? ` · ${r.doneBy}` : ""}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="paath-notes__actions" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="btn btn--primary" onClick={unreadPicked} disabled={busy || picked.size === 0}>
                    Mark {picked.size || ""} unread
                  </button>
                  {recent.length >= recentLimit && recentLimit < 50 && (
                    <button type="button" className="paath-link" onClick={() => setRecentLimit(50)}>Show more</button>
                  )}
                  {manageMsg && <span className="paath-dim">{manageMsg}</span>}
                </div>
              </>
            )}
          </section>

          {/* ── Read today ── */}
          {today.length > 0 && (
            <details className="paath-today">
              <summary>Read today ({today.length})</summary>
              {today.map((p) => (
                <PassageCard key={p.id} passage={p} view={view} busy={busy} compact onUndo={(x) => mark(x, false)} />
              ))}
            </details>
          )}
        </div>

        {/* ── Right column: what comes next, what was just read, the Talk room ── */}
        <aside className="paath-aside" aria-label="Around the reading">
          <div className="paath-aside__block">
            <p className="eyebrow">Coming next</p>
            {coming.length === 0 ? (
              <p className="paath-dim">Nothing after this.</p>
            ) : (
              <ol className="paath-peek">
                {coming.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="paath-peek__item" data-active={looking?.id === p.id} onClick={() => look(p.id, p)}>
                      <span className="paath-peek__ang">{p.label}</span>
                      <span className="paath-peek__what">{p.heading || p.section}</span>
                      <span className="paath-peek__who">{p.section} · {p.authors.join(", ")}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="paath-aside__block">
            <p className="eyebrow">Just read</p>
            {recent.length === 0 ? (
              <p className="paath-dim">Nothing yet.</p>
            ) : (
              <ol className="paath-peek">
                {recent.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <button type="button" className="paath-peek__item" data-active={looking?.id === r.id} onClick={() => look(r.id)}>
                      <span className="paath-peek__ang">{r.label}</span>
                      <span className="paath-peek__what">{r.heading || r.section}</span>
                      <span className="paath-peek__who">{when(r.doneAt)}{r.doneBy ? ` · ${r.doneBy}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {props.talkUrl && (
            <div className="paath-aside__block">
              <p className="eyebrow">Read together</p>
              <div className="session-links__row">
                <button type="button" className="btn session-links__btn" aria-pressed={inRoom} onClick={() => setInRoom((v) => !v)}>
                  <Video size={14} aria-hidden /> {inRoom ? "Leave the Talk room view" : "Join the Talk room"}
                </button>
                <a className="btn btn--small" href={props.talkUrl} target="_blank" rel="noreferrer" aria-label="Open the Talk room in a new tab">
                  <ExternalLink size={13} aria-hidden />
                </a>
              </div>
              {inRoom && (
                <div className="session-links__frame paath-call" data-kind="call">
                  <div className="circle-reader__bar">
                    <span>Talk room</span>
                    <span className="session-links__tools">
                      <button type="button" className="btn btn--small" onClick={() => void frame.current?.requestFullscreen?.().catch(() => undefined)}>
                        <Maximize2 size={12} aria-hidden /> Full screen
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => setInRoom(false)} aria-label="Close the call view"><X size={12} /></button>
                    </span>
                  </div>
                  <iframe
                    ref={frame}
                    src={props.talkUrl}
                    title="Talk room"
                    allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
                    allowFullScreen
                  />
                </div>
              )}
              <p className="paath-dim" style={{ marginTop: 8 }}>
                {call.inCall ? `${call.people} in the call${call.recording ? " · recording" : ""}` : "No one is in the call."}
              </p>
              {call.inCall && (
                <button type="button" className="paath-link" onClick={() => recordCall(!call.recording)}>
                  {call.recording ? <><Square size={12} aria-hidden /> Stop recording the call</> : <><Circle size={12} aria-hidden /> Record the call</>}
                </button>
              )}
              {callMsg && <p className="paath-dim">{callMsg}</p>}
              <p className="paath-fine">A call recording is filed into the day&rsquo;s entry a few minutes after it ends. Everyone in the call should know it is being recorded.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
