import type { Area, Capability, Host, HostKey } from '../types';

// apps/elkdonis-arts-collective: the Elkdonis landing site (org elkdonis; compose runs it with `pnpm dev`).
// 2026-11-16, round 3. Conventions: atlas/JOURNAL.md. Its /admin page edits the landing page only; the NETWORK
// admin app is apps/admin. The gate here is its OWN: a session whose email is in EAC_ADMIN_EMAILS (or ADMIN_EMAIL),
// or users.is_admin.

const APP = 'elkdonis-arts-collective';
const SRC = 'apps/elkdonis-arts-collective/src/app/api/';
const V = '2026-11-16 read apps/elkdonis-arts-collective/src/app/api/{admin/media-gallery,admin/media-gallery/upload,admin/site-config,auth/signup,contact,inquiries}/route.ts, app/admin/page.tsx imports';
const api = (p: string, m: string): HostKey => `api:${SRC}${p}/route.ts#${m}` as HostKey;
const sq = (p: string, m: string): HostKey => `sql:${SRC}${p}/route.ts#${m}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, note: `sql twin of ${of}` });
const ADMIN = 'Gate: assertAdmin (route file): session email in EAC_ADMIN_EMAILS / ADMIN_EMAIL, or users.is_admin; 401 otherwise.';

const capabilities: Capability[] = [
  {
    id: 'eac-site-config-save',
    area: 'eac-site.admin',
    label: 'Edit the landing page content',
    does: 'The site admin saves one named block of landing-page content (fundraising goal, featured artist, initiative, featured events, image spaces, work question and so on) as JSON in site_config for org elkdonis.',
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      h(api('admin/site-config', 'PATCH'), ['(raw INSERT ... ON CONFLICT site_config)'], '/admin', 'the Save buttons of the section editors on app/admin/page.tsx (the fetch at :116); the landing components only read the keys', ADMIN),
      twin(sq('admin/site-config', 'PATCH'), api('admin/site-config', 'PATCH')),
    ],
    status: 'the site_config row (elkdonis, key) holds the saved value',
    risk: ['public'],
    inputs: 'key, value (any JSON)',
    drift: 'Another config door beside the org sites’ section saves (orgapps.cms:site-section-copy-save) and page-builder savePage; it stores raw JSON by free-text key, with no sanitising.',
    canonical: 'one site_config writer with an allow-list of keys (see pkg-page-builder-page-save for the validated one)',
    open: 'SECURITY: admin/site-config/route.ts:43-53 accepts any `key` string and any JSON `value` and stores it unsanitised; five keys are served to the public without sign-in (GET :23-29), so an HTML value would be rendered by the matching component (whether each component escapes was not read). SECURITY: the gate (:6-17) trusts session.user.email against an env list: GoTrue autoconfirms signups (auth-server api-routes.ts:20-38), so if an address in EAC_ADMIN_EMAILS has no account yet, whoever signs up with it becomes an editor of the landing page. The compare is case-sensitive. The NETWORK admin gate is global is_admin; this one is a different rule (decide: use is_admin only).',
    verified: V,
  },
  {
    id: 'eac-site-media-upload',
    area: 'eac-site.admin',
    label: 'Upload a picture to the shared Nextcloud media folder',
    does: 'The site admin uploads one image (jpg, png, webp, gif, avif; 60 MB) into a folder under EAC_Network in Nextcloud with the service account, overwriting a file of the same name.',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      h(api('admin/media-gallery/upload', 'POST'), ['@elkdonis/nextcloud#getAdminClient'], '/admin', 'the upload control of the media gallery on app/admin/page.tsx (the fetch at :205)', ADMIN + ' Path must be EAC_Network or below, no "..".'),
    ],
    status: 'unverifiable: the image exists at the path in Nextcloud',
    risk: ['public'],
    inputs: 'file, path',
    drift: 'The best-validated upload in the repo: extension, declared MIME and a byte-signature check must all agree (:51-64, :156-166). Compare apps/admin nextcloud/upload (admin-nextcloud-upload), which has none.',
    canonical: 'validateUploadBuffer (utils) behind uploadOrgFile; this route has its own copy of the signature table',
    open: 'Overwrite is on and the target folder is any folder under EAC_Network, including another organisation’s Private folder. Admin only.',
    verified: V,
  },
  {
    id: 'eac-site-inquiry-record',
    area: 'eac-site.visitor',
    label: 'Answer the landing page’s question',
    does: 'A visitor answers one of the landing page’s prompts; the answer (2 to 2000 characters), the prompt, a hashed IP and the user agent are stored. Nobody is emailed.',
    class: 'internal',
    actors: ['visitor'],
    scope: 'org',
    hosts: [
      h(api('inquiries', 'POST'), ['(raw INSERT landing_inquiries)'], '/', 'the question box of the landing page (components/CurrentWorkQuestion.tsx)', 'Public.'),
      twin(sq('inquiries', 'POST'), api('inquiries', 'POST')),
    ],
    status: 'a landing_inquiries row with the prompt, answer and ip_hash exists',
    risk: ['none'],
    inputs: 'prompt, answer',
    drift: 'Single copy.',
    open: 'SECURITY (minor): inquiries/route.ts:28-35 hashes the first x-forwarded-for hop with a salt that defaults to the literal "elkdonis" (EAC_IP_HASH_SALT unset gives a guessable hash of any IPv4), and there is no rate limit, so anyone can fill the table. The prompt is client-supplied (280 chars), not checked against the real prompts.',
    verified: V,
  },
];

// The directory listing is a read served through POST (the verb carries the path in the body).
const ignored: Area['ignored'] = [
  { key: api('admin/media-gallery', 'POST'), why: 'A read exposed as POST: lists a Nextcloud directory under EAC_Network for the admin media picker; writes nothing.' },
];

export default { capabilities, ignored } satisfies Area;
