# Webcam-to-OBS: open-source approaches (2026-11-01)

How other projects get a browser or phone camera into OBS, compared with the
booth's own path (CameraPanel → door websocket → ffmpeg/VA-API → MPEG-TS over
loopback UDP → OBS media source; reference doc `docs/reference/nextcloud.md`
"Broadcast scene editor and cameras"). Source read on GitHub (API and raw
files) on 2026-11-01; licences and dates from repo metadata; nothing
installed; latency figures are the projects' own claims, not measured here.

## Current state of the field

| Project | Licence | Transport | Into OBS | NAT needs | Recording | Activity |
|---|---|---|---|---|---|---|
| VDO.Ninja (steveseguin/vdo.ninja) | AGPL-3.0 (signalling server too) | P2P WebRTC mesh, VP8 default; WHIP/WHEP pages; optional SFU | `?view=` link as browser source | TURN (public by default; `&turn=` for own); UDP 3478, TLS 443, relay range | in the guest's browser, per guest; director can trigger | v30.2 2026-05-12 |
| Broadcast Box (Glimesh) | MIT | WHIP/WHEP SFU (Go/Pion), no transcode | browser source on its player | UDP (mux port) or TCP mux | none built in | v2.0.2 2026-02-21 |
| MediaMTX (bluenviron), already our relay | MIT | WHIP in at `/<path>/whip`, built-in publish page; remux to RTSP/SRT/RTMP/HLS | media source on `rtsp://…/<path>` | UDP 8189 (TCP optional), `webrtcICEServers2` TURN incl. coturn auth secret | per path on the server (`record: yes`) | v1.21.3 2026-10-25 |
| LiveKit (+ ingress, egress) | Apache-2.0 | SFU with simulcast; WHIP/RTMP ingress (transcodes); egress composite or per track | browser source, or egress RTMP into the relay | TCP 7880/7881, UDP 50000–60000 or mux 7882, optional TURN | server, per track or composite | server v1.13.11 2026-10-25 |
| Galène (jech) | MIT | SFU with built-in TURN, WHIP ingest | browser source (no WHEP) | TCP+UDP 1194 | WebM per stream on the server | 1.2.1 2026-09-08 |
| MiroTalk SFU | AGPL-3.0 / paid | mediasoup | browser source | UDP/TCP 40000–40100 | — | 2026-10-31 |
| OBS 33.0.1 | GPL-2.0 | WHIP output only; WHEP source PR #10353 open | — | — | — | 2026-10-29 |

MiroTalk's `RtmpStreamer` uses the same pattern as the booth (MediaRecorder
chunks → server → ffmpeg), over HTTP POST instead of a websocket.

Code worth reading (paths in each repo):
- VDO.Ninja `webrtc.js` `limitMaxBandwidth` / `limitBitrate` (per-viewer
  bitrate via sender parameters), `CodecsHandler.preferCodec` (codec by SDP),
  `lib.js` `playoutdelay()` (sync via `jitterBufferTarget`).
- MediaMTX `internal/servers/webrtc/publisher.js` (~500 lines, MIT: WHIP
  client, codec/bitrate edits, ICE servers from the `Link` header),
  `publish_index.html` (device picker).
- Broadcast Box `internal/webrtc/sessions/whip/peerconnection.go`.
- LiveKit egress `pkg/pipeline/source/web.go` (headless Chrome compositor).
- Galène `diskwriter/diskwriter.go` (per-stream WebM recording).

## Our path compared

- Better: TCP/443 only through the edge, no UDP or TURN needed; audio and
  video muxed in one stream (no lip-sync step); low server CPU (VA-API).
- Worse: ~1 s latency against 0.1–0.3 s for WebRTC; no congestion control
  (TCP queues and latency grows on a bad link); two lossy encodes (VP8 in the
  browser, H.264 on the server); one ffmpeg and VA-API session per camera.

## Licence constraints

- Do not bundle or modify VDO.Ninja or MiroTalk code in our pages: AGPL-3.0
  would apply to served modifications. Embedding unmodified VDO.Ninja in an
  iframe is permitted but depends on its public signalling and TURN unless we
  host those too.
- MediaMTX, Broadcast Box, Galène, LiveKit: MIT/Apache, usable and adaptable.

## Open items (recommendations, not decided)

1. WHIP publishing into the MediaMTX relay for guests, with the websocket path
   kept as fallback: browser sends H.264/Opus, MediaMTX passes it to RTSP for
   an OBS media source (no server re-encode, sub-second latency, congestion
   control); `record: yes` per path gives isolated per-guest recordings.
   Needs UDP 8189 published (or TCP 8189), or `webrtcICEServers2` pointing at
   the Talk TURN with its auth secret. Owner: relay session / developer
   (ports are the developer's decision). Unknown: whether Talk's TURN 3478 is
   reachable from outside.
2. Guest links on top of (1), VDO.Ninja-style but our own code: a per-guest
   token mapped to a relay path, director-side bitrate/codec control
   (`RTCRtpSender.setParameters`), `jitterBufferTarget` on monitor pages.
   Avoids AGPL obligations and third-party signalling.

Not reviewed: Webcamoid, NDI paths.

## Transport findings on this host (2026-11-01, read-only checks)

- Talk's TURN is eturnal 1.12.3 with a REST shared secret (`TURN_SECRET`, the
  same as spreed's `turn_servers` secret); MediaMTX's `AUTH_SECRET` form works
  with it (verified by an Allocate). Listens UDP/TCP 3478 only (no TLS); relay
  ports 49152–49351 not published. Its peer whitelist currently allows
  172.16/12 and 192.168/16, but that is not what Talk's `start.sh` generates:
  the file was rewritten minutes after container start, probably by a TrueNAS
  root cron (**assumed**, unreadable). Talk's network cannot reach eac-network
  directly (reaches 192.168.0.11). Verdict: TURN via Talk is possible but
  fragile; optional.
- Hairpin tests: 3478 UDP/TCP forwarded to this host; 8189, 8889, 1935, 4458
  not forwarded.
- Security: WHIP/WHEP through NPM arrive from a private address, which the
  relay's auth treats as trusted for `obs` reads/publishes; restrict the
  `webrtc` protocol to publish on `in/<key>` before exposing it (sent to the
  relay session).
- MediaMTX returns absolute-path session `Location`s: give WHIP its own edge
  host (`live.arts-collective.com` → 192.168.0.11:8889) rather than a path
  prefix (**assumed** from source reading).
- Recommended minimum by hand: router forward 8189 UDP+TCP → 192.168.0.11;
  NPM proxy host `live.arts-collective.com` → 192.168.0.11:8889 with a
  certificate. Relay: `webrtcAdditionalHosts: [69.196.152.249, 192.168.0.11]`
  (IPv4 only), ICE UDP+TCP 8189, `webrtcTrustedProxies`.
- Dead ends: ICE-TCP through an NPM location; an NPM stream on 443; TURNS on
  5349; MediaMTX using TURN itself; TURN to an eac-network address.
- Verified 2026-11-01 inside eac-network: our WHIP client (GuestCamera +
  whip.ts) published H.264 Baseline 720p + Opus to a test MediaMTX; RTSP read
  gave both tracks; an OBS media source on the RTSP URL showed the picture and
  carried the Opus audio (booth sink −20.6 dB).
