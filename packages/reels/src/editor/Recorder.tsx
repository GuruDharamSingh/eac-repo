'use client';

// Record a clip in the browser (camera or screen) straight into a slot.
// MediaRecorder writes WebM in Chrome/Firefox and MP4 in Safari; the
// renderer re-encodes WebM before rendering (render/render.mjs
// normalizeClips). The duration is measured here because MediaRecorder WebM
// carries none.

import * as React from 'react';

type Source = 'camera' | 'screen';

function pickMime(): string {
  const options = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export function Recorder({
  maxSeconds,
  onDone,
  onCancel,
}: {
  maxSeconds: number;
  onDone: (file: File, seconds: number) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = React.useState<Source>('camera');
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [state, setState] = React.useState<'idle' | 'live' | 'recording'>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const started = React.useRef(0);

  const stop = React.useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);
  React.useEffect(() => stop, [stop]);

  React.useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  async function start(src: Source) {
    setError(null);
    stop();
    try {
      const s =
        src === 'camera'
          ? await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 } },
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
    } catch (err) {
      setError((err as Error).name === 'NotAllowedError' ? 'Camera or screen access was refused.' : 'No camera or microphone found.');
    }
  }

  function record() {
    if (!stream) return;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const seconds = (Date.now() - started.current) / 1000;
      const type = rec.mimeType || mime || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File(chunks.current, `recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, {
        type: type.split(';')[0],
      });
      stop();
      setState('idle');
      onDone(file, seconds);
    };
    recorder.current = rec;
    started.current = Date.now();
    rec.start(1000);
    setState('recording');
    setElapsed(0);
  }

  React.useEffect(() => {
    if (state !== 'recording') return;
    const t = window.setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setElapsed(s);
      if (s >= maxSeconds) recorder.current?.stop();
    }, 200);
    return () => window.clearInterval(t);
  }, [state, maxSeconds]);

  return (
    <div className="vs-recorder">
      <div className="vs-recorder__view" data-source={source}>
        {stream ? <video ref={video} autoPlay muted playsInline /> : <p className="vs-faint">Choose camera or screen.</p>}
        {state === 'recording' && (
          <span className="vs-recorder__rec">
            ● {elapsed.toFixed(1)} / {maxSeconds} s
          </span>
        )}
      </div>
      {error && <p className="studio-err">{error}</p>}
      <div className="vs-row">
        {state !== 'recording' && (
          <>
            <button type="button" className="studio-btn" onClick={() => void start('camera')}>
              Camera
            </button>
            <button type="button" className="studio-btn" onClick={() => void start('screen')}>
              Screen
            </button>
          </>
        )}
        {state === 'live' && (
          <button type="button" className="studio-btn studio-btn--primary" onClick={record}>
            Start recording
          </button>
        )}
        {state === 'recording' && (
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => recorder.current?.stop()}>
            Stop
          </button>
        )}
        {state !== 'recording' && (
          <button
            type="button"
            className="vs-link"
            onClick={() => {
              stop();
              onCancel();
            }}
          >
            Cancel
          </button>
        )}
      </div>
      <p className="vs-faint">Recording stops by itself at {maxSeconds} s. It is uploaded to your files when you stop.</p>
    </div>
  );
}
