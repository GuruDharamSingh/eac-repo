import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrgBySlug, getOrgFeed, isOrgOwner, canEditOrgSite } from "@/lib/org";
import { getCurrentUser } from "@/lib/session";
import { SubdomainEditorBar } from "@/components/SubdomainEditorBar";
import { getCommunityFeed, type CommunityFeedItem } from "@/lib/community-feed";
import type { OrgFeedItem } from "@/lib/org";

export const dynamic = "force-dynamic";

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=UnifrakturMaguntia&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --void:    #050508;
  --deep:    #0c0c14;
  --bezel:   #18181e;
  --bezel2:  #22222c;
  --screen:  #080810;
  --rule:    #2a2a38;
  --rule2:   #1a1a24;
  --ph:      #39ff14;       /* phosphor green */
  --amber:   #ffaa00;
  --red:     #cc2222;
  --crimson: #8b0000;
  --blue:    #3355ff;
  --ghost:   #d8d8cc;
  --dim:     #666660;
  --faint:   #333330;
  --mono:    'Share Tech Mono', 'Courier New', monospace;
  --serif:   'EB Garamond', Georgia, serif;
  --fraktur: 'UnifrakturMaguntia', 'Palatino Linotype', serif;
}

html { background: #020204; }
body { background: var(--void); color: var(--ghost); font-family: var(--mono); }
a { color: var(--ph); text-decoration: none; }
a:hover { color: var(--amber); text-decoration: underline; }
img { display: block; max-width: 100%; }

/* ── Grain overlay ────────────────────────────────────────────── */
#ep-root {
  max-width: 1200px;
  margin: 0 auto;
  background: var(--deep);
  border-left: 1px solid var(--rule);
  border-right: 1px solid var(--rule);
  position: relative;
}
#ep-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
  opacity: 0.35;
  animation: ep-grain 0.4s steps(2) infinite;
}
@keyframes ep-grain {
  0%  { transform: translate(0,0); }
  25% { transform: translate(-1px,1px); }
  50% { transform: translate(1px,-1px); }
  75% { transform: translate(-1px,-1px); }
  100%{ transform: translate(1px,1px); }
}

/* ── CRT TV block ─────────────────────────────────────────────── */
.ep-tv {
  background: var(--screen);
  border-radius: 8px;
  border: 3px solid var(--bezel2);
  box-shadow:
    0 0 0 6px var(--bezel),
    0 0 0 7px #111,
    0 0 24px rgba(57,255,20,0.06),
    inset 0 0 50px rgba(0,0,0,0.9);
  position: relative;
  overflow: hidden;
  margin-bottom: 10px;
}
/* CRT vignette */
.ep-tv::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%);
  pointer-events: none;
  z-index: 5;
}
/* Scanlines */
.ep-tv::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0,
    transparent 2px,
    rgba(0,0,0,0.18) 2px,
    rgba(0,0,0,0.18) 3px
  );
  pointer-events: none;
  z-index: 6;
  animation: ep-scan 12s linear infinite;
}
@keyframes ep-scan {
  from { background-position: 0 0; }
  to   { background-position: 0 60px; }
}

/* TV head bar */
.ep-tv__h {
  background: var(--bezel);
  border-bottom: 1px solid var(--rule);
  padding: 4px 9px;
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--dim);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 7;
}
.ep-tv__h--ph  { color: var(--ph); border-bottom-color: rgba(57,255,20,0.25); }
.ep-tv__h--amb { color: var(--amber); border-bottom-color: rgba(255,170,0,0.25); }
.ep-tv__h--red { color: var(--red); border-bottom-color: rgba(200,34,34,0.25); }
.ep-led {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--ph); box-shadow: 0 0 6px var(--ph);
  animation: ep-blink 2.5s ease-in-out infinite; margin-right: 5px;
}
.ep-led--red { background: var(--red); box-shadow: 0 0 6px var(--red); }
.ep-led--amb { background: var(--amber); box-shadow: 0 0 6px var(--amber); animation: none; }
@keyframes ep-blink { 0%,90%,100%{opacity:1} 95%{opacity:0.1} }

/* TV body */
.ep-tv__b {
  padding: 8px 10px;
  font-size: 11px;
  color: var(--ghost);
  line-height: 1.6;
  position: relative;
  z-index: 7;
}

/* Static screen (empty TV) */
.ep-static {
  height: 80px;
  background:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='s'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='1'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)' opacity='0.15'/%3E%3C/svg%3E"),
    linear-gradient(135deg, #0a0a0a 25%, #111 50%, #0a0a0a 75%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(57,255,20,0.25);
  letter-spacing: 0.1em;
  position: relative;
  z-index: 7;
  animation: ep-static-flicker 4s ease-in-out infinite;
}
@keyframes ep-static-flicker {
  0%,100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.4; }
  94% { opacity: 1; }
  96% { opacity: 0.6; }
  97% { opacity: 1; }
}

