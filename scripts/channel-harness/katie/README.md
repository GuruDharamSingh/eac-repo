# katie Channel harness

Renders katie-the-potter's Channel tabs (`apps/katie-the-potter/src/components/channel/ChannelTabs.tsx`:
Queue, Board with the piece summary, Out) on a hand-written sample model, in the site's palette
(the `:root` block of `globals.css`) and `channel.css`. No server, no database: `@/lib/channel-door`
is stubbed (`stubs/channel-door.ts`, every move succeeds) and `next/link` / `next/navigation` use the
parent harness's stubs. The page frame (title, New, tabs) is a copy of `page.tsx`'s markup.

Pages: queue, queue-plan (first Plan it opened), queue-make (first Make into opened), queue-new,
board, board-summary, out, out-failed. `shot.mjs` also takes 390-wide shots of queue, board,
board-summary and out.

```bash
H=$PWD/scripts/channel-harness/katie   # from the repo root
sudo -n docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs
sudo -n docker run -d --name shot-<you> --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro \
  --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 --remote-allow-origins='*' about:blank
IP=$(sudo -n docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}' shot-<you>)
chmod 777 $H/png
sudo -n docker run --rm --network guru-eac_eac-network -v $H/png:/png -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP [queue,board-phone]
sudo -n docker rm -f shot-<you>
```

When `ChannelModel` (`packages/channel/src/model.ts`) changes, update the sample model in `entry.tsx`.
`out/` and `png/` are build output (gitignored).
