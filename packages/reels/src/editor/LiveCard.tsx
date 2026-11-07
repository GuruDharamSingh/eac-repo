'use client';

// "Go live" inside the Video kind (2026-11-01): the server OBS instance's
// stream, started from here with a destination and a key, for admins. The
// full console (scenes, recordings, live picture) stays at /studio/broadcast;
// this card only sets the destination and starts or stops the stream, and
// holds the studio's lease while it is live, renewed every 5 s like the console.
// With `relay` (2026-11-01) the body is RelayPanel: saved destinations, one
// stream to the relay, copied to each; without it, one destination direct.

import * as React from 'react';
import type { BroadcastClaim, BroadcastResult, BroadcastStatus } from '../broadcast/types';
import { RelayPanel } from './RelayPanel';
import type { RelayActions } from './relay-types';

export interface LiveCardProps {
  peek(): Promise<BroadcastStatus>;
  claim(tabId: string): Promise<BroadcastClaim>;
  stream(tabId: string, action: 'start' | 'stop'): Promise<BroadcastResult>;
  streamSettings(tabId: string, server: string, key: string): Promise<BroadcastResult>;
  releaseEndpoint: string;
  consoleHref: string;
  /** The stream relay (docker/relay); passed when the server has one. */
  relay?: RelayActions;
}

const DESTINATIONS = [
  { id: 'youtube', label: 'YouTube Live', server: 'rtmp://a.rtmp.youtube.com/live2', hint: 'YouTube Studio → Go live → Stream key' },
  { id: 'facebook', label: 'Facebook Live', server: 'rtmps://live-api-s.facebook.com:443/rtmp/', hint: 'Facebook Live Producer → Streaming software → Stream key' },
  { id: 'custom', label: 'Another RTMP server', server: '', hint: 'The server address the platform gives you' },
] as const;

function newTabId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

const tc = (t?: string) => (t ? t.replace(/\.\d+$/, '') : '00:00:00');

export function LiveCard(props: LiveCardProps) {
  const [tabId] = React.useState(newTabId);
  const [status, setStatus] = React.useState<BroadcastStatus | null>(null);
  const [dest, setDest] = React.useState<(typeof DESTINATIONS)[number]['id']>('youtube');
  const [server, setServer] = React.useState('');
  const [key, setKey] = React.useState('');
  const [held, setHeld] = React.useState(false);
  const [lock, setLock] = React.useState<{ name: string; since: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  // A look at OBS every 5 s; no lease needed for that.
  React.useEffect(() => {
    let stop = false;
    const tick = () => void props.peek().then((s) => !stop && setStatus(s)).catch(() => {});
    tick();
    const t = window.setInterval(tick, 5000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [props]);

  // Hold the lease only while we are live from here; release when the page goes.
  React.useEffect(() => {
    if (!held) return;
    const t = window.setInterval(() => void props.claim(tabId).then((c) => { setLock(c.lock); if (!c.held) setHeld(false); }), 5000);
    const release = () => navigator.sendBeacon?.(props.releaseEndpoint, tabId);
    window.addEventListener('pagehide', release);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('pagehide', release);
    };
  }, [held, props, tabId]);

  const live = Boolean(status?.streaming?.active);
  const resolvedServer = dest === 'custom' ? server.trim() : DESTINATIONS.find((d) => d.id === dest)!.server;

  async function goLive() {
    setBusy('start');
    setError(null);
    const c = await props.claim(tabId);
    setLock(c.lock);
    if (!c.held) {
      setBusy(null);
      return setError(c.error ?? (c.lock ? `${c.lock.name} has the studio open.` : 'Could not take the studio.'));
    }
    setHeld(true);
    const s = await props.streamSettings(tabId, resolvedServer, key.trim());
    if ('error' in s) {
      setBusy(null);
      return setError(s.error);
    }
    const r = await props.stream(tabId, 'start');
    setBusy(null);
    if ('error' in r) return setError(r.error);
    setKey('');
    setStatus(await props.peek());
  }

  async function takeStudio(): Promise<string | null> {
    const c = await props.claim(tabId);
    setLock(c.lock);
    if (!c.held) return c.error ?? (c.lock ? `${c.lock.name} has the studio open.` : 'Could not take the studio.');
    setHeld(true);
    return null;
  }

  function releaseStudio() {
    navigator.sendBeacon?.(props.releaseEndpoint, tabId);
    setHeld(false);
  }

  async function stop() {
    setBusy('stop');
    setError(null);
    // A reload or another tab: take the lease again before stopping (the
    // agent refuses commands without one; found on the first live test).
    if (!held) {
      const c = await props.claim(tabId);
      setLock(c.lock);
      if (!c.held) {
        setBusy(null);
        return setError(c.error ?? (c.lock ? `${c.lock.name} has the studio open.` : 'Could not take the studio.'));
      }
      setHeld(true);
    }
    const r = await props.stream(tabId, 'stop');
    setBusy(null);
    if ('error' in r) return setError(r.error);
    navigator.sendBeacon?.(props.releaseEndpoint, tabId);
    setHeld(false);
    setStatus(await props.peek());
  }

  return (
    <section className="vs-live" aria-label="Go live">
      <button type="button" className="vs-live__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`vs-live__dot ${live ? 'is-live' : status?.connected ? 'is-ready' : ''}`} aria-hidden />
        <b>{live ? `Live · ${tc(status?.streaming?.timecode)}` : status?.connected ? 'Ready to stream' : 'Stream studio off'}</b>
        <span className="vs-faint">{open ? 'hide' : 'OBS'}</span>
      </button>
      {open && (
        <div className="vs-live__body">
          {!status?.connected && <p className="vs-faint">The server OBS is not reachable right now.</p>}
          {lock && !held && <p className="vs-faint">{lock.name} has the studio open since {new Date(lock.since).toLocaleTimeString()}.</p>}
          {props.relay ? (
            <RelayPanel
              actions={props.relay}
              tabId={tabId}
              obsConnected={Boolean(status?.connected)}
              live={live}
              takeStudio={takeStudio}
              releaseStudio={releaseStudio}
              onChanged={() => void props.peek().then(setStatus)}
            />
          ) : !live ? (
            <>
              <label className="vs-live__field">
                <span>Destination</span>
                <select value={dest} onChange={(e) => setDest(e.target.value as typeof dest)}>
                  {DESTINATIONS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </label>
              {dest === 'custom' && (
                <label className="vs-live__field">
                  <span>Server</span>
                  <input value={server} placeholder="rtmp://…" onChange={(e) => setServer(e.target.value)} />
                </label>
              )}
              <label className="vs-live__field">
                <span>Stream key</span>
                <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
                <small className="vs-faint">{DESTINATIONS.find((d) => d.id === dest)!.hint}. Sent to OBS, not stored here.</small>
              </label>
              <button
                type="button"
                className="studio-btn studio-btn--primary"
                disabled={!status?.connected || !key.trim() || !resolvedServer || busy !== null}
                onClick={() => void goLive()}
              >
                {busy === 'start' ? 'Starting…' : 'Go live'}
              </button>
            </>
          ) : (
            <button type="button" className="studio-btn studio-btn--danger" disabled={busy !== null} onClick={() => void stop()}>
              {busy === 'stop' ? 'Stopping…' : 'Stop streaming'}
            </button>
          )}
          {status?.recording?.active && <p className="vs-faint">Recording · {tc(status.recording.timecode)}</p>}
          {error && <p className="studio-err">{error}</p>}
          <a className="vs-faint" href={props.consoleHref}>Scenes, recordings and the live picture: open the console →</a>
        </div>
      )}
    </section>
  );
}
