'use client';

// The phone's half (/c/<code>): pick the front or back camera, record, stop.
// The video goes up in parts while it records, with the code as the only
// credential, into the Recordings of whoever made the code. Made for a
// phone held in the hand: big buttons, no account, nothing else on screen.

import * as React from 'react';
import { clock, extFor, pickRecordingMime, startChunkedUpload, type ChunkedUpload } from './upload';

export interface PhoneCaptureProps {
  /** The code's route, e.g. "/api/capture/7KQ2MXP4". */
  endpoint: string;
  studioName: string;
}

export function PhoneCapture({ endpoint, studioName }: PhoneCaptureProps) {
  const [facing, setFacing] = React.useState<'user' | 'environment'>('environment');
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [state, setState] = React.useState<'idle' | 'live' | 'recording' | 'saving' | 'done'>('idle');
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

  async function open(f = facing) {
    setError(null);
    stopTracks();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: f }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setStream(s);
      setFacing(f);
      setState('live');
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? 'Allow the camera and microphone for this page, then try again.' : (e as Error).message);
    }
  }

  async function record() {
    if (!stream) return;
    setError(null);
    const mime = pickRecordingMime();
    try {
      up.current = await startChunkedUpload(endpoint, { query: { ext: extFor(mime) } }, setSent);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    void fetch(`${endpoint}?op=recording`, { method: 'POST' }).catch(() => {});
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 } : undefined);
    r.ondataavailable = (e) => up.current?.push(e.data);
    r.onstop = async () => {
      const seconds = (Date.now() - started.current) / 1000;
      setState('saving');
      try {
        await up.current!.finish({ seconds: seconds.toFixed(2) });
        stopTracks();
        setStream(null);
        setState('done');
      } catch (e) {
        setState('live');
        setError(`Not sent: ${(e as Error).message}`);
        void fetch(`${endpoint}?op=failed&error=${encodeURIComponent((e as Error).message)}`, { method: 'POST' }).catch(() => {});
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
    const t = window.setInterval(() => setElapsed((Date.now() - started.current) / 1000), 250);
    return () => window.clearInterval(t);
  }, [state]);

  return (
    <div className="pc">
      <header className="pc-head">{studioName}</header>
      {state === 'done' ? (
        <div className="pc-done">
          <p>
            <b>Sent.</b> The video is in your Recordings on your computer.
          </p>
          <p className="pc-faint">You can close this page.</p>
        </div>
      ) : (
        <>
          <div className="pc-view">
            {stream ? <video ref={video} autoPlay muted playsInline className={facing === 'user' ? 'is-mirror' : ''} /> : <p>Your camera will appear here.</p>}
            {state === 'recording' && <span className="pc-rec">● {clock(elapsed)}</span>}
          </div>
          {error && <p className="pc-err">{error}</p>}
          <div className="pc-actions">
            {state === 'idle' && (
              <button type="button" className="pc-btn pc-btn--primary" onClick={() => void open()}>
                Turn on camera
              </button>
            )}
            {state === 'live' && (
              <>
                <button type="button" className="pc-btn pc-btn--record" onClick={() => void record()} aria-label="Start recording">
                  ● Record
                </button>
                <button type="button" className="pc-btn" onClick={() => void open(facing === 'user' ? 'environment' : 'user')}>
                  {facing === 'user' ? 'Use back camera' : 'Use front camera'}
                </button>
              </>
            )}
            {state === 'recording' && (
              <button type="button" className="pc-btn pc-btn--record is-on" onClick={() => rec.current?.stop()} aria-label="Stop recording">
                ■ Stop
              </button>
            )}
            {state === 'saving' && <p className="pc-faint">Sending… keep this page open.</p>}
          </div>
          {state === 'recording' && <p className="pc-faint">{(sent / 1e6).toFixed(0)} MB sent so far.</p>}
        </>
      )}
    </div>
  );
}
