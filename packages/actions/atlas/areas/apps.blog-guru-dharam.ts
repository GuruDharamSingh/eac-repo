import type { Area, Capability, Host, HostKey } from '../types';

// apps/blog-guru-dharam: a one-org blog on the shared @elkdonis/blog-server (org guru-dharam). 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md. The compose service runs `pnpm dev` (docker-compose.yml:454-493).
// Owner = ownerEmails from env (default the author's address), ownerUserIds, or a guide of org guru-dharam
// (config/blog.ts ownerRoles ['guide']). The same shape is in apps/blog-tester (apps.blog-tester.ts).

const APP = 'blog-guru-dharam';
const SRC = 'apps/blog-guru-dharam/src/';
const V = '2026-11-16 read apps/blog-guru-dharam/src/{app/entry/page.tsx,app/api/auth/signup/route.ts,app/api/media/upload/route.ts,config/blog.ts}, packages/blog-server/src/{auth,posts,media}.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });

const capabilities: Capability[] = [
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
