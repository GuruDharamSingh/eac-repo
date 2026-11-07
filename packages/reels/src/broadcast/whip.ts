// A WHIP client (RFC 9725): publish a MediaStream to a WebRTC ingest such as
// the relay's MediaMTX (`<base>/in/<key>/whip`). Written for the guest camera
// page (GuestCamera.tsx); no dependency.
//
//   1. OPTIONS <url>       the server may answer with Link: <turn:…>; rel="ice-server"
//   2. POST <url>          body: the SDP offer (application/sdp), after ICE gathering
//                          answer: 201, the SDP answer, Location: the session resource
//   3. DELETE <Location>   on leave
//
// H.264 is preferred so the relay can hand the video to RTSP/RTMP readers
// (OBS) without transcoding; the browser falls back to what it has.

export interface WhipOptions {
  /** Upper bound for the video sender, bits per second. */
  videoBitrate?: number;
  /** Extra ICE servers besides those the server advertises. */
  iceServers?: RTCIceServer[];
  /** Give up gathering candidates after this long (the offer goes with what it has). */
  gatherTimeoutMs?: number;
  onState?(state: RTCPeerConnectionState): void;
}

export interface WhipSession {
  pc: RTCPeerConnection;
  /** Change the video bitrate cap while live. */
  setVideoBitrate(bps: number): Promise<void>;
  close(): Promise<void>;
}

/** `<turn:host:3478?transport=udp>; rel="ice-server"; username="u"; credential="p"` → RTCIceServer. */
export function parseIceLinks(headers: Headers): RTCIceServer[] {
  const raw = headers.get('link');
  if (!raw) return [];
  const out: RTCIceServer[] = [];
  // Links are comma-separated, but a URL can hold commas only inside <…>.
  for (const part of raw.match(/<[^>]*>[^,]*/g) ?? []) {
    const url = /<([^>]*)>/.exec(part)?.[1];
    if (!url || !/rel="?ice-server"?/i.test(part)) continue;
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`, 'i').exec(part)?.[1];
    const server: RTCIceServer = { urls: url };
    const username = attr('username');
    const credential = attr('credential');
    if (username) server.username = username;
    if (credential) server.credential = credential;
    out.push(server);
  }
  return out;
}

function preferH264(transceiver: RTCRtpTransceiver) {
  const caps = typeof RTCRtpSender !== 'undefined' ? RTCRtpSender.getCapabilities?.('video') : null;
  if (!caps || !transceiver.setCodecPreferences) return;
  const h264 = caps.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264');
  // Constrained baseline / packetization-mode=1 first: what every reader decodes.
  h264.sort((a, b) => score(b) - score(a));
  const rest = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/h264');
  if (h264.length) transceiver.setCodecPreferences([...h264, ...rest]);
  function score(c: RTCRtpCodec) {
    const f = c.sdpFmtpLine ?? '';
    return (f.includes('packetization-mode=1') ? 2 : 0) + (f.includes('profile-level-id=42e0') || f.includes('profile-level-id=42e01f') ? 1 : 0);
  }
}

function gathered(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((ok) => {
    const t = setTimeout(ok, timeoutMs);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        ok();
      }
    });
  });
}

async function capVideo(pc: RTCPeerConnection, bps: number) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue;
    const p = sender.getParameters();
    p.encodings = p.encodings?.length ? p.encodings : [{}];
    p.encodings[0].maxBitrate = bps;
    await sender.setParameters(p).catch(() => {});
  }
}

export async function whipPublish(url: string, stream: MediaStream, opts: WhipOptions = {}): Promise<WhipSession> {
  // 1. ICE servers the server offers (TURN with credentials, typically). Optional.
  let iceServers: RTCIceServer[] = [...(opts.iceServers ?? [])];
  try {
    const res = await fetch(url, { method: 'OPTIONS' });
    iceServers = [...iceServers, ...parseIceLinks(res.headers)];
  } catch {
    /* no OPTIONS: go without */
  }

  const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
  if (opts.onState) pc.addEventListener('connectionstatechange', () => opts.onState!(pc.connectionState));
  for (const track of stream.getTracks()) {
    const t = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
    if (track.kind === 'video') preferH264(t);
  }

  try {
    await pc.setLocalDescription(await pc.createOffer());
    // 2. Non-trickle: send the offer with the candidates gathered so far.
    await gathered(pc, opts.gatherTimeoutMs ?? 3000);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription!.sdp });
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new Error('This camera link is not valid any more. Ask the studio for a new one.');
    if (!res.ok) throw new Error(`The studio refused the camera (${res.status})`);
    const location = res.headers.get('location');
    const resource = location ? new URL(location, new URL(url, window.location.href)).toString() : null;
    await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
    if (opts.videoBitrate) await capVideo(pc, opts.videoBitrate);

    let closed = false;
    return {
      pc,
      setVideoBitrate: (bps) => capVideo(pc, bps),
      async close() {
        if (closed) return;
        closed = true;
        pc.close();
        // 3. End the session on the server too (it would time out otherwise).
        if (resource) await fetch(resource, { method: 'DELETE' }).catch(() => {});
      },
    };
  } catch (err) {
    pc.close();
    throw err;
  }
}
