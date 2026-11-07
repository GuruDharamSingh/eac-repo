'use client';

// Record a video into your own files from this computer's camera, the
// screen, or your phone. Long takes are fine: the file goes up in parts while
// it records. Used by the Recordings kind and by the reel editor's slots.
//
// The host gives two routes (apps/arts-collective):
//   uploadEndpoint   signed-in chunked upload into Private/Video/Recordings
//   captureEndpoint  phone handoff codes (PhoneHandoff); absent hides "Phone"

import * as React from 'react';
import { PhoneHandoff } from './PhoneHandoff';
import { clock, extFor, pickRecordingMime, startChunkedUpload, type ChunkedUpload } from './upload';

export interface CaptureResult {
  path: string;
  name: string;
  /** Measured while recording; null when unknown (a phone that did not say). */
  seconds: number | null;
}

export interface CaptureProps {
  uploadEndpoint: string;
  captureEndpoint?: string;
  /** Shown to the person for the phone link, e.g. "arts-collective.com". */
  phoneHost?: string;
  /** Stop by itself after this long (reel slots); none by default. */
  maxSeconds?: number;
  /** Portrait for reels (9:16), landscape otherwise. */
  portrait?: boolean;
  onSaved(result: CaptureResult): void;
  onCancel?(): void;
}

type Source = 'camera' | 'screen' | 'phone';

export function Capture({ uploadEndpoint, captureEndpoint, phoneHost, maxSeconds, portrait, onSaved, onCancel }: CaptureProps) {
  const [source, setSource] = React.useState<Source | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [state, setState] = React.useState<'idle' | 'live' | 'recording' | 'saving'>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [sent, setSent] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const rec = React.useRef<MediaRecorder | null>(null);
  const up = React.useRef<ChunkedUpload | null>(null);
  const started = React.useRef(0);

  const stopTracks = React.useCallback(() => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  React.useEffect(() => stopTracks, [stopTracks]);
  React.useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  async function open(src: 'camera' | 'screen', deviceId?: string) {
    setError(null);
    stopTracks();
    try {
      const s =
        src === 'camera'
          ? await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                facingMode: deviceId ? undefined : 'user',
                width: { ideal: portrait ? 1080 : 1920 },
                height: { ideal: portrait ? 1920 : 1080 },
              },
              audio: { echoCancellation: true, noiseSuppression: true },
            })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      // Screen capture rarely carries a microphone: add one so the person can narrate.
      if (src === 'screen' && s.getAudioTracks().length === 0) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          mic.getAudioTracks().forEach((t) => s.addTrack(t));
        } catch {
          /* silent screen recording */
        }
      }
      setSource(src);
      setStream(s);
      setState('live');
      if (src === 'camera') setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'));
    } catch (err) {
      setError((err as Error).name === 'NotAllowedError' ? 'Camera or screen access was refused.' : 'No camera or microphone found.');
    }
  }

  async function record() {
    if (!stream) return;
    setError(null);
    const mime = pickRecordingMime();
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
    const name = `${source === 'screen' ? 'Screen' : 'Camera'} ${stamp}.${extFor(mime)}`;
    try {
      up.current = await startChunkedUpload(uploadEndpoint, { body: { name } }, setSent);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 160_000 } : undefined);
    r.ondataavailable = (e) => up.current?.push(e.data);
    r.onstop = async () => {
      const seconds = (Date.now() - started.current) / 1000;
      setState('saving');
      try {
        const { path } = await up.current!.finish();
        stopTracks();
        setStream(null);
        setState('idle');
        onSaved({ path, name: path.split('/').pop() ?? name, seconds });
      } catch (e) {
        setState('live');
        setError(`Not saved: ${(e as Error).message}`);
      }
    };
    rec.current = r;
    started.current = Date.now();
    setSent(0);
    setElapsed(0);
    r.start(1000);
    setState('recording');
  }

  React.useEffect(() => {
    if (state !== 'recording') return;
    const t = window.setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setElapsed(s);
      if (maxSeconds && s >= maxSeconds) rec.current?.stop();
    }, 250);
    return () => window.clearInterval(t);
  }, [state, maxSeconds]);

  if (source === 'phone' && captureEndpoint) {
    return (
      <PhoneHandoff
        captureEndpoint={captureEndpoint}
        phoneHost={phoneHost}
        onSaved={onSaved}
        onCancel={() => {
          setSource(null);
          onCancel?.();
        }}
      />
    );
  }

  return (
    <div className="cap">
      <div className={portrait ? 'cap-view cap-view--portrait' : 'cap-view'} data-source={source ?? ''}>
        {stream ? <video ref={video} autoPlay muted playsInline /> : <p>Choose a camera, the screen, or your phone.</p>}
        {state === 'recording' && (
          <span className="cap-rec">
            ● {clock(elapsed)}
            {maxSeconds ? ` / ${clock(maxSeconds)}` : ''}
          </span>
        )}
      </div>
      {error && <p className="studio-err">{error}</p>}
      {state === 'live' && source === 'camera' && devices.length > 1 && (
        <label className="studio-field">
          <span className="studio-field__label">Camera</span>
          <select
            className="studio-field__text"
            value={stream?.getVideoTracks()[0]?.getSettings().deviceId ?? ''}
            onChange={(e) => void open('camera', e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="cap-row">
        {(state === 'idle' || state === 'live') && (
          <>
            <button type="button" className={source === 'camera' ? 'studio-btn is-on' : 'studio-btn'} onClick={() => void open('camera')}>
              Camera
            </button>
            <button type="button" className={source === 'screen' ? 'studio-btn is-on' : 'studio-btn'} onClick={() => void open('screen')}>
              Screen
            </button>
            {captureEndpoint && (
              <button
                type="button"
                className="studio-btn"
                onClick={() => {
                  stopTracks();
                  setStream(null);
                  setState('idle');
                  setSource('phone');
                }}
              >
                Phone
              </button>
            )}
          </>
        )}
        {state === 'live' && (
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => void record()}>
            Start recording
          </button>
        )}
        {state === 'recording' && (
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => rec.current?.stop()}>
            Stop
          </button>
        )}
        {state === 'saving' && <span className="studio-hint">Saving…</span>}
        {onCancel && state !== 'recording' && state !== 'saving' && (
          <button
            type="button"
            className="studio-btn studio-btn--text"
            onClick={() => {
              stopTracks();
              onCancel();
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {state === 'recording' && <p className="studio-hint">{(sent / 1e6).toFixed(0)} MB saved so far; the rest goes up when you stop.</p>}
      {state !== 'recording' && <p className="studio-hint">Saved to Private/Video/Recordings in your files{maxSeconds ? `; stops by itself at ${clock(maxSeconds)}` : ''}.</p>}
    </div>
  );
}
