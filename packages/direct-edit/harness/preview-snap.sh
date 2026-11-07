docker rm -f ig-preview >/dev/null 2>&1
docker compose run -d --no-deps --name ig-preview -v '${S:?set S to a scratch folder holding h3/}/ig-next:/app/apps/innergathering/.next' -v '${S:?set S to a scratch folder holding h3/}/h3:/h' -e NODE_ENV=development -e NODE_OPTIONS=--max-old-space-size=3072 innergathering sh -c 'cd apps/innergathering && pnpm exec next dev -p 3015 -H 0.0.0.0' 2>&1 | grep -v level=warning | tail -1 | cut -c1-12
for i in $(seq 1 40); do docker logs ig-preview 2>&1 | grep -q 'Ready in' && break; sleep 3; done
docker exec ig-preview node -e "
const fs=require('fs');(async()=>{ const u='http://127.0.0.1:3015'; const r=await fetch(u+'/',{signal:AbortSignal.timeout(170000)}); const t=await r.text(); console.log('home',r.status,t.length,(t.match(/data-landing-part=/g)||[]).length);
 const css=[...new Set([...t.matchAll(/href=\"(\/_next\/static[^\"]+\.css[^\"]*)\"/g)].map(m=>m[1].replace(/&amp;/g,'&')))]; let all=''; for(const c of css){ all+=await (await fetch(u+c)).text()+'\n'; } fs.writeFileSync('/h/land.css',all);
 const m=/<body[^>]*>([\s\S]*)<\/body>/.exec(t); const body=m[1].replace(/<script\b[\s\S]*?<\/script>/g,''); fs.writeFileSync('/h/land-body.html',body); console.log('css',all.length,'body',body.length);
 for (const p of ['/studio/try-it/canvas','/p/try-it','/p/landing']) { const q=await fetch(u+p,{redirect:'manual',signal:AbortSignal.timeout(170000)}); console.log(p,q.status,q.headers.get('location')||''); } })().catch(e=>console.log('ERR',e.message));"
docker logs ig-preview 2>&1 | grep -E -i ' error|cannot find|module not found|Ecmascript|Can.t resolve' | grep -v -i calendar | sort -u | head -10 | cut -c1-220
docker rm -f ig-preview >/dev/null
