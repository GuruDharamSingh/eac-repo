# Broadcast booth and relay: two day-sessions (2026-11-01)

Two separate sessions, each a day, in the order below. Both build on what the
Studio's Video kind has as of 2026-11-01: the server OBS (`eac-obs`,
`docker/obs/`), its agent (`docker/obs/agent.mjs`, HTTP on `obs:4456`, one
lease at a time), the web console at `/studio/broadcast`, and the Go live
card in the Video kind (`packages/reels/src/editor/LiveCard.tsx`), verified
streaming 1080p to a local RTMP receiver. Direction agreed with the
developer: OBS is the hub; effects are browser-source overlays; meetings come
in as sources; everything is run from the central Studio on
arts-collective.com.

## Session A: the broadcast booth (the real OBS, in the browser)

**Goal.** An admin opens Studio → Video → Broadcast → Desktop and gets the
full OBS window: scenes, sources, filters, audio mixer, transitions, studio
mode, settings. The web console and the Go live card stay the on-air remote.

**What exists.** The container runs OBS on a headless sway display with
`wayvnc` on 5900 and noVNC (`websockify --web /usr/share/novnc`) on 6080,
published only on `127.0.0.1:6080` with no password (`docker/obs/start.sh:106`,
`docker-compose.yml:1212`). Reaching it today means an SSH tunnel.

**Pieces.**
1. *A door with sign-in.* noVNC must not be reachable without the network
   session. Simplest sound option: the OBS agent gains a websocket path
   (`/desktop`) that proxies to `localhost:5900` only when the query carries a
   one-time token; the app mints the token for admins
   (`POST /api/broadcast/desktop-token`, 60 s, single use, bound to the user)
   and the page opens noVNC's client against `wss://arts-collective.com/obs/desktop?token=…`.
   Edge: one proxy host for `/obs/` → `obs:4456` with websocket upgrade
   (`scripts/add-proxy-host.sh`, then the location in Nginx Proxy Manager).
   Alternative if that drags: a basic-auth access list on a proxy host for
   port 6080; weaker, admin password shared.
2. *The page.* `/studio/broadcast/desktop` (admins): noVNC's `vnc.html` embedded
   full-width at 1920×1080 scaled to fit, with the console's status strip
   above it (live, recording, lease holder) and a "Take the studio" button
   that claims the lease, since the desktop view bypasses the agent's lock.
   The Video kind's Broadcast button gains the Desktop tab.
3. *Keyboard and clipboard.* noVNC handles both; check that Ctrl/Cmd
   shortcuts reach OBS and that the sway compositor's keymap is US.
4. *Quality knobs.* wayvnc frame rate and JPEG quality for a usable mixer
   over the internet; measure CPU with the desktop view open (docs/reference/nextcloud.md
   "Server OBS" has the baseline table).

**Verification.** From a browser away from the LAN: open the page signed in
as admin, add a browser source, change a filter, watch the mixer move while
a Talk room plays; signed out or non-admin gets 404; the token cannot be
reused. Record the CPU cost in the reference doc.

**Open questions.** Whether to keep noVNC's own toolbar or hide it; whether
non-admin "operators" should get the desktop (today everything is admin-only
because there is one OBS); wayvnc auth (needs TLS or RSA keys) as a second
layer if the token door is not enough.

### Session A status (2026-11-01)
Built and deployed; details and evidence in `docs/reference/nextcloud.md`
"Broadcast booth".
- Decisions (developer, 2026-11-01): door through an NPM custom location
  (not a custom Node server, not basic auth); Talk test room made by the
  service account; listen-in-browser and a program monitor are in scope.
- Done: agent door on host port 4458 (noVNC files; desktop websocket,
  monitor audio and MJPEG program, each with a one-time token bound to the
  lease holder); `/studio/broadcast/desktop` (`BroadcastDesk`) with program
  picture, Listen, quality, full screen, clipboard; Console/Desktop tabs;
  `booth` sink as OBS's monitoring device; websockify and wayvnc on loopback
  only (6080 no longer published); PulseAudio restart fix in `start.sh`.
  Instead of a "Take the studio" button the desk claims the lease like the
  console; the token door means the desktop no longer bypasses the lease.
- Verified inside eac-network: token rules, desktop handshake, audio at real
  time, program ~5 fps, lease loss closes streams; Talk room loads in the
  browser source. CPU: program + audio streams add ~0.03 core over ~0.075.
