'use client';

// Recordings: the simple thread for video in the Studio. Record from this
// computer's camera, the screen or a phone (Capture), watch, rename, delete,
// and take a recording into a reel. Files live in the person's own
// Private/Video/Recordings (and the booth's Camera recordings show here too).
// Admins also see the booth's own OBS recordings ("In the booth"): copying
// one converts it to MP4 into Private/Video/Broadcasts, where it is listed
// with the rest and can be cut and given overlays in the Video kind.

import * as React from 'react';
import { Capture } from '../capture/Capture';
import { StudioColumns, StudioTopActions, useStudioFrame } from '../frame';
import type { BoothRecording, RecordingItem, RecordingKindProps } from './types';

const fmtSize = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
const mediaUrl = (base: string, path: string) => base + path.split('/').map(encodeURIComponent).join('/');
const copyPct = (b: BoothRecording) => (b.copy?.size ? `${Math.round((b.copy.sent / b.copy.size) * 100)}%` : '…');

export function RecordingKind({ initialItems, actions, uploadEndpoint, captureEndpoint, phoneHost, mediaBase, reelHref, booth }: RecordingKindProps) {
  const frame = useStudioFrame();
  const [items, setItems] = React.useState<RecordingItem[]>(initialItems);
  const [current, setCurrent] = React.useState<RecordingItem | null>(initialItems[0] ?? null);
  const [recording, setRecording] = React.useState(false);
  const [name, setName] = React.useState(current?.name.replace(/\.[^.]+$/, '') ?? '');
  const [busy, setBusy] = React.useState(false);

  const [boothItems, setBoothItems] = React.useState<BoothRecording[] | null>(null);
  const [boothCurrent, setBoothCurrent] = React.useState<string | null>(null);
  React.useEffect(() => setName(current?.name.replace(/\.[^.]+$/, '') ?? ''), [current]);

  const refresh = React.useCallback(async (select?: string) => {
    const list = await actions.list();
    setItems(list);
    setCurrent((cur) => list.find((r) => r.path === (select ?? cur?.path)) ?? list[0] ?? null);
  }, [actions]);
  // The page lists only when it opens on this kind; switching kinds in place loads here.
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // The booth's list; polled while a copy runs, and the person's list
  // refreshed when one finishes.
  const copying = boothItems?.some((b) => b.copy?.state === 'copying') ?? false;
  const loadBooth = React.useCallback(async () => {
    if (!booth) return;
    const r = await booth.list();
    if (r.ok === false) return frame.setError(r.error);
    setBoothItems((prev) => {
      const wasCopying = new Set(prev?.filter((b) => b.copy?.state === 'copying').map((b) => b.name));
      const finished = r.value.find((b) => wasCopying.has(b.name) && b.copy?.state === 'done');
      if (finished?.copy) {
        setBoothCurrent(null);
        void refresh(finished.copy.path);
      }
      return r.value;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booth, refresh]);
  React.useEffect(() => {
    void loadBooth();
  }, [loadBooth]);
  React.useEffect(() => {
    if (!copying) return;
    const t = window.setInterval(() => void loadBooth(), 2000);
    return () => window.clearInterval(t);
  }, [copying, loadBooth]);

  async function boothCopy(file: string) {
    if (!booth) return;
    const r = await booth.copy(file);
    if (r.ok === false) return frame.setError(r.error);
    await loadBooth();
  }
  async function boothRemove(file: string) {
    if (!booth || !window.confirm(`Delete “${file}” from the booth? Copies in your files stay.`)) return;
    const r = await booth.remove(file);
    if (r.ok === false) return frame.setError(r.error);
    setBoothCurrent(null);
    await loadBooth();
  }

  async function rename() {
    if (!current || !name.trim()) return;
    setBusy(true);
    const r = await actions.rename(current.path, name.trim());
    setBusy(false);
    if (r.ok === false) return frame.setError(r.error);
    await refresh(r.value.path);
  }
  async function remove() {
    if (!current || !window.confirm(`Delete “${current.name}” from your files?`)) return;
    setBusy(true);
    const r = await actions.remove(current.path);
    setBusy(false);
    if (r.ok === false) return frame.setError(r.error);
    setCurrent(null);
    await refresh();
  }

  const drawer = (
    <>
      <div className="studio-panel__h">
        <span>Recordings</span>
        <button type="button" className="studio-btn studio-btn--primary" onClick={() => setRecording(true)}>
          New recording
        </button>
      </div>
      {items.length === 0 ? (
        <p className="studio-hint">Nothing yet. Record with your camera, your screen or your phone.</p>
      ) : (
        <div className="studio-list">
          {items.map((r) => (
            <button
              key={r.path}
              type="button"
              className={`rk-row ${!recording && current?.path === r.path ? 'is-current' : ''}`}
              onClick={() => {
                setRecording(false);
                setBoothCurrent(null);
                setCurrent(r);
              }}
            >
              <span className="rk-row__title">{r.name.replace(/\.[^.]+$/, '')}</span>
              <span className="rk-row__meta">
                {fmtDate(r.modified)} · {fmtSize(r.size)}
                {r.folder === 'Camera' ? ' · booth camera' : r.folder === 'Broadcasts' ? ' · from the booth' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {booth && (
        <>
          <div className="studio-panel__h rk-booth-h">
            <span>In the booth</span>
            <button type="button" className="studio-btn studio-btn--text" onClick={() => void loadBooth()}>
              Refresh
            </button>
          </div>
          {boothItems === null ? (
            <p className="studio-hint">Looking…</p>
          ) : boothItems.length === 0 ? (
            <p className="studio-hint">No recordings in OBS.</p>
          ) : (
            <div className="studio-list">
              {boothItems.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className={`rk-row ${!recording && boothCurrent === b.name ? 'is-current' : ''}`}
                  onClick={() => {
                    setRecording(false);
                    setBoothCurrent(b.name);
                  }}
                >
                  <span className="rk-row__title">{b.name.replace(/\.[^.]+$/, '')}</span>
                  <span className="rk-row__meta">
                    {fmtDate(b.modified)} · {fmtSize(b.size)}
                    {b.copy?.state === 'copying' ? ` · copying ${copyPct(b)}` : b.copy?.state === 'done' ? ' · copied' : b.copy?.state === 'failed' ? ' · copy failed' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
  const boothItem = boothCurrent ? boothItems?.find((b) => b.name === boothCurrent) : undefined;

  const main = recording ? (
    <div className="rk-main">
      <h2 className="rk-h">New recording</h2>
      <Capture
        uploadEndpoint={uploadEndpoint}
        captureEndpoint={captureEndpoint}
        phoneHost={phoneHost}
        onSaved={(res) => {
          setRecording(false);
          void refresh(res.path);
        }}
        onCancel={items.length ? () => setRecording(false) : undefined}
      />
    </div>
  ) : boothItem ? (
    <div className="rk-main">
      <h2 className="rk-h">{boothItem.name}</h2>
      <p className="studio-hint">
        Recorded in the broadcast booth, {fmtDate(boothItem.modified)} · {fmtSize(boothItem.size)}. It is still inside OBS: copy it to your
        recordings to watch it, cut it, or give it overlays.
      </p>
      {boothItem.copy?.state === 'copying' ? (
        <>
          <progress className="rk-progress" max={1} value={boothItem.copy.size ? boothItem.copy.sent / boothItem.copy.size : undefined} />
          <p className="studio-hint">
            {boothItem.copy.step === 'sending' ? `Sending to your files: ${copyPct(boothItem)}` : 'Converting to MP4…'} (started by {boothItem.copy.by}).
            You can leave this page; it carries on.
          </p>
        </>
      ) : (
        <div className="studio-field">
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => void boothCopy(boothItem.name)}>
            {boothItem.copy?.state === 'done' ? 'Copy again' : 'Copy to my recordings'}
          </button>
          {boothItem.copy?.state === 'done' && (
            <button
              type="button"
              className="studio-btn"
              onClick={() => {
                const copy = items.find((r) => r.path === boothItem.copy?.path);
                if (copy) {
                  setBoothCurrent(null);
                  setCurrent(copy);
                } else void refresh(boothItem.copy?.path).then(() => setBoothCurrent(null));
              }}
            >
              Open the copy
            </button>
          )}
        </div>
      )}
      {boothItem.copy?.state === 'failed' && <p className="studio-err">Copy failed: {boothItem.copy.error}</p>}
      <p className="studio-hint">Copies go to Private/Video/Broadcasts in your files.</p>
      <button
        type="button"
        className="studio-btn studio-btn--dangertext"
        disabled={boothItem.copy?.state === 'copying'}
        onClick={() => void boothRemove(boothItem.name)}
      >
        Delete from the booth
      </button>
    </div>
  ) : current ? (
    <div className="rk-main">
      <h2 className="rk-h">{current.name.replace(/\.[^.]+$/, '')}</h2>
      {/* key: a new source needs a new element in some browsers */}
      <video key={current.path} className="rk-player" src={mediaUrl(mediaBase, current.path)} controls playsInline preload="metadata" />
      <p className="studio-hint">
        {fmtDate(current.modified)} · {fmtSize(current.size)} · Private/Video/{current.folder}
      </p>
    </div>
  ) : (
    <div className="rk-main">
      <p className="studio-hint">Pick a recording, or make a new one.</p>
    </div>
  );

  const settings =
    current && !recording && !boothItem ? (
      <>
        <div className="studio-panel__h">
          <span>This recording</span>
        </div>
        <div className="studio-field">
          <label className="studio-field__label" htmlFor="rk-name">
            Name
          </label>
          <input id="rk-name" className="studio-field__text" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="studio-btn" disabled={busy || !name.trim() || name === current.name.replace(/\.[^.]+$/, '')} onClick={() => void rename()}>
            Rename
          </button>
        </div>
        <div className="studio-field">
          <a className="studio-btn" href={mediaUrl(mediaBase, current.path)} download>
            Download
          </a>
          {reelHref && (
            <a className="studio-btn" href={`${reelHref}${reelHref.includes('?') ? '&' : '?'}clip=${encodeURIComponent(current.path)}`}>
              Use in a reel
            </a>
          )}
          {reelHref && (
            <a className="studio-btn" href={`${reelHref}${reelHref.includes('?') ? '&' : '?'}new=clip&clip=${encodeURIComponent(current.path)}`}>
              Cut and add overlays
            </a>
          )}
        </div>
        <button type="button" className="studio-btn studio-btn--dangertext" disabled={busy} onClick={() => void remove()}>
          Delete recording
        </button>
      </>
    ) : null;

  return (
    <>
      <StudioTopActions>
        {!recording && (
          <button type="button" className="studio-btn studio-btn--primary studio-btn--desktop" onClick={() => setRecording(true)}>
            Record
          </button>
        )}
      </StudioTopActions>
      <StudioColumns drawer={drawer} main={main} settings={settings} />
    </>
  );
}