/* TV knobs (decorative, below screen) */
.ep-tv-base {
  background: var(--bezel);
  border-top: 1px solid var(--rule2);
  padding: 4px 8px;
  display: flex;
  gap: 5px;
  align-items: center;
  position: relative;
  z-index: 7;
}
.ep-knob {
  width: 8px; height: 8px; border-radius: 50%;
  border: 1px solid #444; background: #1e1e1e;
  box-shadow: 0 0 3px rgba(0,0,0,0.8);
}

/* ── Masthead ─────────────────────────────────────────────────── */
.ep-mast {
  border-bottom: 1px solid var(--rule);
  background: var(--void);
  padding: 14px 16px 10px;
  text-align: center;
  position: relative;
}
.ep-mast::before {
  content: '✦ ☽ ⊕ ✦ ☿ ✦ ⊕ ☽ ✦';
  display: block;
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--faint);
  margin-bottom: 8px;
}
.ep-mast::after {
  content: '⋯ ⊗ ⋯ ⊗ ⋯ ⊗ ⋯ ⊗ ⋯';
  display: block;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--faint);
  margin-top: 8px;
  border-top: 1px solid var(--rule2);
  padding-top: 6px;
}
.ep-mast__date {
  font-family: var(--mono); font-size: 10px; color: var(--dim); letter-spacing: 0.14em;
  text-transform: uppercase; margin-bottom: 10px;
  display: flex; justify-content: space-between; border-bottom: 1px solid var(--rule2); padding-bottom: 6px; margin-bottom: 10px;
}
.ep-mast__title {
  font-family: var(--fraktur); font-size: clamp(2rem, 4.5vw, 3.8rem);
  color: var(--ghost); line-height: 1;
  text-shadow: 0 0 30px rgba(57,255,20,0.1), 0 0 60px rgba(57,255,20,0.05);
  letter-spacing: 0.04em;
}
.ep-mast__sub {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.28em;
  text-transform: uppercase; color: var(--dim); margin-top: 5px;
}
.ep-mast__auth {
  position: absolute; top: 14px; right: 14px;
  font-size: 10px; font-family: var(--mono); color: var(--dim);
}
.ep-mast__auth a { color: var(--ph); }

/* ── Nav ──────────────────────────────────────────────────────── */
.ep-nav {
  background: var(--void);
  border-bottom: 1px solid var(--rule);
  display: flex; flex-wrap: wrap;
  border-top: 1px solid var(--rule);
}
.ep-nav a {
  display: inline-block; padding: 7px 14px;
  font-family: var(--mono); font-size: 10px; font-weight: 400;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--dim); text-decoration: none;
  border-right: 1px solid var(--rule2);
}
.ep-nav a:first-child { border-left: 1px solid var(--rule2); }
.ep-nav a:hover { color: var(--ph); background: rgba(57,255,20,0.04); text-decoration: none; }

/* ── Ticker ───────────────────────────────────────────────────── */
.ep-ticker {
  background: var(--void); color: var(--ph); height: 20px;
  display: flex; align-items: center; overflow: hidden;
  font-size: 10px; border-bottom: 1px solid rgba(57,255,20,0.12);
  font-family: var(--mono);
}
.ep-ticker__label {
  flex-shrink: 0; background: rgba(57,255,20,0.1);
  padding: 0 10px; height: 100%;
  display: flex; align-items: center;
  font-weight: 700; letter-spacing: 0.2em; font-size: 9px;
  border-right: 1px solid rgba(57,255,20,0.2);
  color: var(--ph);
}
.ep-ticker__scroll {
  padding-left: 20px; white-space: nowrap;
  animation: ep-scroll 55s linear infinite; opacity: 0.6;
}
@keyframes ep-scroll { from{transform:translateX(100vw)} to{transform:translateX(-100%)} }

/* ── 3-column body ────────────────────────────────────────────── */
.ep-body {
  display: grid;
  grid-template-columns: 195px 1fr 175px;
  align-items: start;
  padding: 12px 10px;
  gap: 10px;
}
.ep-col { display: flex; flex-direction: column; }

/* ── Glitch text effect ───────────────────────────────────────── */
.ep-glitch {
  position: relative; display: inline-block;
}
.ep-glitch::before, .ep-glitch::after {
  content: attr(data-text);
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
}
.ep-glitch::before {
  left: 2px; text-shadow: -1px 0 rgba(255,0,80,0.5);
  animation: ep-glitch1 3.5s infinite linear alternate-reverse;
}
.ep-glitch::after {
  left: -2px; text-shadow: 1px 0 rgba(0,200,255,0.5);
  clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
  animation: ep-glitch2 2.5s infinite linear alternate;
}
@keyframes ep-glitch1 {
  0%   { clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); transform: translate(0); }
  85%  { clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); transform: translate(0); }
  87%  { clip-path: polygon(0 15%, 100% 15%, 100% 35%, 0 35%); transform: translate(-2px, 1px); }
  89%  { clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); transform: translate(0); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); transform: translate(0); }
}
@keyframes ep-glitch2 {
  0%   { clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%); transform: translate(0); }
  80%  { clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%); transform: translate(0); }
  82%  { clip-path: polygon(0 65%, 100% 65%, 100% 85%, 0 85%); transform: translate(2px, -1px); }
  84%  { clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%); transform: translate(0); }
  100% { clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%); transform: translate(0); }
}

