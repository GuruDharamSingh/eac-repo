import type { Area, Capability, Host, HostKey } from '../types';

// elastrocal, the last two hosts (round 3, 2026-11-16; agent G left them for E): the member profile editor and the
// service booking. Conventions: atlas/JOURNAL.md. Both are copies of families mapped elsewhere.

const APP = 'elastrocal';
const SRC = 'apps/elastrocal/src/';
const V = '2026-11-16 read apps/elastrocal/src/{app/hub/profile/actions.ts,app/hub/profile/page.tsx,app/services/[slug]/actions.ts,app/api/auth/signup/route.ts,lib/auth.ts}';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });

const capabilities: Capability[] = [
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
