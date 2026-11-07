'use client';

// The broadcast booth: the server's whole OBS window in the page (noVNC
// against wayvnc), what OBS's monitor bus plays, and the program picture.
// Everything comes through the OBS agent's door (docker/obs/agent.mjs,
// served at `doorBase`), one token per connection, and only while this tab
// holds the studio's lease. The console (/studio/broadcast) and the Go live
// card stay the on-air remote.

import * as React from 'react';
import { newTabId, useBroadcastLease } from './lease';
import { CameraPanel } from './CameraPanel';
import { GraphicsPanel } from './GraphicsPanel';
import { BroadcastTabContext } from './tab-context';
import type { BroadcastDeskProps, BroadcastDoor, BroadcastStatus } from './types';

const tc = (t?: string) => (t ? t.replace(/\.\d+$/, '') : '00:00:00');

// noVNC 1.3's RFB, loaded at run time from the door (the container's own copy).
interface Rfb extends EventTarget {
  scaleViewport: boolean;
  resizeSession: boolean;
  focusOnClick: boolean;
  qualityLevel: number;
  compressionLevel: number;
  background: string;
  disconnect(): void;
  focus(): void;
  clipboardPasteFrom(text: string): void;
}
type RfbCtor = new (target: HTMLElement, url: string, options?: Record<string, unknown>) => Rfb;
let rfbModule: Promise<RfbCtor> | null = null;
function loadRfb(src: string): Promise<RfbCtor> {
  // A plain dynamic import the bundler leaves alone: the file is not in the build.
  const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<{ default: RfbCtor }>;
  rfbModule ??= importUrl(src).then((m) => m.default);
  rfbModule.catch(() => (rfbModule = null));
  return rfbModule;
}