/* ── Center article screen ────────────────────────────────────── */
.ep-feat {
  background: var(--screen);
  border-radius: 8px;
  border: 3px solid var(--bezel2);
  box-shadow: 0 0 0 6px var(--bezel), 0 0 0 7px #111, 0 0 30px rgba(57,255,20,0.04);
  position: relative; overflow: hidden; margin-bottom: 10px;
}
.ep-feat::after {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 3px);
  pointer-events: none; z-index: 4; animation: ep-scan 12s linear infinite;
}
.ep-feat::before {
  content: '';
  position: absolute; inset: 0; border-radius: 6px;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%);
  pointer-events: none; z-index: 5;
}
.ep-feat__h {
  padding: 7px 12px; border-bottom: 1px solid var(--rule);
  background: var(--bezel); position: relative; z-index: 6;
  display: flex; align-items: center; justify-content: space-between;
}
.ep-feat__label {
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--amber);
}
.ep-feat__body { padding: 12px 14px; position: relative; z-index: 6; }
.ep-feat__img {
  width: 100%; height: 180px; background: var(--void);
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--rule); margin-bottom: 12px; position: relative; overflow: hidden;
}
.ep-feat__img-inner {
  font-family: var(--mono); font-size: 10px; color: rgba(57,255,20,0.2);
  letter-spacing: 0.1em; text-align: center;
}
.ep-feat__title {
  font-family: var(--serif); font-size: 1.4rem; font-weight: 600;
  line-height: 1.25; color: var(--ghost); margin-bottom: 8px;
  text-shadow: 0 0 20px rgba(57,255,20,0.08);
}
.ep-feat__title a { color: var(--ghost); }
.ep-feat__title a:hover { color: var(--ph); text-decoration: none; }
.ep-feat__body-text {
  font-family: var(--serif); font-size: 0.88rem; line-height: 1.65;
  color: #9999aa; margin-bottom: 10px;
}
.ep-feat__by {
  font-family: var(--mono); font-size: 10px; color: var(--faint);
  letter-spacing: 0.06em; margin-bottom: 8px;
  border-top: 1px solid var(--rule2); padding-top: 6px;
}
.ep-feat__more {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ph);
  text-shadow: 0 0 8px rgba(57,255,20,0.5);
}
.ep-feat__more:hover { color: var(--amber); }

