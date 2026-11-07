set -e
cp /app/packages/direct-edit/src/direct-edit.css /w/h/editor.css
cd /app/apps/sunjay && node /w/build.cjs