/** Absolute http(s) or ws(s) URL for a door path. */
function doorUrl(base: string, path: string, ws = false): string {
  const u = new URL(base.replace(/\/$/, '') + path, window.location.href);
  if (ws) u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

const QUALITY = [
  { label: 'Sharp', quality: 8, compression: 2 },
  { label: 'Balanced', quality: 6, compression: 2 },
  { label: 'Low bandwidth', quality: 3, compression: 6 },
] as const;

// Monitor sound: raw s16le 48 kHz stereo from the door, scheduled on Web
// Audio with a small cushion. Further behind than MAX_AHEAD, it skips ahead.
const RATE = 48000;
const CUSHION = 0.12;
const MAX_AHEAD = 0.5;

function useMonitor(mint: (p: BroadcastDoor) => Promise<string | null>, base: string, meter: React.RefObject<HTMLSpanElement | null>) {
  const [on, setOn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [volume, setVolume] = React.useState(0.8);
  const gainRef = React.useRef<GainNode | null>(null);
  const stopRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  const stop = React.useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setOn(false);
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    // Made in the click, so the browser lets it play.
    const ctx = new AudioContext({ sampleRate: RATE, latencyHint: 'interactive' });
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    const abort = new AbortController();
    let peak = 0;
    let raf = 0;
    const draw = () => {
      if (meter.current) {
        const db = peak > 0 ? 20 * Math.log10(peak) : -60;
        meter.current.style.width = `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
        meter.current.dataset.hot = db > -3 ? 'true' : 'false';
      }
      peak *= 0.85;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    stopRef.current = () => {
      abort.abort();
      cancelAnimationFrame(raf);
      void ctx.close();
      gainRef.current = null;
      if (meter.current) meter.current.style.width = '0%';
    };
    setOn(true);

    const token = await mint('audio');
    if (!token) {
      setError('The studio did not give this tab a sound link');
      stop();
      return;
    }
    try {
      const res = await fetch(doorUrl(base, `/audio?token=${encodeURIComponent(token)}`), { cache: 'no-store', signal: abort.signal });
      if (!res.ok || !res.body) throw new Error(res.status === 403 ? 'The sound link expired; try again' : `Sound unavailable (${res.status})`);
      const reader = res.body.getReader();
      let rest = new Uint8Array(0);
      let next = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        let bytes = value;
        if (rest.length) {
          const joined = new Uint8Array(rest.length + value.length);
          joined.set(rest);
          joined.set(value, rest.length);
          bytes = joined;
        }
        const frames = Math.floor(bytes.length / 4);
        rest = bytes.slice(frames * 4);
        if (!frames) continue;
        const pcm = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + frames * 4));
        const buf = ctx.createBuffer(2, frames, RATE);
        const l = buf.getChannelData(0);
        const r = buf.getChannelData(1);
        for (let i = 0; i < frames; i++) {
          l[i] = pcm[2 * i] / 32768;
          r[i] = pcm[2 * i + 1] / 32768;
          const a = Math.max(Math.abs(l[i]), Math.abs(r[i]));
          if (a > peak) peak = a;
        }
        const now = ctx.currentTime;
        if (next < now) next = now + CUSHION;
        if (next - now > MAX_AHEAD) continue;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.start(next);
        next += buf.duration;
      }
      if (!abort.signal.aborted) setError('The sound stopped (the studio closed or OBS restarted)');
    } catch (err) {
      if (!abort.signal.aborted) setError((err as Error).message);
    }
    stop();
  }, [base, meter, mint, stop, volume]);

  React.useEffect(() => stop, [stop]);
  return { on, start, stop, error, volume, setVolume };
}

export function BroadcastDesk({
  initialStatus,
  actions: bound,
  doorBase,
  releaseEndpoint,
  links,
  extra,
  graphicsUploadEndpoint,
  cameraUploadEndpoint,
}: BroadcastDeskProps) {
  const [tabId] = React.useState(newTabId);
  const claim = useBroadcastLease(bound.claim, tabId, releaseEndpoint);
  const held = claim?.held === true;

  const mint = React.useCallback(
    async (purpose: BroadcastDoor) => {
      const r = await bound.doorToken(tabId, purpose);
      return r.ok ? r.value.token : null;
    },
    [bound, tabId]
  );

  const [status, setStatus] = React.useState<BroadcastStatus>(initialStatus);
  React.useEffect(() => {
    if (!held) return;
    void bound.status(tabId).then(setStatus);
    const t = window.setInterval(() => void bound.status(tabId).then(setStatus), 2000);
    return () => window.clearInterval(t);
  }, [bound, tabId, held]);

  // --- Desktop -------------------------------------------------------------
  const screenRef = React.useRef<HTMLDivElement>(null);
  const deskRef = React.useRef<HTMLDivElement>(null);
  const rfbRef = React.useRef<Rfb | null>(null);
  const [desk, setDesk] = React.useState<'connecting' | 'connected' | 'closed'>('connecting');
  const [deskError, setDeskError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [quality, setQuality] = React.useState(1);
  const [obsClip, setObsClip] = React.useState('');
  const [clip, setClip] = React.useState('');
  const retries = React.useRef(0);
  const qualityRef = React.useRef(quality);
  qualityRef.current = quality;

  React.useEffect(() => {
    if (!held || !screenRef.current) return;
    let gone = false;
    let rfb: Rfb | null = null;
    setDesk('connecting');
    setDeskError(null);
    (async () => {
      try {
        const [RFB, token] = await Promise.all([loadRfb(doorUrl(doorBase, '/desktop/core/rfb.js')), mint('desktop')]);
        if (gone || !screenRef.current) return;
        if (!token) throw new Error('The studio did not give this tab a desktop link');
        rfb = new RFB(screenRef.current, doorUrl(doorBase, `/desktop/ws?token=${encodeURIComponent(token)}`, true), { wsProtocols: ['binary'] });
        rfbRef.current = rfb;
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.focusOnClick = true;
        rfb.background = '#141110';
        rfb.qualityLevel = QUALITY[qualityRef.current].quality;
        rfb.compressionLevel = QUALITY[qualityRef.current].compression;
        rfb.addEventListener('connect', () => {
          retries.current = 0;
          setDesk('connected');
        });
        rfb.addEventListener('clipboard', (e) => setObsClip((e as CustomEvent<{ text: string }>).detail.text));
        rfb.addEventListener('disconnect', () => {
          rfbRef.current = null;
          if (gone) return;
          setDesk('closed');
          // A dropped connection (network, OBS restart) tries again a few times.
          if (retries.current++ < 3) window.setTimeout(() => !gone && setAttempt((n) => n + 1), 2000 * retries.current);
        });
      } catch (err) {
        if (gone) return;
        setDesk('closed');
        setDeskError(
          rfbModule === null ? 'The desktop client did not load. Is the /obs/ door set up on this host?' : (err as Error).message
        );
      }
    })();
    return () => {
      gone = true;
      rfb?.disconnect();
      rfbRef.current = null;
    };
  }, [held, attempt, doorBase, mint]);

  React.useEffect(() => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    rfb.qualityLevel = QUALITY[quality].quality;
    rfb.compressionLevel = QUALITY[quality].compression;
  }, [quality]);

  async function fullscreen() {
    const el = deskRef.current;
    if (!el) return;
    if (document.fullscreenElement) return void document.exitFullscreen();
    await el.requestFullscreen().catch(() => {});
    // In full screen, Chromium can pass Ctrl+W, Ctrl+T and Esc on to OBS.
    const kb = (navigator as Navigator & { keyboard?: { lock?: () => Promise<void> } }).keyboard;
    await kb?.lock?.().catch(() => {});
    rfbRef.current?.focus();
  }

  // --- Program picture ------------------------------------------------------
  const [programOn, setProgramOn] = React.useState(true);
  const [programSrc, setProgramSrc] = React.useState<string | null>(null);
  const [programTry, setProgramTry] = React.useState(0);
  const imgRef = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    if (!held || !programOn) return;
    let gone = false;
    void mint('program').then((token) => {
      if (!gone && token) setProgramSrc(doorUrl(doorBase, `/program?token=${encodeURIComponent(token)}&fps=5&w=640`));
    });
    return () => {
      gone = true;
      // Ends the stream: an <img> taken out of the page may keep loading.
      if (imgRef.current) imgRef.current.src = '';
      setProgramSrc(null);
    };
  }, [held, programOn, programTry, doorBase, mint]);

  // --- Sound ----------------------------------------------------------------
  const meterRef = React.useRef<HTMLSpanElement>(null);
  const monitor = useMonitor(mint, doorBase, meterRef);
  const stopMonitor = monitor.stop;
  React.useEffect(() => {
    if (!held) stopMonitor();
  }, [held, stopMonitor]);

  const rec = status.recording;
  const str = status.streaming;
  const st = status.stats;

  const header = (
    <header className="studio-top">
      <a className="studio-back" href={links.studioHref} title="Back to the Studio">
        ←
      </a>
      <span className="studio-wordmark">Studio · Broadcast</span>
      <nav className="bd-tabs" aria-label="Broadcast">
        <a className="studio-btn" href={links.consoleHref}>
          Console
        </a>
        <span className="studio-btn" aria-current="page">
          Desktop
        </span>
      </nav>
      <a className="studio-btn" href={links.videoHref}>
        Video
      </a>
      <span className="studio-spacer" />
      {held && (
        <span className="studio-status bd-status" aria-live="polite">
          {!status.connected && <span className="studio-err">OBS is not running</span>}
          {rec?.active && <b className="bc-live">● REC {tc(rec.timecode)}</b>}
          {str?.active && <b className="bc-live">● LIVE {tc(str.timecode)}</b>}
          {st && (
            <span className="vs-faint">
              {st.fps.toFixed(0)} fps · OBS CPU {st.cpu.toFixed(0)}%
            </span>
          )}
        </span>
      )}
    </header>
  );

  if (!held) {
    return (
      <div className="studio vs bc bd">
        {header}
        <div className="vs-empty bc-locked" role="status">
          {claim === null ? (
            <p>Opening the studio…</p>
          ) : claim.error ? (
            <p className="studio-err">{claim.error}</p>
          ) : (
            <>
              <p>
                <b>The broadcast studio is open in another session</b>
                {claim.lock ? ` (${claim.lock.name}, since ${new Date(claim.lock.since).toLocaleTimeString()})` : ''}.
              </p>
              <p className="vs-faint">
                One session at a time, the console and this desktop included. This page takes the studio by itself about 20
                seconds after that session closes.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="studio vs bc bd">
      {header}
      <div className="bd-body">
        <div className="bd-desk" ref={deskRef}>
          <div className="bd-screen" ref={screenRef} />
          {desk !== 'connected' && (
            <div className="bd-veil" role="status">
              {desk === 'connecting' ? (
                <p>Connecting to the OBS desktop…</p>
              ) : (
                <>
                  <p>{deskError ?? 'The desktop connection closed.'}</p>
                  <button
                    type="button"
                    className="studio-btn studio-btn--primary"
                    onClick={() => {
                      retries.current = 0;
                      setAttempt((n) => n + 1);
                    }}
                  >
                    Reconnect
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="vs-panel bd-panel">
          <h2>Program</h2>
          <section className="vs-slot">
            <div className="bc-program bd-program">
              {programOn && programSrc ? (
                <img
                  ref={imgRef}
                  src={programSrc}
                  alt="Program output"
                  onError={() => window.setTimeout(() => setProgramTry((n) => n + 1), 2000)}
                />
              ) : (
                <p className="vs-faint">{programOn ? 'Loading picture…' : 'Picture off'}</p>
              )}
            </div>
            <label className="vs-check">
              <input type="checkbox" checked={programOn} onChange={(e) => setProgramOn(e.target.checked)} />
              Live picture (5 frames a second; the stream and recordings are full rate)
            </label>
          </section>

          <h2>Listen</h2>
          <section className="vs-slot">
            <div className="vs-row">
              <button
                type="button"
                className={monitor.on ? 'studio-btn' : 'studio-btn studio-btn--primary'}
                onClick={() => (monitor.on ? monitor.stop() : void monitor.start())}
              >
                {monitor.on ? 'Stop listening' : 'Listen'}
              </button>
              <span className="bd-meter" aria-hidden="true">
                <span ref={meterRef} />
              </span>
            </div>
            <label className="vs-field">
              Volume
              <input type="range" min={0} max={1} step={0.05} value={monitor.volume} onChange={(e) => monitor.setVolume(Number(e.target.value))} />
            </label>
            {monitor.error && <p className="studio-err">{monitor.error}</p>}
            <p className="vs-faint">
              What OBS monitors: sources set to “Monitor and Output” (Advanced Audio Properties). The browser page and the media clip
              are monitored by default. About a quarter second behind.
            </p>
          </section>

          {bound.graphics && (
            <>
              <h2>Graphics</h2>
              <GraphicsPanel
                graphics={status.graphics}
                disabled={!status.connected}
                send={async (cmd) => {
                  const r = await bound.graphics!(tabId, cmd);
                  setStatus(await bound.status(tabId));
                  return r;
                }}
                deleteFolder={
                  bound.deleteGraphic
                    ? async (folder) => {
                        const r = await bound.deleteGraphic!(tabId, folder);
                        setStatus(await bound.status(tabId));
                        return r;
                      }
                    : undefined
                }
                upload={
                  graphicsUploadEndpoint
                    ? async (folder, files) => {
                        const form = new FormData();
                        form.append('tabId', tabId);
                        form.append('folder', folder);
                        for (const f of files) {
                          form.append('path', f.path);
                          form.append('file', f.file);
                        }
                        const res = await fetch(graphicsUploadEndpoint, { method: 'POST', body: form });
                        const j = (await res.json().catch(() => ({}))) as { error?: string };
                        setStatus(await bound.status(tabId));
                        return res.ok ? { ok: true } : { ok: false, error: j.error ?? `Upload failed (${res.status})` };
                      }
                    : undefined
                }
              />
            </>
          )}

          <h2>Camera</h2>
          <CameraPanel
            scenes={status.scenes ?? []}
            program={status.currentScene}
            disabled={!status.connected}
            uploadEndpoint={cameraUploadEndpoint}
            mediaBase={'/api/media/'}
            cameraWsUrl={
              doorBase
                ? async ({ name, scene, layout }) => {
                    const r = await bound.doorToken(tabId, 'camera');
                    if (r.ok === false) return null;
                    const u = new URL(`${doorBase!.replace(/\/$/, '')}/camera/ws`, window.location.href);
                    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
                    u.search = new URLSearchParams({ token: r.value.token, name, scene, layout }).toString();
                    return u.toString();
                  }
                : undefined
            }
          />

          {extra && <BroadcastTabContext.Provider value={tabId}>{extra}</BroadcastTabContext.Provider>}

          <h2>Desktop</h2>
          <section className="vs-slot">
            <div className="vs-row">
              <label className="vs-field bd-inline">
                Picture
                <select value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
                  {QUALITY.map((q, i) => (
                    <option key={q.label} value={i}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="studio-btn" onClick={() => void fullscreen()}>
                Full screen
              </button>
            </div>
            <label className="vs-field">
              Clipboard
              <textarea rows={3} value={clip} placeholder="Text to paste into OBS" onChange={(e) => setClip(e.target.value)} />
            </label>
            <div className="vs-row">
              <button
                type="button"
                className="studio-btn"
                disabled={!clip || desk !== 'connected'}
                onClick={() => {
                  rfbRef.current?.clipboardPasteFrom(clip);
                  rfbRef.current?.focus();
                }}
              >
                Send to OBS
              </button>
              <button type="button" className="studio-btn" disabled={!obsClip} onClick={() => setClip(obsClip)}>
                Take OBS’s clipboard
              </button>
            </div>
            <p className="vs-faint">
              “Send to OBS” fills OBS’s clipboard; then paste there with Ctrl+V. Shortcuts the browser keeps (Ctrl+W, Ctrl+T) reach
              OBS only in full screen.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