/* ── Join / member ────────────────────────────────────────────── */
.ep-join {
  background: var(--void); padding: 12px 14px; text-align: center;
  border: 1px solid var(--rule); border-radius: 4px; margin-bottom: 10px;
}
.ep-join__t { font-family: var(--serif); font-size: 1rem; color: var(--ghost); margin-bottom: 4px; }
.ep-join__s { font-size: 10px; color: var(--dim); line-height: 1.5; margin-bottom: 8px; font-family: var(--mono); }
.ep-join__r { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.ep-join__b {
  display: inline-block; padding: 5px 14px;
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
  text-decoration: none; border: 1px solid;
}
.ep-join__b--p { border-color: var(--ph); color: var(--ph); background: rgba(57,255,20,0.06); }
.ep-join__b--g { border-color: var(--dim); color: var(--dim); background: transparent; }
.ep-join__b:hover { opacity: 0.8; text-decoration: none; }

.ep-member {
  background: rgba(57,255,20,0.04); border: 1px solid rgba(57,255,20,0.15);
  padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; font-family: var(--mono); color: var(--dim);
  margin-bottom: 10px;
}
.ep-member strong { color: var(--ph); }
.ep-member__ok { color: var(--ph); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }

/* ── Feed grid ────────────────────────────────────────────────── */
.ep-feed { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--rule2); }
.ep-feed__i {
  padding: 7px 9px; font-size: 10px; background: var(--screen);
}
.ep-feed__kind { font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-bottom: 3px; }
.ep-feed__kind em { color: var(--amber); font-style: normal; margin-left: 4px; }
.ep-feed__title { font-family: var(--serif); font-size: 0.85rem; color: var(--ghost); line-height: 1.3; margin-bottom: 2px; }
.ep-feed__exc { font-size: 10px; color: #666; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ── Sidebar mini lists ───────────────────────────────────────── */
.ep-list { list-style: none; }
.ep-list li { padding: 5px 0; border-bottom: 1px solid var(--rule2); font-size: 10px; line-height: 1.4; color: #888; }
.ep-list li:last-child { border-bottom: none; }
.ep-list__tag { display: block; font-size: 8px; color: var(--amber); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.ep-list li a { color: var(--ph); opacity: 0.7; }
.ep-list li a:hover { opacity: 1; }

/* ── ThreeJS / canvas placeholder ────────────────────────────── */
.ep-canvas-slot {
  width: 100%; height: 120px; background: var(--void);
  border: 1px solid var(--rule); position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em;
  text-transform: uppercase; color: rgba(57,255,20,0.2);
  border-radius: 4px; margin-bottom: 4px;
}
.ep-canvas-slot::before {
  content: '';
  position: absolute; inset: 0;
  background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(57,255,20,0.03) 60deg, transparent 120deg);
  animation: ep-rotate 8s linear infinite;
}
@keyframes ep-rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

/* ── Gallery strip ────────────────────────────────────────────── */
.ep-gal { background: var(--void); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.ep-gal__h { display: flex; justify-content: space-between; align-items: center; padding: 5px 12px; border-bottom: 1px solid var(--rule2); }
.ep-gal__title { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--dim); }
.ep-gal__upload { background: transparent; border: 1px solid var(--amber); color: var(--amber); padding: 3px 10px; font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
.ep-gal__upload:hover { background: rgba(255,170,0,0.1); }
.ep-gal__row { display: flex; gap: 2px; padding: 6px 10px; overflow-x: auto; }
.ep-gal__item {
  flex-shrink: 0; width: 110px; height: 80px; border: 1px solid var(--rule2);
  position: relative; overflow: hidden; cursor: pointer;
  background: var(--void);
  transition: border-color 0.15s;
  /* CRT bezel on each gallery thumb */
  box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
}
.ep-gal__item:hover { border-color: var(--amber); }
.ep-gal__item > div { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.ep-gal__item::after { /* scanlines on thumbnails */
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 3px);
  pointer-events: none;
}
.ep-gal__ov { position: absolute; bottom:0;left:0;right:0; background: linear-gradient(transparent,rgba(0,0,0,0.85)); padding: 12px 5px 4px; font-family: var(--mono); font-size: 8px; color: rgba(57,255,20,0.7); opacity: 0; transition: opacity 0.12s; }
.ep-gal__item:hover .ep-gal__ov { opacity: 1; }
.ep-gal__add { flex-shrink: 0; width: 110px; height: 80px; border: 1px dashed var(--rule); display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--faint); cursor: pointer; }
.ep-gal__add:hover { border-color: var(--amber); color: var(--amber); }

/* ── Article 2 ────────────────────────────────────────────────── */
.ep-art2 { background: var(--void); border-top: 1px solid var(--rule); }
.ep-art2__bar {
  background: var(--deep); border-bottom: 1px solid var(--rule);
  padding: 5px 14px; font-family: var(--mono); font-size: 9px; font-weight: 400;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim);
  display: flex; align-items: center; gap: 12px;
}
.ep-art2__bar span { color: var(--faint); }
.ep-art2__body { display: grid; grid-template-columns: 2fr 3fr; gap: 0; padding: 14px; }
.ep-art2__imgw { padding-right: 14px; border-right: 1px solid var(--rule2); }
.ep-art2__img  { width: 100%; aspect-ratio: 4/3; background: var(--void); display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 9px; color: rgba(57,255,20,0.15); letter-spacing: 0.08em; border: 1px solid var(--rule2); position: relative; overflow: hidden; }
.ep-art2__img::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px); }
.ep-art2__cap  { font-family: var(--mono); font-size: 9px; color: var(--faint); margin-top: 5px; line-height: 1.4; }
.ep-art2__txt  { padding-left: 14px; }
.ep-art2__kick { font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--amber); margin-bottom: 6px; }
.ep-art2__h    { font-family: var(--serif); font-size: 1.4rem; font-weight: 600; line-height: 1.2; color: var(--ghost); margin-bottom: 8px; }
.ep-art2__p    { font-family: var(--serif); font-size: 0.86rem; line-height: 1.65; color: #8888aa; margin-bottom: 10px; border-left: 2px solid var(--rule); padding-left: 10px; }
.ep-art2__by   { font-family: var(--mono); font-size: 10px; color: var(--faint); margin-bottom: 8px; border-top: 1px solid var(--rule2); padding-top: 6px; }
.ep-art2__more { display: inline-block; font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ph); border: 1px solid rgba(57,255,20,0.3); padding: 5px 12px; }
.ep-art2__more:hover { background: rgba(57,255,20,0.06); color: var(--ph); text-decoration: none; }

