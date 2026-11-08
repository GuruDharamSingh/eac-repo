# Hub cards render harness

Renders the real Members card (`packages/hub/src/members`: Face, Popup, Detail) on the design's
sample data (`docs/open/hub-cards-handoff/source/MemberHub.dc.html`), with no server and no
database. `host.act` resolves `{ ok: true }` after 600 ms and logs; `host.refresh` logs.
Use it to see a layout change before a rebuild. It cannot catch server-only problems.

Pages (the `__PAGE__` value, one HTML each in `out/`): card, card-small, card-solo, card-guide,
popup, popup-guide, popup-demote, popup-nomatch, people, people-guide, people-expanded,
confirm-remove, confirm-demote, arrivals, arrivals-guide, arrivals-empty, visitors, visitors-30d,
visitors-90d, permissions, permissions-guide, small-org, small-org-guide, solo, card-plain and
people-plain (no Industry theme, a sample org palette through `--sf-*` / `--eac-hub-*`), and
popup-phone / people-phone (390 wide). Pages that show a state (expanded row, confirm dialog,
inline demote) drive the real controls from `members.tsx` after mount.

```bash
H=$PWD/scripts/hub-cards-harness   # from the repo root
mkdir -p $H/out $H/png
# 1. bundle
sudo -n docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs
# 2. a Chrome to drive
sudo -n docker run -d --name shot-hubcards --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank
IP=$(sudo -n docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}' shot-hubcards)
# 3. screenshots (all pages, or a comma list such as popup,people)
sudo -n docker run --rm --network guru-eac_eac-network -v $H/png:/out -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP popup,people
sudo -n docker rm -f shot-hubcards
```

`out/` and `png/` are build output (git-ignored). When `members/model.ts` changes, update the sample
data in `members.tsx`; the stub `act` accepts any action id.
