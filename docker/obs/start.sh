#!/bin/bash
# Start the virtual display, audio, window manager, VNC, OBS and the agent.
# OBS's config is seeded on every start (profile, websocket password from
# the environment); its scene collection persists in $HOME (volume).
set -u
W=${OBS_WIDTH:-1920}; H=${OBS_HEIGHT:-1080}
CFG=$HOME/.config/obs-studio
# A container stop is never a clean OBS shutdown; without this OBS 32 opens
# a "run in Safe Mode?" dialog, and Safe Mode disables obs-websocket.
rm -rf "$CFG/.sentinel"
# The browser source's Chromium profile keeps a lock naming the old
# container's hostname; a recreated container sees it as "profile in use"
# and CEF exits with code 21.
rm -f "$CFG/plugin_config/obs-browser/Singleton"*
mkdir -p "$CFG/basic/profiles/EAC" "$CFG/basic/scenes" "$CFG/plugin_config/obs-websocket" /recordings

# Encoder: VA-API H.264 on the iGPU when it answers, else x264 on the CPU.
# Advanced output mode, because Simple mode offers no VA-API choice.
KBPS=${OBS_VIDEO_KBPS:-6000}
if [ "${OBS_ENCODER:-auto}" != "x264" ] && [ -e /dev/dri/renderD128 ] \
   && vainfo --display drm --device /dev/dri/renderD128 2>/dev/null | grep -q 'VAProfileH264High.*VAEntrypointEncSlice'; then
  ENCODER=ffmpeg_vaapi
  ENC_JSON="{\"vaapi_device\":\"/dev/dri/renderD128\",\"profile\":100,\"level\":-99,\"rate_control\":\"CBR\",\"bitrate\":$KBPS,\"keyint_sec\":2,\"bf\":0}"
else
  ENCODER=obs_x264
  ENC_JSON="{\"rate_control\":\"CBR\",\"bitrate\":$KBPS,\"keyint_sec\":2,\"preset\":\"veryfast\",\"profile\":\"high\"}"
fi
echo "[obs-start] encoder: $ENCODER"

for f in global.ini user.ini; do
cat > "$CFG/$f" <<INI
[General]
FirstRun=false
LastVersion=999999999
EnableAutoUpdates=false
ConfirmOnExit=false
# Software GL (llvmpipe) on Xvfb: the browser source's shared GPU textures
# come back black with hardware acceleration on.
BrowserHWAccel=false
[Basic]
Profile=EAC
ProfileDir=EAC
SceneCollection=EAC
SceneCollectionFile=EAC
[BasicWindow]
SysTrayEnabled=false
# Drawing the preview in OBS's own window is software GL at 30 fps and the
# largest idle cost; the Studio page and recordings do not need it. Turn it
# back on from the window (right-click the preview) when working in noVNC.
PreviewEnabled=false
INI
done

cat > "$CFG/basic/profiles/EAC/basic.ini" <<INI
[General]
Name=EAC
[Video]
BaseCX=$W
BaseCY=$H
OutputCX=$W
OutputCY=$H
FPSType=0
FPSCommon=30
[Output]
Mode=Advanced
[AdvOut]
Encoder=$ENCODER
ApplyServiceSettings=true
TrackIndex=1
RecType=Standard
RecFilePath=/recordings
RecFormat2=mkv
RecEncoder=none
RecTracks=1
RecFileNameWithoutSpace=true
FFAudioMixes=1
Track1Bitrate=160
[Audio]
SampleRate=48000
ChannelSetup=Stereo
INI

echo "$ENC_JSON" > "$CFG/basic/profiles/EAC/streamEncoder.json"

cat > "$CFG/plugin_config/obs-websocket/config.json" <<JSON
{"alerts_enabled":false,"auth_required":true,"first_load":false,"server_enabled":true,"server_password":"${OBS_WEBSOCKET_PASSWORD:?set OBS_WEBSOCKET_PASSWORD}","server_port":4455}
JSON

Xvfb :99 -screen 0 ${W}x${H}x24 -nolisten tcp &
sleep 1
pulseaudio --daemonize=yes --exit-idle-time=-1 --disallow-exit 2>/dev/null
pactl load-module module-null-sink sink_name=eac sink_properties=device.description=EAC >/dev/null 2>&1 || true
# No wallpaper setter is installed; without this fluxbox opens a dialog about it.
mkdir -p "$HOME/.fluxbox" && echo 'background: none' > "$HOME/.fluxbox/overlay"
fluxbox >/dev/null 2>&1 &
( sleep 3; pkill -f 'xmessage.*fbsetbg' ) &
x11vnc -display :99 -forever -shared -rfbport 5900 -localhost ${OBS_VNC_PASSWORD:+-passwd "$OBS_VNC_PASSWORD"} -quiet >/dev/null 2>&1 &
websockify --web /usr/share/novnc 6080 localhost:5900 >/dev/null 2>&1 &

# The agent reconnects to OBS on its own; OBS is restarted if it exits.
node /opt/obs-agent/agent.mjs &
while true; do
  obs --profile EAC --collection EAC --disable-shutdown-check --disable-missing-files-check 2>&1 | grep -vE 'Xlib|QStandardPaths' 
  echo "[obs-start] obs exited; restarting in 5 s"
  sleep 5
done