/* ── Footer ───────────────────────────────────────────────────── */
.ep-foot {
  background: var(--void); color: var(--faint); padding: 8px 14px;
  display: flex; justify-content: space-between; font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
  border-top: 1px solid var(--rule2);
}
.ep-foot a { color: var(--faint); }
.ep-foot a:hover { color: var(--ph); text-decoration: none; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 820px) {
  .ep-body { grid-template-columns: 1fr; padding: 8px; gap: 6px; }
  .ep-art2__body { grid-template-columns: 1fr; }
  .ep-art2__imgw { padding-right: 0; border-right: none; border-bottom: 1px solid var(--rule2); padding-bottom: 12px; margin-bottom: 12px; }
  .ep-art2__txt  { padding-left: 0; }
}
@media (max-width: 540px) {
  .ep-feed { grid-template-columns: 1fr; }
}
`;

// ─── helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

type Opts = {
  orgName: string; orgSlug: string;
  discipline: string | null; bio: string | null;
  displayName: string | null; city: string | null;
  isUserLoggedIn: boolean; userDisplayName: string | null;
  loginUrl: string; signupUrl: string;
  talkToken: string | null; nextcloudUrl: string; isLive: boolean;
  orgFeed: OrgFeedItem[]; networkFeed: CommunityFeedItem[];
};

function build(opts: Opts): string {
  const { orgName, discipline, bio, displayName, city,
    isUserLoggedIn, userDisplayName, loginUrl, signupUrl,
    talkToken, nextcloudUrl, isLive, orgFeed, networkFeed } = opts;

  const label = displayName ?? orgName;
  const today = new Date().toLocaleDateString("en-CA", { weekday:"long",year:"numeric",month:"long",day:"numeric" });
  const talkUrl = talkToken ? `${nextcloudUrl.replace(/\/$/,"")}/call/${talkToken}` : null;

  const events = orgFeed.filter(t=>t.scheduled_at && new Date(t.scheduled_at).getTime()>Date.now()).slice(0,4);

  const evHtml = events.length
    ? events.map(e=>{
        const d=new Date(e.scheduled_at!);
        return `<div style="padding:4px 0;border-bottom:1px solid var(--rule2);font-size:10px">
          <span style="color:var(--amber);font-size:8px;letter-spacing:0.1em;text-transform:uppercase">${d.toLocaleString("default",{month:"short"})} ${d.getDate()}</span>
          <div style="color:var(--ghost)">${esc(e.title)}</div>
        </div>`;
      }).join("")
    : `<span style="font-size:10px;color:var(--dim);font-style:italic">No events detected on this frequency.</span>`;

  const feedHtml = networkFeed.slice(0,6).length
    ? `<div class="ep-feed">${networkFeed.slice(0,6).map(i=>
        `<div class="ep-feed__i">
          <div class="ep-feed__kind">${esc(i.kind)}<em>${esc(i.orgName)}</em></div>
          <div class="ep-feed__title">${esc(i.title)}</div>
          ${i.excerpt?`<div class="ep-feed__exc">${esc(i.excerpt)}</div>`:""}
        </div>`
      ).join("")}</div>`
    : `<div style="padding:10px;font-size:10px;color:var(--dim);font-family:var(--mono)">// no signal. standing by.</div>`;

  const joinHtml = isUserLoggedIn
    ? `<div class="ep-member">
        <span>authenticated: <strong>${esc(userDisplayName??"member")}</strong> — <a href="/hub">hub</a></span>
        <span class="ep-member__ok">[ &#10003; network ]</span>
      </div>`
    : `<div class="ep-join">
        <p class="ep-join__t">Enter the Collective</p>
        <p class="ep-join__s">// authenticate to access member channels</p>
        <div class="ep-join__r">
          <a href="${signupUrl}" class="ep-join__b ep-join__b--p">Initialize</a>
          <a href="${loginUrl}"  class="ep-join__b ep-join__b--g">Authenticate</a>
        </div>
      </div>`;

  const galColors = ["#0d1a0d","#1a0d0d","#0d0d1a","#1a160d","#0d1a16","#160d1a","#1a0d14","#0d1514"];
  const galTiles = galColors.map((bg,i)=>
    `<div class="ep-gal__item">
      <div style="background:${bg}"><span style="font-size:18px;opacity:0.15;color:#3f3">&#9632;</span></div>
      <div class="ep-gal__ov">transmission ${i+1}</div>
    </div>`
  ).join("");

  return `<div id="ep-root">

<div class="ep-ticker">
  <div class="ep-ticker__label">&#8987; SIGNAL</div>
  <div class="ep-ticker__scroll">
    ✦ underground arts collective ✦ occult transmissions ✦ open calls ✦ experimental gatherings ✦
    dark arts residencies ✦ ritual workshops ✦ shadow gallery ✦ forbidden knowledge ✦
    ${esc(orgName)} ✦ frequency active ✦ tune in ✦
  </div>
</div>

<div class="ep-mast">
  <div class="ep-mast__date">
    <span>${today}</span>
    <span>Transmission :: ${esc(orgName)}</span>
  </div>
  <h1 class="ep-mast__title">
    <span class="ep-glitch" data-text="The Collective">The Collective</span>
  </h1>
  <p class="ep-mast__sub">&#9670; Underground &bull; Alternative &bull; Occult &bull; Arts &#9670;</p>
  <div class="ep-mast__auth">
    ${isUserLoggedIn
      ? `<span style="color:var(--ph)">&#9679; ${esc(userDisplayName??"member")}</span>`
      : `<a href="${loginUrl}">authenticate</a> / <a href="${signupUrl}">initialize</a>`}
  </div>
