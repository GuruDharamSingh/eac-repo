import type { Area, Capability, Host, HostKey } from '../types';

// packages/blog-server: the shared one-org blog server (blog-guru-dharam, blog-tester). 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md. Three raw SQL writes inside the shared handlers; each is an `internal` row that backs
// the blog rows in apps.blog-guru-dharam.ts and apps.blog-tester.ts.

const SRC = 'packages/blog-server/src/';
const V = '2026-11-16 read packages/blog-server/src/{auth,media,posts}.ts';
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const hs = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: 'blog', path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-blog-server-app-user-ensure',
    area: 'pkg.blog-server',
    label: 'Make sure the blog author has a users row',
    does: 'When a signed-in owner opens the blog editor, inserts a users row with the sign-in id and email if none exists (ON CONFLICT DO NOTHING).',
    class: 'system',
    actors: ['owner'],
    scope: 'person',
    hosts: [
      hs(sq('auth.ts', 'ensureAppUserRecord'), ['(raw INSERT users ON CONFLICT DO NOTHING)'], '/entry', 'no control: runs inside checkBlogOwner and requireBlogOwner on every blog owner page'),
    ],
    status: 'a users row for the sign-in id exists',
    risk: ['none'],
    drift: 'backs blog-tester-post-create and blog-tester-post-create',
    open: 'Only reached after the owner check passes (a configured owner email, owner id, or the allowed role in the blog org). Display name defaults to the email, so an author name can be an address until the profile is edited.',
    verified: V,
  },
  {
    id: 'pkg-blog-server-media-upload',
    area: 'pkg.blog-server',
    label: 'Store an uploaded blog file',
    does: 'The shared upload handler: checks the type and size, writes the file to the blog org’s Nextcloud folder (Public or Private by the form’s visibility), and inserts the media row for the uploader.',
    class: 'internal',
    actors: ['owner', 'guide', 'member'],
    scope: 'org',
    hosts: [
      hs(sq('media.ts', 'POST'), ['(raw INSERT media)', '@elkdonis/nextcloud#uploadFile'], '/entry', 'the drop zone of the post editor (POST /api/media/upload of each blog app)', 'Gate: session plus owner, guide or member of the blog org (media.ts:195-202).'),
    ],
    status: 'a media row for the blog org by the person exists and the file is in Nextcloud',
    risk: ['public'],
    drift: 'backs blog-tester-media-upload and blog-tester-media-upload',
    canonical: 'services uploadOrgFile with validateUploadBuffer',
    open: 'SECURITY: type is chosen from the browser-declared file.type and size from file.size, with no byte sniffing (media.ts:209-226), unlike the other upload doors (validateUploadBuffer). The org is fixed by config (since 2026-11-11), but `visibility` is a form field and chooses Public or Private storage without a role check. The read side (createMediaGetHandler) is well gated: session, path under EAC_Network, canReadMedia per viewer, no-store for Private.',
    verified: V,
  },
  {
    id: 'pkg-blog-server-post-media-attach',
    area: 'pkg.blog-server',
    label: 'Attach uploaded files to a new blog post',
    does: 'After a blog post is created, binds each listed media row of the org to the post and records the author as uploader.',
    class: 'internal',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      hs(sq('posts.ts', 'attachMediaToPost'), ['(raw UPDATE media)'], '/entry', 'the Publish Post button of the editor (media chosen in the editor are listed in the submission)'),
    ],
    status: 'media rows listed in the submission have attached_to_type thread and attached_to_id the new post',
    risk: ['others'],
    drift: 'backs blog-tester-post-create and blog-tester-post-create',
    open: 'SECURITY (minor): posts.ts:179-192 updates media WHERE id AND org_id only. The media ids come from the client submission, so the blog owner can attach (and re-assign uploaded_by of) any media row in the org, including another member’s uploads. The org is fixed and the writer must be the owner, so the reach is the blog’s own org.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
