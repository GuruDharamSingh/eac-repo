# Signal Watch

A tiny, single-purpose web app that tells you when your phone's cell data drops and when it comes back. Built for a trip to Nunavut. No accounts, no server logic, no build step: three static files and some icons.

## What it does

- Checks the connection every 20 seconds (adjustable) by reaching out to the internet. If nothing answers within 8 seconds, that counts as **No service**. Slow replies (over 1.5 s) count as **Weak**.
- Alerts on every change with a sound, a vibration (Android), and optionally a notification. Drop = low falling tone. Back = rising tone.
- Keeps a log of every change with the time, the response time, the connection type where the browser exposes it, and optionally GPS coordinates. GPS works without cell service.
- Shows today's drop count and percentage of time with service.
- Keeps the screen on while watching (phones pause web apps when the screen is off).
- Opens without a connection once installed, thanks to the service worker.
- Share/export the log as text through the phone's share sheet.

## What it cannot do

- It measures **whether data gets through**, not raw signal bars. Browsers do not expose signal strength. A native Android app could read dBm directly; nothing on iOS can.
- It only runs **while the app is open on screen**. That is why "Keep screen on" defaults to on. Switching apps or locking the phone pauses checking until you come back.
- It costs a little data: each check is a few hundred bytes.

## Hosting it

It must be served over **HTTPS** for install, notifications, and wake lock to work. Any static host will do. Put the `signal-watch` folder somewhere public, for example:

```
# Quick local test on your LAN (no HTTPS, so install/notifications won't work, but the page does):
cd apps/signal-watch && python3 -m http.server 8090
```

For production, drop the folder into any existing nginx/Caddy site as a subpath or subdomain, or add a static container:

```yaml
signal-watch:
  image: nginx:alpine
  volumes:
    - ./apps/signal-watch:/usr/share/nginx/html:ro
```

Then put your usual HTTPS proxy in front of it. Netlify, Cloudflare Pages, GitHub Pages, or Vercel static also work with zero configuration: upload the folder.

## Installing on the phone

- **iPhone:** open the URL in Safari, tap Share, then **Add to Home Screen**. Open it from the home screen icon. Notifications only work from the installed version (iOS 16.4 or later).
- **Android:** open the URL in Chrome, tap the ⋮ menu, then **Add to Home screen** or **Install app**.

Then tap **Start watching**, tap **Test the alerts** once so you know what the sounds mean, and leave the phone on that screen.

## Tuning

Constants at the top of the script in `index.html`:

| Constant | Default | Meaning |
|---|---|---|
| `PROBE_TIMEOUT_MS` | 8000 | No reply within this = no service |
| `WEAK_MS` | 1500 | Slower than this = weak |
| `RECOVER_NEEDED` | 2 | Consecutive good checks before announcing "back" (stops flapping) |

If you change any of the cached files, bump `CACHE` in `sw.js` so installed phones pick up the new version.
