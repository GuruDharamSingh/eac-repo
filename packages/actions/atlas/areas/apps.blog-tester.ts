import type { Area, Capability, Host, HostKey } from '../types';

// apps/blog-tester: a one-org blog on the shared @elkdonis/blog-server (org elkdonis). 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md. The compose service runs `pnpm dev` (docker-compose.yml:506-538).
// Owner = ownerEmails from env (none set), or a guide or member of org elkdonis (config/blog.ts ownerRoles ['guide','member'])
// The same shape is in apps/blog-guru-dharam (apps.blog-guru-dharam.ts).

const APP = 'blog-tester';
const SRC = 'apps/blog-tester/src/';
const V = '2026-11-16 read apps/blog-tester/src/{app/entry/page.tsx,app/api/auth/signup/route.ts,app/api/media/upload/route.ts,config/blog.ts}, packages/blog-server/src/{auth,posts,media}.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'blog-tester-post-create',
    area: 'blog.posts',
    label: 'Publish a blog post',
    does: 'The blog owner writes a post (title, rich text, tags, optional link and attached media) and publishes it, or saves it as a draft; it can also start a forum thread.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      h(sa('app/entry/page.tsx', 'default/handleSubmit'), ['@elkdonis/blog-server#createBlogPost', '@elkdonis/services#createPost'], '/entry', 'the Publish Post button of the editor (BlogPostEditor from @elkdonis/blog-client) on /entry', 'Gate: checkBlogOwner at render; the action closes over authContext (org and author id are fixed server-side).'),
      {
        "key": "sa:apps/blog-guru-dharam/src/app/entry/page.tsx#default/handleSubmit",
        "service": [
          "@elkdonis/blog-server#createBlogPost",
          "@elkdonis/services#createPost"
        ],
        "address": {
          "app": "blog-guru-dharam",
          "path": "/entry",
          "how": "the Publish Post button of the editor (BlogPostEditor from @elkdonis/blog-client) on /entry"
        },
        "note": "Gate: checkBlogOwner at render; the action closes over authContext (org and author id are fixed server-side)."
      },
    ],
    entry: null,
    status: "a threads row of kind post in org elkdonis exists with the title",
    risk: ['public'],
    confirm: { text: 'Publish “{title}” on the blog? Everyone who visits the site can read it at once.', status: 'draft', wave: 6 },
    inputs: 'title, body, excerpt, status, link, tags, createForumThread, forumThreadTitle, metadata, media',
    drift: "Another post-creation path (createBlogPost over createPost) next to createThread and the forum createTopic; blog-guru-dharam has an identical copy for org guru-dharam.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (blog-tester, blog-guru-dharam). Differences by app:\n- blog-guru-dharam (was blog-guru-dharam-post-create): Another post-creation path (createBlogPost over createPost) next to createThread and the forum createTopic; blog-tester has an identical copy for org elkdonis.",
    canonical: 'one post-creation service (createThread)',
    open: "SECURITY (minor): the inline server action (entry/page.tsx:30-40) does not re-check the owner; it relies on the closure being encrypted per build, which is Next’s model, but the action accepts the whole BlogPostSubmission from the client including `status` and free `metadata` (spread into the thread metadata, posts.ts:~125). The body is sanitised by createPost (sanitizePostBody). posts.ts attachMediaToPost (:179-192) UPDATEs media by id and org only: an owner can attach (and re-assign uploaded_by of) any media row of the org, not just their own uploads. config/blog.ts:22-24 sets no ownerEmails and ownerRoles guide and member, so EVERY member of the elkdonis org (the central hub org, not just guides) can publish a PUBLIC post here; the comment says it is a test app, but the compose service is live on the network.\nblog-guru-dharam (blog-guru-dharam-post-create): SECURITY (minor): the inline server action (entry/page.tsx:30-40) does not re-check the owner; it relies on the closure being encrypted per build, which is Next’s model, but the action accepts the whole BlogPostSubmission from the client including `status` and free `metadata` (spread into the thread metadata, posts.ts:~125). The body is sanitised by createPost (sanitizePostBody). posts.ts attachMediaToPost (:179-192) UPDATEs media by id and org only: an owner can attach (and re-assign uploaded_by of) any media row of the org, not just their own uploads. Owner check reads ownerEmails from env with a hard-coded default address (config/blog.ts:4-5).",
    verified: V,
  },
  {
    id: 'blog-tester-media-upload',
    area: 'blog.posts',
    label: 'Upload a picture or file for a blog post',
    does: 'A signed-in owner, guide or member of org elkdonis uploads one image, audio, video or document into the org\u2019s Nextcloud folder; it is recorded in media.',
    class: 'person',
    actors: ['owner', 'guide', 'member'],
    scope: 'org',
    hosts: [
      h(api('app/api/media/upload/route.ts', 'POST'), ['@elkdonis/blog-server#createMediaUploadHandler'], '/entry', 'the drop zone inside the post editor (uploadEndpoint /api/media/upload in BlogPostEditor)', 'Gate: session plus a role of owner, guide or member in config.orgId (the shared handler, media.ts:195-202). Org comes from config, never the form.'),
      {
        "key": "api:apps/blog-guru-dharam/src/app/api/media/upload/route.ts#POST",
        "service": [
          "@elkdonis/blog-server#createMediaUploadHandler"
        ],
        "address": {
          "app": "blog-guru-dharam",
          "path": "/entry",
          "how": "the drop zone inside the post editor (uploadEndpoint /api/media/upload in BlogPostEditor)"
        },
        "note": "Gate: session plus a role of owner, guide or member in config.orgId (the shared handler, media.ts:195-202). Org comes from config, never the form."
      },
    ],
    entry: null,
    status: 'a media row for org elkdonis by the person exists and the file is in Nextcloud',
    risk: ['public'],
    confirm: { text: 'Upload “{file}” to the blog\u2019s media folder? It can be shown on the blog.', status: 'draft', wave: 6 },
    inputs: 'file, visibility',
    drift: "Shared handler with apps/blog-tester. Other apps upload through services uploadOrgFile with validateUploadBuffer (sniffed bytes); this one trusts the browser MIME type.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (blog-tester, blog-guru-dharam). Differences by app:\n- blog-guru-dharam (was blog-guru-dharam-media-upload): Shared handler with apps/blog-tester. Other apps upload through services uploadOrgFile with validateUploadBuffer (sniffed bytes); this one trusts the browser MIME type.\nDirection (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.",
    canonical: 'services uploadOrgFile with validateUploadBuffer',
    open: 'SECURITY: packages/blog-server/src/media.ts:209-226 chooses the rule from `file.type` (the browser\u2019s declared type) and the size from file.size; bytes are not sniffed. The upload gate is wider than the post gate (any member may upload; only guides may publish). `visibility` comes from the form (:203) and picks the Nextcloud folder (Public or Private) without a role check for Public.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