</div>

<nav class="ep-nav">
  <a href="/">&#9670; origin</a>
  <a href="/community-dark">&#9670; signal</a>
  <a href="#events">&#9670; events</a>
  <a href="#gallery">&#9670; transmissions</a>
  <a href="#workshops">&#9670; rites</a>
  <a href="#resources">&#9670; archives</a>
</nav>

<div class="ep-body">

  <!-- LEFT COLUMN: stacked TV screens -->
  <div class="ep-col">

    ${talkUrl ? `<div class="ep-tv">
      <div class="ep-tv__h ep-tv__h--red">
        <span><span class="ep-led ep-led--red"></span>${isLive?"LIVE TRANSMISSION":"TALK ROOM"}</span>
        <span>${isLive?"on air":"open"}</span>
      </div>
      <div class="ep-tv__b" style="padding:0">
        <a href="${isUserLoggedIn?`/api/talk/join?token=${talkToken}`:talkUrl}"
           target="${isUserLoggedIn?"_self":"_blank"}" rel="noopener"
           style="display:block;background:rgba(139,0,0,0.3);color:var(--red);text-align:center;padding:8px;font-family:var(--mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;border-top:1px solid var(--crimson)">
          ${isLive?"&#9679; JOIN SESSION":"&#9656; ENTER ROOM"}
        </a>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>` : ""}

    <div class="ep-tv">
      <div class="ep-tv__h ep-tv__h--amb"><span class="ep-led ep-led--amb"></span>LOCAL FREQUENCY</div>
      <div class="ep-tv__b">
        <div style="font-family:var(--mono);font-size:1.6rem;line-height:1;color:var(--amber);text-shadow:0 0 10px rgba(255,170,0,0.4);margin-bottom:4px">—°</div>
        <div style="font-size:9px;color:var(--dim)">${city?esc(city):"unknown location"}</div>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv" id="events">
      <div class="ep-tv__h ep-tv__h--ph"><span class="ep-led"></span>SCHEDULED RITES</div>
      <div class="ep-tv__b">${evHtml}</div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <!-- ThreeJS / canvas slot -->
    <div class="ep-tv">
      <div class="ep-tv__h"><span class="ep-led"></span>3D CHANNEL</div>
      <div class="ep-canvas-slot" id="ep-threejs-slot">
        <span>// threejs mount point<br>canvas injection ready</span>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv">
      <div class="ep-tv__h"><span class="ep-led"></span>${esc(label).toUpperCase()}</div>
      <div class="ep-tv__b">
        <div style="font-family:var(--serif);font-size:0.9rem;font-weight:600;color:var(--ghost);margin-bottom:3px">${esc(label)}</div>
        <div style="font-size:9px;color:var(--dim);margin-bottom:5px">${esc(discipline??"collective")}${city?` &#9670; ${esc(city)}`:""}</div>
        ${bio?`<div style="font-family:var(--serif);font-style:italic;font-size:0.82rem;color:#777;line-height:1.5;margin-bottom:6px">${esc(bio.slice(0,100))}${bio.length>100?"&hellip;":""}</div>`:""}
        <a href="/" style="font-family:var(--mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ph);opacity:0.7">visit channel &rarr;</a>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv">
      <div class="ep-tv__h"><span class="ep-led"></span>REGIONAL ARTS</div>
      <div class="ep-tv__b">
        <ul class="ep-list">
          <li><span class="ep-list__tag">Signal</span><a href="#">Open calls — spring 2026</a></li>
          <li><span class="ep-list__tag">Archive</span><a href="#">Grant deadlines this quarter</a></li>
          <li><span class="ep-list__tag">Rite</span><a href="#">Experimental residency programs</a></li>
          <li><span class="ep-list__tag">Dark</span><a href="#">Underground arts council round</a></li>
        </ul>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

  </div><!-- /left -->

  <!-- CENTER COLUMN -->
  <div class="ep-col">

    <div class="ep-feat">
      <div class="ep-feat__h">
        <span class="ep-feat__label">&#9670; PRIMARY TRANSMISSION</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--dim)">${shortDate(new Date().toISOString())}</span>
      </div>
      <div class="ep-feat__body">
        <div class="ep-feat__img">
          <div class="ep-feat__img-inner">
            &#9632; &#9633; &#9632;<br>
            [CHANNEL OPEN]<br>
            &#9632; &#9633; &#9632;
          </div>
        </div>
        <h2 class="ep-feat__title">
          <a href="#">Artists, makers &amp; signal-carriers gather across the collective</a>
        </h2>
        <p class="ep-feat__body-text">
          The Elkdonis Arts Collective moves between visible and invisible registers —
          from community workshops to experimental residencies, underground gatherings,
          and cross-disciplinary collaborations. New transmissions arrive constantly.
        </p>
        <div class="ep-feat__by">
          ${esc(orgName)} // community desk // ${today}
        </div>
        <a class="ep-feat__more" href="#workshops">read transmission &rarr;</a>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    ${joinHtml}

    <!-- Animation slot -->
    <div class="ep-tv" style="margin-bottom:10px">
      <div class="ep-tv__h ep-tv__h--ph"><span class="ep-led"></span>ANIMATION CHANNEL</div>
      <div class="ep-canvas-slot" id="ep-animation-slot" style="height:160px">
        <span>// animation mount point<br>css / canvas / webgl injection<br>ready for binding</span>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv" style="margin-bottom:0">
      <div class="ep-tv__h"><span class="ep-led"></span>LATEST TRANSMISSIONS<span style="margin-left:auto;font-size:9px;font-family:var(--mono);color:var(--dim);letter-spacing:0"><a href="/artists" style="color:var(--dim)">all channels &rarr;</a></span></div>
      ${feedHtml}
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv" id="workshops">
      <div class="ep-tv__h ep-tv__h--amb"><span class="ep-led ep-led--amb"></span>SCHEDULED RITES &amp; SESSIONS</div>
      <div class="ep-tv__b">
        ${orgFeed.filter(t=>t.kind==="workshop"||t.kind==="event").slice(0,3).map(t=>
          `<div style="padding:4px 0;border-bottom:1px solid var(--rule2);font-size:10px">
            <div style="font-size:8px;color:var(--dim);letter-spacing:0.1em;text-transform:uppercase">${esc(t.kind)}${t.scheduled_at?" :: "+shortDate(t.scheduled_at):""}</div>
            <div style="color:var(--ghost);font-family:var(--serif);font-size:0.88rem">${esc(t.title)}</div>
          </div>`
        ).join("") || `<div style="font-size:10px;color:var(--dim);font-family:var(--mono)">// no rites scheduled. standing by.</div>`}
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

  </div><!-- /center -->

  <!-- RIGHT COLUMN: stacked TV screens -->
  <div class="ep-col">

    <div class="ep-tv">
      <div class="ep-tv__h"><span class="ep-led"></span>ART SIGNAL FEED</div>
      <div class="ep-tv__b">
        <ul class="ep-list">
          <li><span class="ep-list__tag">Collective</span>New transmissions from emerging voices</li>
          <li><span class="ep-list__tag">Open call</span>Dark arts residency applications open</li>
          <li><span class="ep-list__tag">Signal</span>Regional experimental arts funding</li>
          <li><span class="ep-list__tag">Rite</span>Open studio gatherings announced</li>
          <li><span class="ep-list__tag">Archive</span>Artist talks — occult season</li>
        </ul>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <!-- Static screen (no signal) -->
    <div class="ep-tv">
      <div class="ep-tv__h"><span class="ep-led"></span>CHANNEL 3 — STATIC</div>
      <div class="ep-static">NO SIGNAL ///</div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv">
      <div class="ep-tv__h ep-tv__h--amb"><span class="ep-led ep-led--amb"></span>COMMUNITY PULSE</div>
      <div class="ep-tv__b">
        <div style="font-family:var(--serif);font-size:0.86rem;color:var(--ghost);margin-bottom:6px">What manifests next?</div>
        ${["More workshops","Open studio days","Ritual gatherings","Dark residency"].map((o,i)=>
          `<div style="display:flex;border:1px solid var(--rule2);margin-bottom:3px;font-family:var(--mono);font-size:10px;cursor:pointer;background:var(--void)">
            <span style="background:rgba(57,255,20,0.05);padding:3px 6px;color:var(--ph);opacity:0.5;border-right:1px solid var(--rule2)">${i+1}</span>
            <span style="padding:3px 7px;color:#888">${o}</span>
          </div>`
        ).join("")}
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <!-- Another static/animation slot -->
    <div class="ep-tv">
      <div class="ep-tv__h"><span class="ep-led"></span>CHANNEL 5 — ANIMATION</div>
      <div class="ep-canvas-slot" id="ep-canvas-right" style="height:100px;margin-bottom:0">
        <span>// animation ready</span>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv" id="resources">
      <div class="ep-tv__h"><span class="ep-led"></span>ARCHIVES</div>
      <div class="ep-tv__b">
        <ul class="ep-list">
          <li><span class="ep-list__tag">Archive</span><a href="#">Open calls — dark season</a></li>
          <li><span class="ep-list__tag">Resource</span><a href="#">Grant frequencies active</a></li>
          <li><span class="ep-list__tag">Space</span><a href="#">Underground studio access</a></li>
          <li><span class="ep-list__tag">Docs</span><a href="#">Collective documentation</a></li>
        </ul>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

    <div class="ep-tv">
      <div class="ep-tv__h ep-tv__h--ph"><span class="ep-led"></span>CHANNELS</div>
      <div class="ep-tv__b">
        <ul class="ep-list">
          <li><a href="${signupUrl}">&#9656; initialize account</a></li>
          <li><a href="/">&#9656; origin channel</a></li>
          <li><a href="/artists">&#9656; collective members</a></li>
          ${talkUrl?`<li><a href="${talkUrl}" target="_blank" rel="noopener">&#9656; talk channel</a></li>`:""}
          <li><a href="/hub">&#9656; member hub</a></li>
        </ul>
      </div>
      <div class="ep-tv-base"><span class="ep-knob"></span><span class="ep-knob"></span></div>
    </div>

  </div><!-- /right -->