- Overlays (2026-11-01, deployed 05:45 UTC), then the same night graphics as
  EBU OGraf v1 layers: the "Overlays" source is an OGraf renderer, four EAC
  graphics (lower third with four styles adapted from Animated Lower Thirds,
  MIT; title card; corner bug; countdown), admin uploads of OGraf folders, a
  Graphics panel replacing the Overlays panel (decisions: replace, uploads via
  the Studio). Reference doc "Broadcast graphics (EBU OGraf)". Next: presets
  (saved name/role lists), bundling EBU's example graphics (needs the
  developer's go-ahead to download), the OGraf Server API for outside
  controllers, the Talk room via the app user.
- Scene editor and cameras (2026-11-01, deployed ~06:50 UTC): scenes,
  sources, layouts, transitions, preview/take, mixer with meters, media from
  the person's files, all from the console; webcam into OBS over the door and
  recording to Private/Video/Camera in parts; OBS now shuts down cleanly and
  dead browser connections no longer hold the lease. Reference doc
  "Broadcast scene editor and cameras". Next: guest cameras without an admin
  session (see the webcam software survey), WHIP into the relay for lower
  latency, per-camera isolated recording on the server.
- Guest cameras over WHIP (2026-11-01): our own client and `/guest/camera/<key>`
  (booth), relay WebRTC/RTSP and auth (relay session), verified inside the
  network; waiting on the router forward of 8189 and the NPM host
  `live.arts-collective.com`. Studio gained a Recordings kind, phone capture
  (`/c/<code>`) and "From my phone…" in reel slots. The clip editor followed
  the same night: a `clip` Remotion template (trim, 16:9/9:16/1:1, title,
  lower third, corner, end card) and ClipControls in the Video kind;
  "Edit with overlays" from Recordings (reference doc "Clip template and clip
  editor").
- Later 2026-11-01 (developer's requests after using the booth): the clip
  editor gained cuts (kept parts of the source, split, cut a marked span, put
  back) and a timeline under the preview (filmstrip, edit row, overlay lanes
  with drag/resize) with seven overlay kinds (title, lower third, caption,
  quote, corner label, picture, ticker); the booth gained ticker, caption and
  quote graphics and readable choice labels (`gddOptions.labels`); the
  Studio's Recordings kind lists the booth's own OBS recordings for admins and
  copies one into Private/Video/Broadcasts in the background (lease-free).
  Reference doc sections "Clip template and clip editor", "Recordings, phone
  capture and guest cameras", "Broadcast graphics". Open-source survey for
  next steps (whisper.cpp captions, undo/snapping from opencut-classic,
  silence detection): reported to the developer, not written up.
- Talk audio verified 2026-11-01 05:00 UTC with a tone guest: Talk → browser
  source → mixer, booth sink and recording; OBS ~0.65 core while in a call.
- Open (2026-11-01 05:05 UTC): ~~NPM location `/obs/` on proxy host 23 (developer, morning);
  the page signed in through the edge, including Listen and the program
  picture;~~ 2026-11-01: location added (first save took arts-collective.com
  down 08:01–~09:20 EST: explanation text in the advanced box and a mistyped
  IP; fixed with three lines, see reference doc); the developer then used the
  desktop, program, Listen and meters through the edge (edge log: websocket
  101, program and levels 200). Still open: desktop CPU with real noVNC; a real voice in
  `https://cloud.elkdonis-arts.org/call/dgjnfosd`, then delete the room;
  noVNC toolbar question resolved by not using `vnc.html` (own controls).

## Session B: the relay (one stream in, many out; feeds in)

**Goal.** OBS streams once to our own ingest, which fans out to YouTube,
Facebook and any RTMP destination at the same time; and the same ingest
accepts feeds in (Zoom's custom live streaming, a phone, another OBS) that
OBS picks up as sources.

**Pieces.**
1. *Service.* `relay` in compose: MediaMTX (`bluenviron/mediamtx`), RTMP on
   1935 and RTMPS/SRT if wanted, on `eac-network`; a config with two path
   families: `program` (OBS publishes here) and `in/<name>` (external feeds).
   Internet-facing ingest needs a published port and a per-feed key in the
   path (`in/<key>`); keep it off until a feed needs it.
2. *Fan-out.* MediaMTX `runOnReady` on `program` starts one `ffmpeg -c copy`
   per destination (stream copy, no encode): `ffmpeg -i rtmp://relay/program -c copy -f flv rtmp://a.rtmp.youtube.com/live2/<key>`
   and the same for Facebook (`rtmps://live-api-s.facebook.com:443/rtmp/<key>`).
   Destinations and keys come from a small table `stream_destinations`
   (id, label, server, key sealed with the connections key, enabled, set_by)
   managed from the card; the runner reads them when the program starts.
   Alternative without storing keys: the card posts the keys to the runner at
   Go live and they live only in the runner's memory.
3. *The card.* "Destinations" replaces the single server/key: a list with
   checkboxes (YouTube Live, Facebook Live, custom…), add/remove, and Go live
   sends OBS to `rtmp://relay/program` with a fixed key while the runner fans
   out. Status shows each destination's state from the runner.
4. *Feeds in.* A "Sources" list on the console: each `in/<name>` path with a
   copyable RTMP URL and key, and "Add to scene" which creates an OBS media
   source for `rtmp://relay/in/<name>` through the agent. Zoom then needs
   only its custom-streaming settings pointed at that URL; the Zoom API, if
   ever, automates the "start streaming" click.
5. *Health.* Per-destination connect/retry in the runner, an event row per
   start/stop/failure (the `connection_events` pattern), and the Go live card
   showing which outputs are up.

**Verification.** Two local MediaMTX receivers as fake destinations: go
live from the card, both receive 1080p H.264 + AAC (ffprobe), stopping ends
both; a phone app publishing to `in/test` appears in OBS via "Add to scene";
one real YouTube or Facebook key at the end. Record CPU with two outputs
(expected: encode once, copy twice).

**Open questions.** Where keys live (sealed table vs memory only); whether
the relay should also record the program (it can, as MP4, which would spare
OBS the recording); whether to expose SRT for lower-latency feeds.

### Session B status (2026-11-01)
Built and deployed (arts-collective rebuilt together with session A's booth
page); details and evidence in `docs/reference/nextcloud.md` "Stream relay".
- Decisions (developer, 2026-11-01): keys in a sealed table (not memory only);
  feeds in internal only for now; the relay does not record (OBS keeps
  recording); the Talk-audio pre-test was left to session A.
- Done: pieces 1-5. Service `relay` (`docker/relay/`), table
  `stream_destinations` + `stream_events` (migration 226), Destinations in the
  Go live card, Feeds in with "Add to OBS" (in the card, not the console: the
  console holds its own lease and its file was being edited by session A),
  per-output state and retries, history rows.
- Verified: OBS → relay → two local receivers (1080p H.264 + AAC stereo);
  auth refusals; services layer against the live tables; panel rendered
  with stand-in actions. Relay CPU with two outputs: ~0.02 core.
- Signed-in card test passed 2026-11-01 (throwaway admin, deleted). It found
  that Stop did not release the lease; fixed, rebuilt and verified 05:30 UTC.
- Open: one real YouTube or Facebook key; opening 1935 to the internet for Zoom
  (publish the port, forward it on the router or an NPM TCP stream, then show
  the public address instead of `rtmp://relay:1935/in`); "Feeds in" on the
  console (added 2026-11-01 through the console/desk `extra` slot); the console's own Stream section still
  sets one server/key and does not arm the relay.

### Plan: feeds in from the internet (Zoom), 2026-11-01; steps 1-3 done, port closed
Facts checked 2026-11-01: public IP 69.196.152.249; `live.arts-collective.com`
already resolves there through the wildcard A record (`dig @1.1.1.1`);
nothing listens on host port 1935; the router forwards 80/443 to NPM
(30021/30022) and is managed by hand; NPM is a TrueNAS app publishing only
80/443/81, so an NPM TCP stream would need a TrueNAS app change. Zoom custom
streaming needs a paid account, the admin settings "Allow livestreaming of
meetings" + "Custom Live Streaming Service" (web portal), and three fields:
Stream URL, Stream key, Live streaming page URL (vendor docs; Zoom's own
article not read). Whether Zoom accepts `rtmps://` is **unknown**: every
example found uses `rtmp://`.

Shape: the relay publishes 1935 itself (no NPM in the path); the router
forwards WAN TCP 1935 to 192.168.0.11:1935; Zoom gets
`rtmp://live.arts-collective.com/in` + a feed key.

Status 2026-11-01 06:15 UTC: steps 1-3 built (relay recreated 06:08; host
binding `127.0.0.1:1935`, checked with `ss -ltn`); the Feeds in text is in
arts-collective build `liZActvJu_t1RFTSE_qd9` (the Zoom wording shows only
once `RELAY_PUBLIC_INGEST_URL` is set; not seen rendered yet); steps 4-6 open.
2026-11-01 06:24 UTC: `.env` set (`RELAY_RTMP_BIND=0.0.0.0`,
`RELAY_PUBLIC_INGEST_URL`), relay and arts-collective recreated (previous
`.env` at `/tmp/eac-env.bak-1793514262`); host listens on `0.0.0.0:1935`, so
the relay is reachable on the LAN now. From outside it is not: check-host.net
TCP probes to `live.arts-collective.com:1935` got "Connection refused" (Iran x2,
Slovenia) while the same Slovenia node connected to :443, and the relay logged
no connection. Step 4 (router forward of WAN 1935 → 192.168.0.11:1935) is
missing; until it exists, Feeds in shows an address that only works on the LAN. To open:
`RELAY_RTMP_BIND=0.0.0.0` and
`RELAY_PUBLIC_INGEST_URL=rtmp://live.arts-collective.com/in` in `.env`, then
`docker compose up -d relay arts-collective` (recreate; no build needed).
Close again by removing `RELAY_RTMP_BIND` and recreating relay.
2026-11-01 14:05 UTC: step 4 done (developer). Verified: check-host.net TCP
probes to `live.arts-collective.com:1935` and `69.196.152.249:1935` connected
from 8 nodes, and the relay logged each as `[RTMP] [conn <public ip>:<port>]
opened`. Docker passes the real client address through, so the private-address
rule and per-address blocking in step 3 apply as written. Hairpin does not work:
from the server (and so from devices on the home network)
`rtmp://live.arts-collective.com/in/...` is refused; on the LAN publish to
`rtmp://192.168.0.11/in/<key>`. Step 6 (a real publish from outside: phone on
cellular, then Zoom) is still open.

Steps (C = Claude, D = developer):
1. C: compose binds `${RELAY_RTMP_BIND:-127.0.0.1}:1935:1935`. Default stays
   loopback (closed); `RELAY_RTMP_BIND=0.0.0.0` in `.env` + `docker compose
   up -d relay` opens it, and setting it back closes it. The router rule can
   stay in place: with the loopback bind nothing answers.
2. C: `RELAY_PUBLIC_INGEST_URL=rtmp://live.arts-collective.com/in` (env on
   arts-collective); Feeds in shows it instead of `rtmp://relay:1935/in`, with
   the Zoom field names beside it (Stream URL, Stream key = the feed key,
   Live streaming page URL = any public page, e.g. https://arts-collective.com).
3. C: harden the relay agent's `/auth` for the open port: refuse `program`
   publishing and `obs` reads unless the source IP is private (first check
   from outside that Docker passes the real client IP through; if it shows
   the bridge gateway, keep the password-only rule), and block an IP for
   10 minutes after 10 refused attempts, with one log line per block.
4. D: router: forward WAN TCP 1935 → 192.168.0.11:1935.
5. D: Zoom: enable custom live streaming on the account (paid plan).
6. C + D: test from outside the LAN: a phone on cellular (Larix Broadcaster,
   `rtmp://live.arts-collective.com/in/<key>`) appears online in Feeds in and
   in OBS via Add to OBS; a wrong key is refused; then one Zoom meeting
   pushed in; record the source-IP finding and the result.

Risks and limits:
- Plain RTMP sends the feed key unencrypted. Anyone who captures it can
  publish into that feed path, which reaches air only if that feed is in a
  scene. Mitigation: one feed per event, removed afterwards (the key dies
  with it). RTMPS later needs a certificate for live.arts-collective.com (an
  NPM proxy host to issue it, mounted read-only into the relay, MediaMTX on
  1936, reload on renewal) and Zoom's RTMPS support confirmed first.
- Bandwidth: each feed in uses download (Zoom sends ~2-4 Mbit/s); each
  destination out uses upload at OBS's bitrate (6 Mbit/s video + audio by
  default), so three destinations need ~20 Mbit/s of steady upload. The
  connection's upload capacity has not been measured; do it before an event
  with several destinations.
- MediaMTX becomes internet-facing. Unauthenticated publishes and reads are
  refused by the agent; it has no rate limit beyond step 3.

### Guest cameras over WHIP (2026-11-01; relay side built, closed)
Split agreed with the booth session: it owns the WHIP client and the page
`/guest/camera/<key>`; the relay owns MediaMTX WebRTC/RTSP, auth, "Add to
OBS" over RTSP, and "Copy camera link". Relay side built and tested inside
eac-network (reference doc "Stream relay"). Transport per the booth
session's review (assumed, not tested from outside):
- NPM proxy host `live.arts-collective.com` → 192.168.0.11:8889 with its own
  certificate (not a `/relay/` location: MediaMTX answers with an absolute
  session `Location`); the guest page posts there (`RELAY_WHIP_BASE`).
- Router: forward 8189 UDP and TCP → 192.168.0.11.
- `.env`: `RELAY_WEBRTC_BIND=0.0.0.0` (NPM reaches the host address),
  `RELAY_WEBRTC_HOSTS=69.196.152.249,192.168.0.11`, `RELAY_WEBRTC_TCP=1`,
  `RELAY_GUEST_CAMERAS=1`; recreate relay and arts-collective.
- TURN through Talk's eturnal is possible but optional and fragile (its peer
  whitelist was rewritten after start by something unidentified).
- Open: `webrtcTrustedProxies` defaults to all private ranges, so the
  address MediaMTX sees for NPM is trusted for X-Forwarded-For; narrow it once
  that address is known.

### Twitch and Kick destinations (2026-11-01, built; deployed with the chat build)
Presets beside YouTube and Facebook (`STREAM_PRESETS` in
`packages/services/src/relay.ts`, form in `RelayPanel.tsx`). Twitch uses the
"Default" row of https://ingest.twitch.tv/ingests (checked 2026-11-01):
`rtmps://ingest.global-contribute.live-video.net:443/app`. Kick gives each
account its own RTMPS server on Amazon IVS, so its preset asks for the Stream
URL from Kick's dashboard as well as the key. OBS's encode already fits both
(CBR 6000 kbps, 2 s keyframes, AAC 160; `docker/obs/start.sh:19-26`); the relay
copies one encode to all, which satisfies Twitch's rule that Twitch may not get
a lower quality than other platforms. Not verified: a real Twitch or Kick key.
Unresolved from sources: whether Kick reduces Partner payouts while
simulcasting.

### Chat from every destination in one place (2026-11-01, plan; Twitch first)
Status 2026-11-01: phase 1 (Twitch) built; migration 228 applied; container
`eac-stream-chat` running; Studio panel in the arts-collective build of the
same day. Live test with a real channel skipped at the developer's request.
Panel and form rendered signed in 2026-11-01 evening with inserted test rows
(details in `docs/reference/nextcloud.md` "Stream relay"); a narrow-card
layout fix went live in build `MMInwvHoC7hSl-t7Yejua` the same evening.
Developer's choice 2026-11-01: build (not Social Stream Ninja), Twitch first.
Shown in the Studio only at first, not on the broadcast: Twitch's written
terms may still restrict combined-chat overlays (enforcement reportedly
dropped February 2026; unverified).
- Collector: a `stream-chat` compose service (image `eac-dev`, like
  `auction-clock`) running `packages/services/scripts/stream-chat.mts`. It
  follows the ticked destinations that have a chat channel, writes messages
  to the database, and deletes messages older than 30 days once a day.
- Schema (one migration): `stream_destinations.chat_channel` (Twitch login,
  Kick slug; YouTube and Facebook take theirs from the connection), and
  `stream_chat_messages` (destination, platform, channel, external id unique
  per platform, author, body, meta jsonb, sent_at, received_at).
- Studio: a Chat panel in the Go live card and the broadcast console's
  `extra` slot (`RelayChat.tsx`), polling a server action every 2 s; text
  only, platform badge, author, time.
- Phase 1, Twitch: anonymous IRC over `wss://irc-ws.chat.twitch.tv`
  (`justinfan<n>` nick, `twitch.tv/tags`), no account needed.
- Phase 2, YouTube (built 2026-11-01; collector running; card deployed in
  arts-collective build `8q6B50ef…`, 2026-11-02 04:20 UTC): a YouTube destination's "Chat from" names one of
  the saving admin's connected channels (`chat_channel` = channel id, no
  migration; checked in `relaySaveDestination`). The collector looks for the
  active broadcast (`liveBroadcasts.list`, 1 unit) once a minute only while
  the destination is in the last go_live without a stop, then reads
  `liveChat/messages` (5 units) every 10 s or YouTube's
  `pollingIntervalMillis` if longer: about 5.5 hours of chat per day on the
  10,000 quota. Quota errors pause an hour. 2026-11-01: the one connected
  channel answered `liveStreamingNotEnabled` (the channel must be enabled
  for live streaming at youtube.com/features before any chat exists).
- Phase 3, Facebook: the Page's live video comments; needs Page read
  permissions in the Meta login configuration and App Review (not checked).
- Phase 4, Kick: a Kick developer app, `chat.message.sent` webhooks to an
  arts-collective route with Kick's RSA signature check.
- Open: the `/data` page should say that viewer chat from these platforms is
  kept 30 days (wording for the developer); replying from the Studio.
  ~~An OBS overlay of the chat~~: built 2026-11-02 as graphic `eac-chat`
  (reference doc "Stream relay", "Chat on air").

## Before either

- ~~Talk-room audio through a browser source has never been verified; it is
  a one-hour test that both sessions assume works. Do it first.~~ Verified
  2026-11-01 by session A (see "Session A status").
- Comments-to-threads still waits on migration 225 and `pages_manage_metadata`.
