'use client';

// A webcam (and microphone) from this browser: send it into OBS as a source
// ("Camera · <name>" in a scene you pick), and/or record it to your files to
// build up material for editing. Sending goes over the OBS agent's door (a
// websocket; the agent re-encodes on the server, docker/obs/agent.mjs
// "Cameras"); recording is made here at full quality and uploaded in parts
// while it runs, so long takes do not wait for the end.

import * as React from 'react';

export interface CameraPanelProps {
  scenes: string[];
  program?: string;
  /** A websocket URL for one camera (a fresh door token each call), or null without the door. */
  cameraWsUrl?(p: { name: string; scene: string; layout: string }): Promise<string | null>;
  /** The camera-upload route (start, part, finish, abort); absent hides recording. */
  uploadEndpoint?: string;
  /** For the "open" link of a finished recording, e.g. "/api/media/". */
  mediaBase?: string;
  disabled?: boolean;
}

const PLACES = [
  ['fill', 'Full frame'],
  ['pip-br', 'Corner, bottom right'],
  ['pip-bl', 'Corner, bottom left'],
  ['pip-tr', 'Corner, top right'],
  ['pip-tl', 'Corner, top left'],
  ['left', 'Left half'],
  ['right', 'Right half'],
  ['center', 'Centre'],
] as const;
const PART_BYTES = 8_000_000;

