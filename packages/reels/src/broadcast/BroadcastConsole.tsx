'use client';

// Control panel for the server's OBS instance (docker/obs): live program
// picture, scenes, the Browser scene's page, record and stream, and the
// recordings OBS has written, which can be saved into the person's files.
// The full OBS window (sources, filters, layout) is noVNC; this panel covers
// the run of a session.

import * as React from 'react';
import type { BroadcastConsoleProps, BroadcastRecording, BroadcastStatus } from './types';

const fmtBytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`);
const tc = (t?: string) => (t ? t.replace(/\.\d+$/, '') : '00:00:00');

/** Tab id: one session is one tab, so a second tab of the same person is refused too. */
function newTabId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

export function BroadcastConsole({ initialStatus, actions: bound, mediaBase, links, releaseEndpoint }: BroadcastConsoleProps) {
  const [tabId] = React.useState(newTabId);
  // The rest of the component calls actions without the tab id.
  const actions = React.useMemo(
    () => ({
      status: () => bound.status(tabId),
      screenshot: () => bound.screenshot(tabId),
      setScene: (n: string) => bound.setScene(tabId, n),
      setBrowserUrl: (u: string) => bound.setBrowserUrl(tabId, u),
      record: (a: 'start' | 'stop') => bound.record(tabId, a),
      stream: (a: 'start' | 'stop') => bound.stream(tabId, a),
      streamSettings: (sv: string, k: string) => bound.streamSettings(tabId, sv, k),
      recordings: () => bound.recordings(tabId),
      saveRecording: (f: string) => bound.saveRecording(tabId, f),
      deleteRecording: (f: string) => bound.deleteRecording(tabId, f),
    }),
    [bound, tabId]
  );
  // null: not asked yet; then the agent's answer, renewed every 5 s. The
  // lease lapses 20 s after the last renewal, so a crashed tab frees itself.
  const [claim, setClaim] = React.useState<{ held: boolean; lock: { name: string; since: string } | null; error?: string } | null>(null);
  React.useEffect(() => {
    let stop = false;
    const tick = async () => {
      const c = await bound.claim(tabId);
      if (!stop) setClaim(c);
    };
    void tick();
    const t = window.setInterval(tick, 5000);
    const release = () => navigator.sendBeacon?.(releaseEndpoint, tabId);
    window.addEventListener('pagehide', release);
    return () => {
      stop = true;
      window.clearInterval(t);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [bound, tabId, releaseEndpoint]);
  const held = claim?.held === true;

  const [status, setStatus] = React.useState<BroadcastStatus>(initialStatus);
  const [shot, setShot] = React.useState<string | null>(null);
  const [recs, setRecs] = React.useState<BroadcastRecording[]>([]);
  const [url, setUrl] = React.useState(initialStatus.browserUrl ?? '');
  const [server, setServer] = React.useState('rtmp://a.rtmp.youtube.com/live2');
  const [key, setKey] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<Record<string, string>>({});
  const [live, setLive] = React.useState(true);

  // Status every 2 s; the picture every 1 s while "Live picture" is on.
  React.useEffect(() => {
    if (!held) return;
    const t = window.setInterval(() => void actions.status().then(setStatus), 2000);
    return () => window.clearInterval(t);
  }, [actions, held]);
  React.useEffect(() => {
    if (!live || !held) return;
    let stop = false;
    const tick = async () => {
      const s = await actions.screenshot();
      if (!stop) {
        setShot(s);
        window.setTimeout(tick, 1000);
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [live, actions, held]);
  const loadRecs = React.useCallback(() => void actions.recordings().then(setRecs), [actions]);
  React.useEffect(() => {
    if (held) loadRecs();
  }, [held, loadRecs]);

  async function act(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(label);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (res.ok === false) setError(res.error ?? 'Failed');
    setStatus(await actions.status());
  }

  const rec = status.recording;
  const str = status.streaming;
  const st = status.stats;

  if (!held) {
    return (
      <div className="studio vs bc">
        <header className="studio-top">
          <a className="studio-back" href={links.studioHref} title="Back to the Studio">
            ←
          </a>
          <span className="studio-wordmark">Studio · Broadcast</span>
          <a className="studio-btn" href={links.videoHref}>
            Video
          </a>
        </header>
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
                One session at a time. This page takes over by itself about 20 seconds after that session closes.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="studio vs bc">
      <header className="studio-top">
        <a className="studio-back" href={links.studioHref} title="Back to the Studio">
          ←
        </a>
        <span className="studio-wordmark">Studio · Broadcast</span>
        <a className="studio-btn" href={links.videoHref}>
          Video
        </a>
        <span className="studio-spacer" />
        <span className="studio-status" aria-live="polite">
          {!status.connected && <span className="studio-err">OBS is not running</span>}
          {rec?.active && <b className="bc-live">● REC {tc(rec.timecode)}</b>}
          {str?.active && <b className="bc-live">● LIVE {tc(str.timecode)}</b>}
        </span>
        <button
          type="button"
          className="studio-btn studio-btn--primary"
          disabled={!status.connected || busy !== null}
          onClick={() =>
            void act('rec', async () => {
              const r = await actions.record(rec?.active ? 'stop' : 'start');
              if (rec?.active) window.setTimeout(loadRecs, 1500);
              return r;
            })
          }
        >
          {rec?.active ? 'Stop recording' : 'Record'}
        </button>
      </header>

      {error && (
        <div className="vs-error" role="alert">
          {error} <button type="button" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="bc-body">
        <main className="bc-stage">
          <div className="bc-program">
            {shot ? <img src={shot} alt="Program output" /> : <p className="vs-faint">{status.connected ? 'Loading picture…' : 'Waiting for OBS…'}</p>}
          </div>
          <div className="vs-row">
            <label className="vs-check">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
              Live picture (about one frame a second; recordings are full rate)
            </label>
          </div>
          <h2>Scenes</h2>
          <div className="bc-scenes">
            {(status.scenes ?? []).map((s) => (
              <button
                key={s}
                type="button"
                className="studio-btn"
                aria-pressed={s === status.currentScene}
                disabled={busy !== null}
                onClick={() => void act('scene', () => actions.setScene(s))}
              >
                {s}
              </button>
            ))}
          </div>
          {st && (
            <p className="vs-faint bc-stats">
              {st.fps.toFixed(0)} fps · CPU {st.cpu.toFixed(0)}% · render {st.renderMs.toFixed(1)} ms · skipped{' '}
              {st.renderSkipped} rendered / {st.outputSkipped} encoded of {st.outputTotal}
            </p>
          )}
        </main>

        <aside className="vs-panel">
          <h2>Browser scene</h2>
          <section className="vs-slot">
            <p className="vs-faint">A web page shown full-frame in the “Browser” scene: a guest’s page, a slideshow, a live map.</p>
            <label className="vs-field">
              Address
              <input value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
            </label>
            <button
              type="button"
              className="studio-btn vs-pick"
              disabled={!status.connected || busy !== null}
              onClick={() => void act('url', () => actions.setBrowserUrl(url.trim() || 'about:blank'))}
            >
              Load page
            </button>
          </section>

          <h2>Stream</h2>
          <section className="vs-slot">
            <label className="vs-field">
              Server (RTMP)
              <input value={server} onChange={(e) => setServer(e.target.value)} />
            </label>
            <label className="vs-field">
              Stream key
              <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
            </label>
            <div className="vs-row">
              <button
                type="button"
                className="studio-btn"
                disabled={!status.connected || busy !== null || !key || str?.active}
                onClick={() => void act('settings', () => actions.streamSettings(server.trim(), key.trim()))}
              >
                Save stream settings
              </button>
              <button
                type="button"
                className="studio-btn studio-btn--primary"
                disabled={!status.connected || busy !== null}
                onClick={() => void act('stream', () => actions.stream(str?.active ? 'stop' : 'start'))}
              >
                {str?.active ? 'End stream' : 'Go live'}
              </button>
            </div>
            <p className="vs-faint">The key is sent to OBS and kept there; this page does not store it.</p>
          </section>

          <h2>Recordings</h2>
          <section className="vs-slot">
            {recs.length === 0 && <p className="vs-faint">None yet.</p>}
            {recs.map((r) => (
              <div key={r.name} className="bc-rec">
                <div>
                  <b>{r.name}</b>
                  <small className="vs-faint">
                    {' '}
                    {fmtBytes(r.size)} · {new Date(r.modified).toLocaleString()}
                  </small>
                </div>
                {saved[r.name] ? (
                  <a className="vs-link" href={mediaBase + saved[r.name].split('/').map(encodeURIComponent).join('/')} target="_blank" rel="noreferrer">
                    Saved — open
                  </a>
                ) : (
                  <div className="vs-row">
                    <button
                      type="button"
                      className="studio-btn"
                      disabled={busy !== null || (rec?.active && r === recs[0])}
                      onClick={async () => {
                        setBusy('save');
                        setError(null);
                        const res = await actions.saveRecording(r.name);
                        setBusy(null);
                        if (res.ok === false) setError(res.error);
                        else setSaved((s) => ({ ...s, [r.name]: res.value.path }));
                      }}
                    >
                      {busy === 'save' ? 'Saving…' : 'Save to my files'}
                    </button>
                    <button
                      type="button"
                      className="vs-link"
                      disabled={busy !== null}
                      onClick={async () => {
                        if (!window.confirm(`Delete ${r.name} from the OBS server?`)) return;
                        const res = await actions.deleteRecording(r.name);
                        if (res.ok === false) setError(res.error);
                        loadRecs();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            <p className="vs-faint">Saved recordings go to your private Video/Broadcasts folder as MP4.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
