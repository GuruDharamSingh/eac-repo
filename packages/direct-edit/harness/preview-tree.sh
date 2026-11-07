docker rm -f ig-preview >/dev/null 2>&1
docker compose run -d --no-deps --name ig-preview -v '${S:?set S to a scratch folder holding h3/}/ig-next:/app/apps/innergathering/.next' -v '${S:?set S to a scratch folder holding h3/}/h3:/h:ro' -v '${S:?set S to a scratch folder holding h3/}/h3/t-page.tsx:/app/apps/innergathering/src/app/data/page.tsx:ro' -e NODE_ENV=development -e NODE_OPTIONS=--max-old-space-size=3072 innergathering sh -c 'cd apps/innergathering && pnpm exec next dev -p 3015 -H 0.0.0.0' 2>&1 | grep -v level=warning | tail -1 | cut -c1-12
for i in $(seq 1 40); do docker logs ig-preview 2>&1 | grep -q 'Ready in' && break; sleep 3; done
docker exec ig-preview node -e "
(async()=>{ const r=await fetch('http://127.0.0.1:3015/data',{signal:AbortSignal.timeout(200000)}); const t=await r.text(); const m=/<body[^>]*>([\s\S]*)<\/body>/.exec(t); const strip=(m?m[1]:t).replace(/<script\b[\s\S]*?<\/script>/g,'');
 console.log('status',r.status,'html',strip.length);
 for (const k of ['data-page-root','ig-hero-title','ig-hero-figure','about-lead','gold-rule','id=\"about\"','id=\"board\"','background:#c60c0c','LIVE-SIGN-IN','LIVE-OFFERINGS','LIVE-BANNER','LIVE-GALLERY','LIVE-JOIN','LIVE-FORUM','LIVE-PROGRESS','LIVE-STATUS','LIVE-BOARD']) console.log(k, strip.includes(k));
 console.log('heading moved into the figure', /ig-hero-figure[\s\S]{0,700}ig-hero-title/.test(strip));
 console.log('editor markers in visitor html', /data-tree-|de-vpanel|data-de-ui/.test(strip));
 const s=await fetch('http://127.0.0.1:3015/',{signal:AbortSignal.timeout(200000)}); const st=await s.text(); console.log('coded home still', s.status, (st.match(/data-landing-part=/g)||[]).length, 'parts');
})().catch(e=>console.log('ERR',e.message));"
docker logs ig-preview 2>&1 | grep -E -i ' error|cannot find|module not found|Ecmascript|Can.t resolve|Functions cannot|Only plain objects' | grep -v -i calendar | sort -u | head -10 | cut -c1-260
docker rm -f ig-preview >/dev/null
