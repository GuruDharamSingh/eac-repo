set -e
ES=$(ls -d /app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/bin/esbuild)
cd /app/apps/arts-collective
$ES /w/h3/editor.ts --bundle --format=iife --outfile=/w/h3/editor.js --log-level=warning --define:process.env.NODE_ENV=\"development\" --external:node:*
cp /app/packages/direct-edit/src/direct-edit.css /w/h3/visual.css
cat /app/packages/direct-edit/src/direct-edit.css /app/apps/arts-collective/src/components/classifieds/classifieds.css > /w/h3/editor.css
$ES /w/h3/live.ts --bundle --format=iife --outfile=/w/h3/live.js --log-level=warning --define:process.env.NODE_ENV=\"development\"
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/tree.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/tree.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
cp /app/packages/blocks/src/blocks.css /w/h3/blocks.css
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/landing.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/landing.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
cd /w/h3 && H='<!doctype html><meta charset=utf-8><link rel=stylesheet href=land.css><link rel=stylesheet href=visual.css>'
{ printf '%s' "$H"; cat land-body.html; printf '<script src=live.js></script>'; } > snapshot.html
{ printf '%s<link rel=stylesheet href=blocks.css>' "$H"; cat land-body.html; printf '<script src=landing.js></script>'; } > landing.html
