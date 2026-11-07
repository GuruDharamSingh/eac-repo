set -e
ES=$(ls -d /app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/bin/esbuild)
cd /app/apps/arts-collective
$ES /w/h3/visual.ts --bundle --format=iife --outfile=/w/h3/visual.js --log-level=warning --define:process.env.NODE_ENV=\"development\"
$ES /w/h3/editor.ts --bundle --format=iife --outfile=/w/h3/editor.js --log-level=warning --define:process.env.NODE_ENV=\"development\" --external:node:*
cp /app/packages/direct-edit/src/direct-edit.css /w/h3/visual.css
cat /app/packages/direct-edit/src/direct-edit.css /app/apps/arts-collective/src/components/classifieds/classifieds.css > /w/h3/editor.css
ls -la /w/h3 | head -20
$ES /w/h3/live.ts --bundle --format=iife --outfile=/w/h3/live.js --log-level=warning --define:process.env.NODE_ENV=\"development\"
NODE_PATH=/app/apps/innergathering/node_modules $ES /w/h3/pick.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/pick.js --log-level=warning --define:process.env.NODE_ENV=\"development\"
cp /app/packages/cms-ui/src/files/files-card.css /w/h3/files-card.css
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/tree.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/tree.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
cp /app/packages/blocks/src/blocks.css /w/h3/blocks.css
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/test.ts --bundle --format=iife --minify --jsx=automatic --outfile=/w/h3/test.js --log-level=error --define:process.env.NODE_ENV=\"production\" --external:node:*
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/landing.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/landing.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/view-blocks.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/view-blocks.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/smoke-morph.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/smoke-morph.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
