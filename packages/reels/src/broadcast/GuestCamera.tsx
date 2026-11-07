'use client';

// The guest camera page: someone the studio invites opens a link, picks a
// camera and microphone, and goes live to the studio over WebRTC (WHIP into
// the relay, whip.ts). No account: the link's key is the only credential and
// the studio can revoke it. The studio then puts the guest in a scene.

import * as React from 'react';
import { whipPublish, type WhipSession } from './whip';

export interface GuestCameraProps {
  /** The WHIP endpoint for this guest, e.g. "/relay/in/<key>/whip". */
  whipUrl: string;
  /** Shown as the page's heading line, e.g. "Elkdonis Arts Collective". */
  studioName: string;
}

const QUALITY = [
  { label: 'Good connection (1080p)', w: 1920, h: 1080, bps: 4_000_000 },
  { label: 'Normal (720p)', w: 1280, h: 720, bps: 2_000_000 },
  { label: 'Weak connection (480p)', w: 854, h: 480, bps: 800_000 },
] as const;

const STATE_TEXT: Record<string, string> = {
  new: 'Connecting…',
  connecting: 'Connecting…',
  connected: 'You are live to the studio.',
  disconnected: 'The connection dropped; trying again…',
  failed: 'The connection failed. Your network may block it; try another network or ask the studio.',
  closed: 'Stopped.',
};

export function GuestCamera({ whipUrl, studioName }: GuestCameraProps) {
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = React.useState('');
  const [mic, setMic] = React.useState('');
  const [q, setQ] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<string>('idle');
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const session = React.useRef<WhipSession | null>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const live = state !== 'idle' && state !== 'closed' && state !== 'failed';

  async function open(camId = cam, micId = mic, quality = q) {
    setError(null);
    stream?.getTracks().forEach((t) => t.stop());
    const Q = QUALITY[quality];
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: Q.w }, height: { ideal: Q.h }, frameRate: { ideal: 30 } },
        audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setStream(s);
      if (video.current) video.current.srcObject = s;
      setDevices(await navigator.mediaDevices.enumerateDevices());
      setMicOn(true);
      setCamOn(true);
      return s;
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? 'Allow the camera and microphone for this page (the icon in the address bar), then try again.' : (e as Error).message);
      return null;
    }
  }
  React.useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  React.useEffect(() => () => void session.current?.close(), []);
  // Leaving the page ends the session on the server at once.
  React.useEffect(() => {
    const bye = () => void session.current?.close();
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, []);

  async function goLive() {
    const s = stream ?? (await open());
    if (!s) return;
    setError(null);
    setState('connecting');
    try {
      session.current = await whipPublish(whipUrl, s, { videoBitrate: QUALITY[q].bps, onState: setState });
    } catch (e) {
      setState('idle');
      setError((e as Error).message);
    }
  }
  async function stop() {
    await session.current?.close();
    session.current = null;
    setState('closed');
  }
  function toggle(kind: 'audio' | 'video') {
    for (const t of stream?.getTracks() ?? []) if (t.kind === kind) t.enabled = !t.enabled;
    if (kind === 'audio') setMicOn((v) => !v);
    else setCamOn((v) => !v);
  }

  const cams = devices.filter((d) => d.kind === 'videoinput');
  const mics = devices.filter((d) => d.kind === 'audioinput');

  return (
    <div className="gc">
      <header className="gc-head">
        <span>{studioName}</span>
        <b>Guest camera</b>
      </header>
      <div className="gc-stage">
        <video ref={video} autoPlay muted playsInline />
        {!stream && <p>Your camera will appear here.</p>}
        {live && <span className={state === 'connected' ? 'gc-dot is-live' : 'gc-dot'}>{state === 'connected' ? 'LIVE' : '…'}</span>}
      </div>

      <div className="gc-controls">
        {!stream ? (
          <button type="button" className="gc-btn gc-btn--primary" onClick={() => void open()}>
            Turn on camera and microphone
          </button>
        ) : (
          <>
            <div className="gc-row">
              <label>
                Camera
                <select
                  value={stream.getVideoTracks()[0]?.getSettings().deviceId ?? cam}
                  disabled={live}
                  onChange={(e) => {
                    setCam(e.target.value);
                    void open(e.target.value, mic, q);
                  }}
                >
                  {cams.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Microphone
                <select
                  value={stream.getAudioTracks()[0]?.getSettings().deviceId ?? mic}
                  disabled={live}
                  onChange={(e) => {
                    setMic(e.target.value);
                    void open(cam, e.target.value, q);
                  }}
                >
                  {mics.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quality
                <select
                  value={q}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setQ(v);
                    if (live) void session.current?.setVideoBitrate(QUALITY[v].bps);
                    else void open(cam, mic, v);
                  }}
                >
                  {QUALITY.map((x, i) => (
                    <option key={x.label} value={i}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="gc-row gc-actions">
              {live ? (
                <button type="button" className="gc-btn" onClick={() => void stop()}>
                  Stop
                </button>
              ) : (
                <button type="button" className="gc-btn gc-btn--primary" onClick={() => void goLive()}>
                  Go live to the studio
                </button>
              )}
              <button type="button" className={micOn ? 'gc-btn' : 'gc-btn is-off'} onClick={() => toggle('audio')} aria-pressed={!micOn}>
                {micOn ? 'Mute microphone' : 'Microphone muted'}
              </button>
              <button type="button" className={camOn ? 'gc-btn' : 'gc-btn is-off'} onClick={() => toggle('video')} aria-pressed={!camOn}>
                {camOn ? 'Hide camera' : 'Camera hidden'}
              </button>
            </div>
          </>
        )}
        <p className="gc-state" aria-live="polite">
          {error ?? (state === 'idle' ? 'Nothing is sent until you press “Go live to the studio”.' : STATE_TEXT[state] ?? state)}
        </p>
        <p className="gc-note">Use headphones if you can hear the programme, so it does not echo. Keep this page open while you are on.</p>
      </div>
    </div>
  );
}