</div><!-- /body -->

<!-- Gallery transmissions -->
<div class="ep-gal" id="gallery">
  <div class="ep-gal__h">
    <span class="ep-gal__title">&#9632; GALLERY TRANSMISSIONS &mdash; member work</span>
    <button class="ep-gal__upload" onclick="alert('Transmission upload coming soon.')">+ transmit image</button>
  </div>
  <div class="ep-gal__row">
    ${galTiles}
    <div class="ep-gal__add" title="Transmit your work">+</div>
  </div>
</div>

<!-- Article 2 -->
<div class="ep-art2">
  <div class="ep-art2__bar">
    from the collective
    <span>&#9670; features &#9670; ${today}</span>
  </div>
  <div class="ep-art2__body">
    <div class="ep-art2__imgw">
      <div class="ep-art2__img">
        <span>&#9632; &#9633; &#9632;<br>[transmission]<br>&#9632; &#9633; &#9632;</span>
      </div>
      <p class="ep-art2__cap">Gathering &mdash; ${esc(orgName)} &mdash; artists across frequencies.</p>
    </div>
    <div class="ep-art2__txt">
      <div class="ep-art2__kick">collective &#9670; underground &#9670; signal</div>
      <h2 class="ep-art2__h">Building a grassroots arts network in the shadows</h2>
      <p class="ep-art2__p">
        From neighbourhood studios to distributed online nodes, the Elkdonis Arts Collective
        operates between registers — visible and invisible, mainstream and underground.
        Not a gallery or institution. A living transmission network of people making things.
      </p>
      <div class="ep-art2__by">transmission // ${esc(orgName)} // ${today}</div>
      <a class="ep-art2__more" href="/community-dark">full transmission &rarr;</a>
    </div>
  </div>
