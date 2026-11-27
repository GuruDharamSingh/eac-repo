import type { Area, Capability, Host, HostKey } from '../types';

// ifac sign-in, own profile (center routes), image upload. Round 2 (2026-11-16).

const V =
  '2026-11-16 read apps/ifac/src/app/api/{auth/login,auth/logout,auth/signup,upload,signup,pulse,center/avatar,center/connections,center/profile}/route.ts, lib/auth.ts, lib/data.ts canManageIfac; diffed against hidden-enneagram copies';
const A = 'ifac';
const AREA = 'ifac.account';
const k = (kind: 'sa' | 'api' | 'sql', p: string, s: string) => `${kind}:apps/ifac/src/${p}#${s}` as HostKey;
const api = (p: string, m: string) => k('api', `app/api/${p}/route.ts`, m);
const h = (key: HostKey, path: string, how: string, service: string[], note?: string, caseId?: string): Host => ({
  key,
  service,
  address: { app: A, path, how },
  ...(note ? { note } : {}),
  ...(caseId ? { case: caseId } : {}),
});
const twin = (key: HostKey, of: HostKey): Host => ({ key, note: `sql twin of ${of}` });
const cf = (text: string) => ({ text, status: 'draft' as const, wave: 6 });
const mk = (c: Omit<Capability, 'verified' | 'area'>): Capability => ({ area: AREA, verified: V, ...c });

const capabilities: Capability[] = [
  mk({
    id: 'ifac-image-upload',
    label: 'Upload a picture to a member page',
    does: "Uploads an image (up to 25 MB, bytes sniffed) into a member's Nextcloud Media/Images folder, records it, and for the gallery target adds it to their ifac portfolio. Members do it for themselves; managers can do it for any member or for a name with no member yet.",
    class: 'person',
    actors: ['member', 'guide', 'owner', 'admin'],
    scope: 'person',
    hosts: [
      h(api('upload', 'POST'), '/manage/directory', 'upload field in the gallery editor and the directory manager (components/gallery-editor.tsx, components/writing-views.tsx, components/manage/directory-manager.tsx)', ['(getServerSession; memberSlug must match the viewer, or canManageIfac)', '@elkdonis/nextcloud#ensureUserFolder', '@elkdonis/services#uploadFile', '@elkdonis/services#appendOrgPortfolio', '@elkdonis/utils#validateUploadBuffer']),
      twin(k('sql', 'app/api/upload/route.ts', 'POST'), api('upload', 'POST')),
    ],
    entry: null,
    status: 'a media row for ifac with the Nextcloud path exists; the portfolio lists it when target is gallery',
    risk: ['public'],
    confirm: cf('Add “{file}” to {person}’s pictures on {org}? Visitors can see it on their page.'),
    inputs: 'file, memberSlug, target gallery|avatar|file, title',
    drift: 'Third upload family: artdirect api/upload (canEditProfile, profile portfolio), hidden-enneagram api/upload (editor, org tree, audio), danamccool api/media/upload (editor, site owner folder). ifac has the manager override. It no longer calls markArtist (2026-11-24: an upload does not make anyone an artist of the collective). The "avatar" and "file" targets only skip the portfolio append.',
    canonical: 'services uploadUserFile (one upload path) with validateUploadBuffer and a per-app authorizer.',
    open: 'SECURITY: apps/ifac/src/app/api/upload/route.ts:71-98 when memberSlug matches no member a canManageIfac caller (allowlisted email, no role) can still upload; the slug is then used as the Nextcloud folder name (ensureUserFolder(getAdminClient(), memberSlug)) with no pattern check here (editors only; traversal handling lives in ensureUserFolder, not read). Gate is canManageIfac (lead #4).',
  }),
];

export default {
  capabilities,
  ignored: [
    { key: api('signup', 'POST'), why: 'Dead: no caller found in apps/ifac (no fetch to /api/signup, no #signup section in components or app). SECURITY: still a live unauthenticated endpoint: apps/ifac/src/app/api/signup/route.ts:28-53 inserts a contacts row and emails info@ifacgroup.com (NEXT_PUBLIC_IFAC_OWNER_EMAIL) per request with no rate limit, captcha or honeypot (danamccool contact has all three).' },
    { key: k('sql', 'app/api/signup/route.ts', 'POST'), why: 'twin of api:apps/ifac/src/app/api/signup/route.ts#POST (dead route)' },
  ],
} satisfies Area;
