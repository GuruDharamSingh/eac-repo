#!/usr/bin/env node
/*
 * build.mjs
 * =========
 * Generates the workspace dependency graph: one self-contained HTML page that
 * shows which apps and packages depend on which, how far a change reaches,
 * declarations with no import, imports with no declaration, and cycles.
 *
 *   node scripts/workspace-graph/build.mjs [out.html]
 *
 * Default output: $TMPDIR/eac-workspace-graph.html (outside the repo).
 * Runs on the host with Node 20+; uses only Node built-ins and reads the
 * working tree, so uncommitted changes are included. App running state comes
 * from `docker ps` (directly, then through `sg docker`); without Docker access
 * the page shows it as unknown.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extract } from './extract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'eac-workspace-graph.html'));

// Port, public host and a status note per app directory, from the Apps table
// in CLAUDE.md. Update both together.
const APPS = {
  admin: [3000, '', 'internal'],
  sunjay: [3001, 'paratheater.arts-collective.com'],
  'blog-guru-dharam': [3002, ''],
  forum: [3003, 'forum.arts-collective.com'],
  'inner-gathering': [3004, 'meetings.elkdonis-arts.org', 'retired'],
  'elkdonis-arts-collective': [3005, '', 'retired'],
  'amrit-canada': [3006, 'amritcanada.ca'],
  'arts-collective': [3007, 'arts-collective.com'],
  ifac: [3008, 'ifacgroup.com'],
  'art-auction': [3009, 'market.arts-collective.com'],
  'blog-tester': [3011, ''],
  'hidden-enneagram': [3012, 'hiddenenneagram.com'],
  artdirect: [3013, 'directory.arts-collective.com'],
  pigeonshoot: [3014, ''],
  innergathering: [3015, 'elkdonis-arts.org'],
  elastrocal: [3016, 'arts-collective.com/astro'],
  danamccool: [3018, 'danamccool.com'],
  fourthwayBookreaders: [3019, 'elkdonis-arts.org/books'],
  sophia: [3020, '', 'not deployed'],
};

// Host ports published by running containers, or null when Docker is not reachable.
function publishedPorts() {
  const fmt = '{{.Ports}}';
  const attempts = [['docker', ['ps', '--format', fmt]], ['sg', ['docker', '-c', `docker ps --format '${fmt}'`]]];
  for (const [cmd, args] of attempts) {
    try {
      const text = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
      return new Set([...text.matchAll(/:(\d+)->/g)].map(m => Number(m[1])));
    } catch { /* try the next way in */ }
  }
  return null;
}

function gitBranch() {
  try { return execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim() || 'detached HEAD'; }
  catch { return 'unknown'; }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const graph = extract(root);
const ports = publishedPorts();
for (const n of graph.nodes) {
  n.description = esc(n.description);
  if (n.kind !== 'app') continue;
  const meta = APPS[n.dir.split('/')[1]];
  if (!meta) console.warn(`warning: ${n.dir} is not in APPS; add its port and host to build.mjs`);
  const [port = null, host = '', note = ''] = meta || [];
  Object.assign(n, { port, host, note, running: ports && port ? ports.has(port) : false });
}
const data = { ...graph, generated: new Date().toISOString(), branch: gitBranch(), runningKnown: ports !== null };

const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = fs.readFileSync(path.join(here, 'template.html'), 'utf8').replace('"__DATA__"', () => json);
fs.writeFileSync(out, html);

const apps = graph.nodes.filter(n => n.kind === 'app');
console.log(`${apps.length} apps, ${graph.nodes.length - apps.length} packages, ${graph.edges.length} edges, ${graph.cycles.length} cycles`);
console.log(`running state: ${ports ? apps.filter(a => a.running).length + ' apps running' : 'unknown (no Docker access)'}`);
console.log(`wrote ${out}`);