</div>

<div class="ep-foot">
  <span>Elkdonis Arts Collective &#9670; Underground Edition &#9670; ${esc(orgName)}</span>
  <span>&copy; ${new Date().getFullYear()} &#9670; <a href="/">origin</a> &#9670; <a href="/hub">hub</a></span>
</div>

</div>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export default async function CommunityDarkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  const rootBase = `${proto}://${rootHost}`;

  const user = await getCurrentUser();
  const owner = user ? await isOrgOwner(user.id, org.id) : false;
  const canEdit = user ? owner || (await canEditOrgSite(user.id, org.id)) : false;

  const [orgFeed, networkFeed] = await Promise.all([
    getOrgFeed(org.id, 20),
    getCommunityFeed(8),
  ]);

  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || "http://localhost:8080";
  const now = Date.now();
  const liveItem = orgFeed.find((t) => {
    if (!t.nextcloud_talk_token || !t.scheduled_at || !t.duration_minutes) return false;
    const start = new Date(t.scheduled_at).getTime();
    return now >= start && now <= start + t.duration_minutes * 60_000;
  });
  const upcomingItem = orgFeed.find(
    (t) => t.nextcloud_talk_token && t.scheduled_at && new Date(t.scheduled_at).getTime() > now
  );
  const talkItem = liveItem ?? upcomingItem ?? null;
  const profile = org.profile;

  const html = build({
    orgName: org.name, orgSlug: slug,
    discipline: profile?.disciplines?.[0] ?? null,
    bio: profile?.bio ?? org.description ?? null,
    displayName: profile?.display_name ?? null,
    city: profile?.city ?? null,
    isUserLoggedIn: Boolean(user),
    userDisplayName: user?.email.split("@")[0] ?? null,
    loginUrl: `/login?org=${encodeURIComponent(slug)}`,
    signupUrl: `/login?mode=signup&org=${encodeURIComponent(slug)}`,
    talkToken: talkItem?.nextcloud_talk_token ?? null,
    nextcloudUrl, isLive: Boolean(liveItem),
    orgFeed, networkFeed,
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {canEdit && (
        <SubdomainEditorBar
          orgSlug={slug}
          workshopsUrl={`${rootBase}/hub/workshops/${slug}`}
          isOwner={owner}
        />
      )}
    </>
  );
}