function pickMime(prefer: 'live' | 'file'): string {
  const live = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
  const file = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return (prefer === 'live' ? live : file).find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function CameraPanel({ scenes, program, cameraWsUrl, uploadEndpoint, mediaBase, disabled }: CameraPanelProps) {
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = React.useState('');
  const [mic, setMic] = React.useState('');
  const [hd, setHd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const video = React.useRef<HTMLVideoElement>(null);

  // --- camera on/off -------------------------------------------------------
  async function turnOn(camId = cam, micId = mic, full = hd) {
    setError(null);
    stream?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: full ? 1920 : 1280 }, height: { ideal: full ? 1080 : 720 }, frameRate: { ideal: 30 } },
        audio: micId === 'none' ? false : { deviceId: micId ? { exact: micId } : undefined, echoCancellation: false, noiseSuppression: true },
      });
      setStream(s);
      if (video.current) video.current.srcObject = s;
      // Labels appear once permission is given.
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? 'The browser was not allowed to use the camera.' : (e as Error).message);
    }
  }
  function turnOff() {
    stopSending();
    void stopRecording();
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }
  React.useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  const label = devices.find((d) => d.deviceId === (stream?.getVideoTracks()[0]?.getSettings().deviceId ?? cam))?.label ?? '';

  // --- send to OBS ---------------------------------------------------------
  const [name, setName] = React.useState('');
  const [scene, setScene] = React.useState('');
  const [place, setPlace] = React.useState('pip-br');
  const [sending, setSending] = React.useState<'off' | 'connecting' | 'on'>('off');
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const liveRec = React.useRef<MediaRecorder | null>(null);
  const sock = React.useRef<WebSocket | null>(null);
  const targetScene = scene && scenes.includes(scene) ? scene : (program ?? scenes[0] ?? '');

  async function startSending() {
    if (!stream || !cameraWsUrl) return;
    setError(null);
    setSending('connecting');
    const url = await cameraWsUrl({ name: name.trim() || label.split('(')[0].trim().slice(0, 30) || 'Camera', scene: targetScene, layout: place });
    if (!url) {
      setSending('off');
      setError('The studio did not give this tab a camera link (is the /obs/ door set up?).');
      return;
    }
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    sock.current = ws;
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as { type: string; source?: string; scene?: string; message?: string };
      if (m.type === 'ok') {
        setSending('on');
        setSentTo(`${m.source} in “${m.scene}”`);
      } else if (m.type === 'error') setError(m.message ?? 'The camera stopped');
    };
    ws.onclose = () => {
      liveRec.current?.state === 'recording' && liveRec.current.stop();
      liveRec.current = null;
      setSending('off');
    };
    ws.onopen = () => {
      const rec = new MediaRecorder(stream, { mimeType: pickMime('live'), videoBitsPerSecond: hd ? 5_000_000 : 2_500_000, audioBitsPerSecond: 128_000 });
      rec.ondataavailable = (e) => {
        if (e.data.size && ws.readyState === WebSocket.OPEN) void e.data.arrayBuffer().then((b) => ws.send(b));
      };
      rec.start(250);
      liveRec.current = rec;
    };
  }
  function stopSending() {
    liveRec.current?.state === 'recording' && liveRec.current.stop();
    liveRec.current = null;
    sock.current?.close();
    sock.current = null;
    setSending('off');
  }

  // --- record to my files --------------------------------------------------
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [sent, setSent] = React.useState(0);
  const [made, setMade] = React.useState(0);
  const [saved, setSaved] = React.useState<string[]>([]);
  const fileRec = React.useRef<MediaRecorder | null>(null);
  const upload = React.useRef<{ id: string; index: number; pending: Blob[]; size: number; chain: Promise<void>; failed: boolean } | null>(null);

  const post = React.useCallback(
    async (q: string, body?: BodyInit, json = false) => {
      const res = await fetch(`${uploadEndpoint}?${q}`, { method: 'POST', body, headers: json ? { 'Content-Type': 'application/json' } : undefined });
      const j = (await res.json().catch(() => ({}))) as { error?: string; id?: string; path?: string };
      if (!res.ok) throw new Error(j.error ?? `Upload failed (${res.status})`);
      return j;
    },
    [uploadEndpoint]
  );

  function sendPart(final = false) {
    const u = upload.current;
    if (!u || (!final && u.size < PART_BYTES) || u.pending.length === 0) return;
    const blob = new Blob(u.pending);
    u.pending = [];
    u.size = 0;
    const index = u.index++;
    u.chain = u.chain.then(async () => {
      if (u.failed) return;
      await post(`op=part&id=${encodeURIComponent(u.id)}&index=${index}`, blob);
      setSent((n) => n + blob.size);
    }).catch((e) => {
      u.failed = true;
      setError(`Recording upload: ${(e as Error).message}`);
    });
  }

  async function startRecording() {
    if (!stream || !uploadEndpoint) return;
    setError(null);
    const mime = pickMime('file');
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
    try {
      const { id } = await post('op=start', JSON.stringify({ name: `Camera ${stamp}.${ext}` }), true);
      upload.current = { id: id!, index: 1, pending: [], size: 0, chain: Promise.resolve(), failed: false };
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: hd ? 10_000_000 : 6_000_000, audioBitsPerSecond: 192_000 });
    rec.ondataavailable = (e) => {
      const u = upload.current;
      if (!u || !e.data.size) return;
      u.pending.push(e.data);
      u.size += e.data.size;
      setMade((n) => n + e.data.size);
      sendPart();
    };
    rec.start(1000);
    fileRec.current = rec;
    setSent(0);
    setMade(0);
    setElapsed(0);
    setRecording(true);
  }
  async function stopRecording() {
    const rec = fileRec.current;
    const u = upload.current;
    if (!rec || !u) return;
    fileRec.current = null;
    await new Promise<void>((ok) => {
      rec.onstop = () => ok();
      rec.state === 'recording' ? rec.stop() : ok();
    });
    setRecording(false);
    sendPart(true);
    await u.chain;
    upload.current = null;
    if (u.failed) {
      await post(`op=abort&id=${encodeURIComponent(u.id)}`).catch(() => {});
      return;
    }
    try {
      const { path } = await post(`op=finish&id=${encodeURIComponent(u.id)}`);
      setSaved((s) => [path!, ...s]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  React.useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  const cams = devices.filter((d) => d.kind === 'videoinput');
  const mics = devices.filter((d) => d.kind === 'audioinput');
  const off = !!disabled;

  return (
    <div className="cp">
      <section className="vs-slot">
        <div className="cp-preview">
          <video ref={video} autoPlay muted playsInline />
          {!stream && <p className="vs-faint">Camera off</p>}
          {recording && <b className="bc-live cp-rec">● REC {clock(elapsed)}</b>}
        </div>
        {stream ? (
          <>
            <div className="vs-row">
              <label className="vs-field cp-grow">
                Camera
                <select
                  value={stream.getVideoTracks()[0]?.getSettings().deviceId ?? cam}
                  disabled={sending !== 'off' || recording}
                  onChange={(e) => {
                    setCam(e.target.value);
                    void turnOn(e.target.value, mic, hd);
                  }}
                >
                  {cams.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="vs-field cp-grow">
                Microphone
                <select
                  value={mic || stream.getAudioTracks()[0]?.getSettings().deviceId || 'none'}
                  disabled={sending !== 'off' || recording}
                  onChange={(e) => {
                    setMic(e.target.value);
                    void turnOn(cam, e.target.value, hd);
                  }}
                >
                  {mics.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                  <option value="none">No microphone</option>
                </select>
              </label>
            </div>
            <div className="vs-row">
              <label className="vs-check">
                <input
                  type="checkbox"
                  checked={hd}
                  disabled={sending !== 'off' || recording}
                  onChange={(e) => {
                    setHd(e.target.checked);
                    void turnOn(cam, mic, e.target.checked);
                  }}
                />
                1080p (720p otherwise)
              </label>
              <button type="button" className="vs-link" onClick={turnOff}>
                Turn camera off
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="studio-btn studio-btn--primary" disabled={off} onClick={() => void turnOn()}>
            Turn camera on
          </button>
        )}
      </section>

      {stream && cameraWsUrl && (
        <section className="vs-slot">
          <h3>Into OBS {sending === 'on' && <b className="bc-live">● Live</b>}</h3>
          {sending === 'off' ? (
            <>
              <label className="vs-field">
                Name in OBS
                <input value={name} maxLength={40} placeholder={label.split('(')[0].trim().slice(0, 30) || 'Camera'} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="vs-row">
                <label className="vs-field cp-grow">
                  Scene
                  <select value={targetScene} onChange={(e) => setScene(e.target.value)}>
                    {scenes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="vs-field cp-grow">
                  Place
                  <select value={place} onChange={(e) => setPlace(e.target.value)}>
                    {PLACES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="studio-btn studio-btn--primary" disabled={off || !targetScene} onClick={() => void startSending()}>
                Send to OBS
              </button>
            </>
          ) : (
            <>
              <p className="vs-faint">{sending === 'connecting' ? 'Connecting…' : `In OBS as ${sentTo}. About a second behind.`}</p>
              <button type="button" className="studio-btn" onClick={stopSending}>
                Stop sending
              </button>
            </>
          )}
        </section>
      )}

      {stream && uploadEndpoint && (
        <section className="vs-slot">
          <h3>Record to my files</h3>
          {recording ? (
            <>
              <p className="vs-faint">
                {clock(elapsed)} · {(made / 1e6).toFixed(1)} MB recorded, {(sent / 1e6).toFixed(0)} MB saved (in 8 MB parts)
              </p>
              <button type="button" className="studio-btn studio-btn--primary" onClick={() => void stopRecording()}>
                Stop recording
              </button>
            </>
          ) : (
            <button type="button" className="studio-btn" disabled={off} onClick={() => void startRecording()}>
              Record
            </button>
          )}
          {saved.length > 0 && (
            <ul className="cp-saved">
              {saved.map((p) => (
                <li key={p}>
                  {mediaBase ? (
                    <a className="vs-link" href={mediaBase + p.split('/').map(encodeURIComponent).join('/')} target="_blank" rel="noreferrer">
                      {p.split('/').pop()}
                    </a>
                  ) : (
                    p.split('/').pop()
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="vs-faint">Full quality, saved to Private/Video/Camera while you record. Use the files in the Video studio or any editor.</p>
        </section>
      )}
      {error && <p className="studio-err">{error}</p>}
    </div>
  );
}
