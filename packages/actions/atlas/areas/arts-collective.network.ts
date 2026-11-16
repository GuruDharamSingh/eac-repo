// Atlas area file (2026-11-16, agent C): arts-collective network-level things a person does outside
// the hub, studio, channel and learn pages: sign-up and account, profile and presence (the Center),
// connections, pseudonyms, personal files, the artist and business wizards, org creation and
// address confirmation, directory and vetting admin, org email, bookings by token, and the system
// endpoints (webhooks, deletion callbacks, MCP, registry door).
import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- network.account ----------------
  {
    id: 'create-account',
    area: 'network.account',
    label: 'Create an account',
    does: 'A visitor signs up with email and password (and a bot check when configured); a welcome email is sent.',
    class: 'person',
    actors: ['visitor'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/auth/signup/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/login',
          anchor: 'create-account',
          how: 'The Create account tab of the sign-in form (components/login-form.tsx)',
        },
        service: ['auth-server#handleSignup'],
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/login",
          "how": "the Create account tab of components/login-form.tsx, posting to /api/auth/signup"
        }
      },
      {
        "key": "api:apps/blog-guru-dharam/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "blog-guru-dharam",
          "path": "/login",
          "how": "the sign-up form of the blog’s sign-in page"
        },
        "note": "Public; the shared handler."
      },
      {
        "key": "api:apps/blog-tester/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "blog-tester",
          "path": "/login",
          "how": "the sign-up form of the blog’s sign-in page"
        },
        "note": "Public; the shared handler."
      },
      {
        "key": "api:apps/elkdonis-arts-collective/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "elkdonis-arts-collective",
          "path": "/login",
          "how": "the sign-up form of the landing site’s sign-in page"
        },
        "note": "Public; the shared handler."
      },
      {
        "key": "api:apps/elktours/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "elktours",
          "path": "/login",
          "how": "the sign-up form on the login page (app/login)"
        }
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/login",
          "how": "the Create account tab of components/login-form.tsx"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "innergathering",
          "path": "/login",
          "how": "the sign-up tab of the login form (components/login-form.tsx, with the Turnstile field from cms-ui)"
        }
      },
      {
        "key": "api:apps/katie-the-potter/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "sunjay",
          "path": "/login",
          "how": "the Create account tab of components/login-form.tsx, posting to /api/auth/signup"
        }
      },
      {
        "key": "api:apps/art-auction/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "art-auction",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability signup-account in arts-collective.network lists only the arts-collective copy); add this host to it in the consolidation pass."
      },
      {
        "key": "api:apps/artdirect/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "artdirect",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability create-account in arts-collective.network lists only the arts-collective copy). Lead: add this host to create-account."
      },
      {
        "key": "api:apps/danamccool/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "danamccool",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability create-account in arts-collective.network lists only the arts-collective copy). Lead: add this host to create-account."
      },
      {
        "key": "api:apps/elastrocal/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "elastrocal",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability signup-account in arts-collective.network lists only the arts-collective copy); add this host there in the consolidation pass."
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability create-account in arts-collective.network lists only the arts-collective copy). Lead: add this host to create-account."
      },
      {
        "key": "api:apps/ifac/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "ifac",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability create-account in arts-collective.network lists only the arts-collective copy); differs only by defaultOrgs: [ifac as viewer]. Lead: add this host to create-account."
      },
      {
        "key": "api:apps/pigeonshoot/src/app/api/auth/signup/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleSignup"
        ],
        "address": {
          "app": "pigeonshoot",
          "path": "/login",
          "how": "the Create account tab of the sign-in form"
        },
        "note": "Moved from ignored in consolidation 2. Copy of the shared handleSignup route (capability signup-account in arts-collective.network lists only the arts-collective copy); add this host there in the consolidation pass."
      },
    ],
    entry: null,
    status: 'a users row exists for the email',
    risk: ['emails'],
    confirm: {
      text: 'Create an account for {email}? We send a welcome email to that address.',
      status: 'draft',
      wave: 2,
    },
    drift: "All 19 apps with sign-in mount the same handleSignup route; they differ only in which org’s welcome copy and terms they name.\nMerged 2026-11-16 (consolidation 2): 11 rows, 11 apps (arts-collective, admin, amrit-canada, blog-guru-dharam, blog-tester, elkdonis-arts-collective, elktours, fourthwayBookreaders, innergathering, katie-the-potter, sunjay). Differences by app:\n- admin (was admin-signup): no defaultOrgs (inner_group viewer), and it marks every contact for that email joined and linked.\n- amrit-canada (was amrit-signup): wraps handleSignup with defaultOrgs [{ org: amrit-canada, role: viewer }] (the arts-collective copy takes the shared default, the network orgs). Same file in sunjay (apps.sunjay.*.ts: create-account); identical except a comment line.\n- blog-guru-dharam (was blog-guru-dharam-signup-create): none (bare wrapper around handleSignup, so the new account joins inner_group, not the blog’s own org).\n- blog-tester (was blog-tester-signup-create): none (bare wrapper around handleSignup, so the new account joins inner_group, not the blog’s own org).\n- elkdonis-arts-collective (was eac-site-signup-create): none (bare wrapper around handleSignup, default orgs).\n- elktours (was elktours-signup-create): wraps handleSignup with defaultOrgs [{ elktours, viewer }] (the shared default joins the network orgs); elktours explains why it cannot re-export the bare handler.\n- fourthwayBookreaders (was fourthway-signup): defaultOrgs viewer for this org. Same as create-account and amrit-signup.\n- innergathering (was ig-signup-create): this app passes defaultOrgs [{ id: orgId, role: viewer }] so a new person follows inner_group at once, arts-collective passes defaultOrgs [] (no membership, developer decision 2026-10-29). The code comment in this route still says \"scoping to amrit_canada\" (copy-paste, the code uses siteConfig.orgId).\n- katie-the-potter (was katie-signup): same as sunjay-signup. The route comment still says \"member here\" but the code passes viewer (stale comment).\n- sunjay (was sunjay-signup): wraps handleSignup with defaultOrgs [{ org: sunjay, role: viewer }] (the arts-collective copy takes the shared default, the network orgs). Same file in amrit-canada (apps.amrit-canada.*.ts: create-account); identical except a comment line.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    canonical: 'auth-server handleSignup (already shared); keep one route per app, no custom copies',
    open: "A visitor is not in the dock yet; the dock probably never runs this one, only points at the form.\nadmin (admin-signup): SECURITY: app/api/auth/signup/route.ts:26-31 updates contacts WHERE email = typed AND status != joined with the new user id and no org filter. GoTrue autoconfirm is on (api-routes.ts:20-38 comment), so a person can sign up with an address they do not own and have that address’s contact history attached to their account. The admin app has no sign-up form, so this route is a leftover door that only strangers use; any account, however made, gets the admin shell (see admin-meeting-create). Remove the route.\namrit-canada (amrit-signup): SECURITY: Security #2 chain. This route makes every new account a viewer row (route.ts:21 defaultOrgs viewer), and lib/writing-room-actions.ts:43 plus app/write/page.tsx:20 admit any viewer (isAffiliate = any role) to create and publish writing under the org. So a signup alone, or one tap on /api/center/follow, is enough to publish in the writing room. This route itself has no flaw; it is the feeder. A role gate (member or above) in the writing room closes it.\nblog-guru-dharam (blog-guru-dharam-signup-create): A blog signup becomes a viewer of the inner group, not of guru-dharam: a reader cannot be a reader of this blog’s org. Pass defaultOrgs if followers are wanted.\nblog-tester (blog-tester-signup-create): A blog signup becomes a viewer of the inner group, not of elkdonis: a reader cannot be a reader of this blog’s org. Pass defaultOrgs if followers are wanted.\nfourthwayBookreaders (fourthway-signup): A viewer is affiliate here and may comment, RSVP to sittings and start threads in a circle (getApiAffiliate). That is the owner decision of 2026-09-26, so a signup alone opens the circle discussion; compare amrit-canada Security #2.\ninnergathering (ig-signup-create): Is \"a signup follows inner_group\" intended here, when the network default is no membership? Stale comment names amrit_canada.\nkatie-the-potter (katie-signup): SECURITY (config): the session doc says TURNSTILE_SECRET_KEY is empty on this host so bot tokens are not verified server-side (open item 1). Read from the doc, not re-verified in the container.\nsunjay (sunjay-signup): Every signup becomes a viewer row here (a follower). Not a flaw in this route; see how amrit-canada uses the same viewer role (create-account).",
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
    inputs: "email, password, name",
  },
  {
    id: 'accept-terms',
    area: 'network.account',
    label: 'Accept the network terms',
    does: 'Records that the person agreed to the network terms.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/terms/accept/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/hub',
          anchor: 'accept-terms',
          how: 'The Accept button in the terms notice (components/hub/TermsNotice.tsx)',
        },
        service: ['acceptNetworkTerms'],
      },
    ],
    entry: null,
    status: 'hasAcceptedNetworkTerms returns true for the person',
    risk: ['none'],
    confirm: { text: 'Accept the network terms? We note the date you agreed.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'link-cloud-sign-in',
    area: 'network.account',
    label: 'Link your cloud sign-in',
    does: 'Creates or links the person’s Nextcloud account so their folders follow them.',
    class: 'admin',
    actors: ['admin'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/auth/provision-nextcloud/route.ts#POST',
        address: {
          app: 'admin',
          path: '/nextcloud',
          anchor: 'link-cloud-sign-in',
          how: 'Called by a network admin from the central admin app (apps/admin, :3000); the Nextcloud page there is the likely home. No component calls the route yet.',
        },
        service: ['auth-server#getServerSession', 'handleUserProvisioning'],
      },
    ],
    entry: 'cloud',
    status: 'users.nextcloud_synced is true for the person',
    risk: ['none'],
    open: 'Called by a network admin from the central admin app (Justin, 2026-11-16). The cloud entry’s person-facing address is still open.',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'request-data-deletion',
    area: 'network.account',
    label: 'Ask for your data to be deleted',
    does: 'A visitor sends a deletion request; the network inbox is emailed and the request is stored for an admin to verify and complete.',
    class: 'person',
    actors: [
      "visitor",
      "person"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/data/delete/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/data',
          anchor: 'request-data-deletion',
          how: 'The deletion request form (packages/cms-ui/src/data-policy/DeletionRequestForm.tsx)',
        },
        service: ['createDeletionRequestHandler', 'email#sendEmail'],
      },
      {
        "key": "api:apps/innergathering/src/app/api/data/delete/route.ts#POST",
        "service": [
          "@elkdonis/services#createDeletionRequestHandler",
          "@elkdonis/email#sendEmail"
        ],
        "address": {
          "app": "innergathering",
          "path": "/data/delete",
          "how": "the deletion request form (packages/cms-ui/src/data-policy/DeletionRequestForm.tsx)"
        }
      },
    ],
    entry: null,
    status: 'a data_deletion_requests row for the email, then resolved by an admin',
    risk: ['emails'],
    confirm: {
      text: 'Ask us to delete your data for {email}? An admin checks it is you, then removes your account.',
      status: 'draft',
      wave: 2,
    },
    drift: "innergathering has an identical 26-line copy; both use createDeletionRequestHandler.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (arts-collective, innergathering). Differences by app:\n- innergathering (was ig-data-deletion-ask): 14 diff lines, the notify email body is built here by hand.",
    canonical: 'createDeletionRequestHandler (shared); mount only',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
    open: "innergathering (ig-data-deletion-ask): SECURITY (mild): the notification email is hand-built HTML that inserts request.email without escaping and escapes only \"<\" in the message (data/delete/route.ts:15-18). The shared handler checks the email with /^[^s@]+@[^s@]+.[^s@]+$/ (services/data-deletion.ts:~157), which forbids spaces but allows \"<\" and \">\", so markup without spaces can reach the notify inbox as HTML. The route is public with no rate limit: each call files a request row and sends one email.",
  },
  // ---------------- network.files ----------------
  {
    id: 'upload-my-file',
    area: 'network.files',
    label: 'Upload a file to your files',
    does: 'Uploads a file (checked by type and size) into the person’s own Nextcloud folder.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/my-files/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/hub',
          anchor: 'upload-my-file',
          how: 'The upload control in the Files card (packages/cms-ui/src/files/FilesCard.tsx, MediaBrowser.tsx)',
        },
        service: ['uploadUserFile', 'utils#validateUploadBuffer'],
      },
    ],
    entry: null,
    status: 'listing of the person’s folder shows the file',
    risk: ['none'],
    confirm: {
      text: 'Upload “{file}” to your files? Only you can see it until you use it on a page.',
      status: 'draft',
      wave: 2,
    },
    drift: 'Three upload routes (my-files, org files, upload/image) share uploadUserFile with different rules; see org-file-upload.',
    canonical: 'one upload route with a target of person or org',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'delete-my-file',
    area: 'network.files',
    label: 'Delete one of your files',
    does: 'Deletes a file from the person’s own folder.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/my-files/route.ts#DELETE',
        address: {
          app: 'arts-collective',
          path: '/hub',
          anchor: 'delete-my-file',
          how: 'The delete control in the Files card (FilesCard.tsx)',
        },
        service: ['deleteUserFile'],
      },
    ],
    entry: null,
    status: 'listing of the person’s folder no longer shows the file',
    risk: ['irreversible'],
    confirm: { text: 'Delete “{file}”? Pages that use it lose it. This cannot be undone.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'upload-image',
    area: 'network.files',
    label: 'Upload an image from a composer',
    does: 'Image upload used by the post, workshop and cover-image composers; allowed for admins and org owners, guides and members.',
    class: 'internal',
    actors: ['owner', 'guide', 'member', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/upload/image/route.ts#POST',
        service: ['uploadUserFile', 'hasOrgRole'],
      },
    ],
    status: 'unverifiable: a file in Nextcloud',
    risk: ['none'],
    drift: 'See my-file-upload.',
    canonical: 'one upload route',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  // ---------------- network.wizard ----------------
  {
    id: 'save-artist-wizard',
    area: 'network.wizard',
    label: 'Save your artist profile questionnaire as you go',
    does: 'Saves answers from the artist wizard to the person’s artist_profiles row without finishing it.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/wizard/save/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/wizard',
          anchor: 'save-artist-wizard',
          how: 'The Save and exit control of the artist wizard (components/wizard/ArtistProfileWizard.tsx)',
        },
        service: ['gainSpace'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/wizard/save/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    entry: null,
    status: 'artist_profiles has a row for the person with some answers',
    risk: ['none'],
    confirm: { text: 'Save your answers so far? You can come back and finish later.', status: 'draft', wave: 2 },
    drift: 'Raw INSERT/UPDATE of artist_profiles in four routes (wizard save and submit, business save and submit) plus startOver; no service owns the table. Each calls gainSpace first, so merely saving takes the person’s space.',
    canonical: 'a services artistProfile module (save, submit, reset) used by all five',
    open: 'Should saving a draft call gainSpace (folder, directory membership)? It does today.',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'submit-artist-wizard',
    area: 'network.wizard',
    label: 'Finish your artist profile questionnaire',
    does: 'Validates and stores the full artist wizard answers; the person is now in the artist directory’s queue for review.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/wizard/submit/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/wizard',
          anchor: 'submit-artist-wizard',
          how: 'The Submit button on the last step (ArtistProfileWizard.tsx)',
        },
        service: ['gainSpace'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/wizard/submit/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    entry: null,
    status: 'artist_profiles has submitted_at set for the person',
    risk: ['public'],
    confirm: {
      text: 'Send your answers to the collective? We use them to set up your artist page and directory listing.',
      status: 'draft',
      wave: 2,
    },
    drift: 'See artist-wizard-save.',
    canonical: 'services artistProfile.submit',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'save-business-wizard',
    area: 'network.wizard',
    label: 'Save your business questionnaire as you go',
    does: 'Saves partial answers of the business wizard (biz_* columns of artist_profiles).',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/wizard/business/save/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/wizard/business',
          anchor: 'save-business-wizard',
          how: 'Save and exit in the business wizard (components/wizard/use-business-wizard-save-exit.ts)',
        },
        service: ['gainSpace'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/wizard/business/save/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    entry: null,
    status: 'artist_profiles.biz_* has values for the person',
    risk: ['none'],
    confirm: {
      text: 'Save your business answers so far? You can come back and finish later.',
      status: 'draft',
      wave: 2,
    },
    drift: 'See artist-wizard-save.',
    canonical: 'services artistProfile module',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'submit-business-wizard',
    area: 'network.wizard',
    label: 'Finish your business questionnaire',
    does: 'Stores the full business wizard answers.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/wizard/business/submit/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/wizard/business',
          anchor: 'submit-business-wizard',
          how: 'The Submit button on the last business step (components/wizard/steps/business/BizStep5Resources.tsx)',
        },
        service: ['gainSpace'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/wizard/business/submit/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    entry: null,
    status: 'artist_profiles.biz_* complete for the person',
    risk: ['none'],
    confirm: {
      text: 'Send your business answers to the collective? They help us suggest the right tools and support.',
      status: 'draft',
      wave: 2,
    },
    drift: 'See artist-wizard-save.',
    canonical: 'services artistProfile module',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'restart-wizard',
    area: 'network.wizard',
    label: 'Clear your questionnaire and start over',
    does: 'Blanks every artist-wizard answer on the person’s profile row and returns to the first step.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/wizard/confirm/actions.ts#startOverAction',
        address: {
          app: 'arts-collective',
          path: '/wizard/confirm',
          anchor: 'restart-wizard',
          how: 'The Start over button on the confirm page (app/wizard/confirm)',
        },
      },
      {
        key: 'sql:apps/arts-collective/src/app/wizard/confirm/actions.ts#startOverAction',
        note: 'raw SQL twin of the host above',
      },
    ],
    entry: null,
    status: 'artist_profiles answers are all empty for the person',
    risk: ['irreversible'],
    confirm: {
      text: 'Clear all your answers and start the questionnaire again? What you wrote is deleted. This cannot be undone.',
      status: 'draft',
      wave: 2,
    },
    drift: 'See artist-wizard-save.',
    canonical: 'services artistProfile.reset',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  // ---------------- network.bookings ----------------
  {
    id: 'confirm-booking-time-as-buyer',
    area: 'network.bookings',
    label: 'Confirm a booking time (buyer)',
    does: 'The buyer opens their private link and picks one of the proposed times.',
    class: 'person',
    actors: ['visitor'],
    scope: 'other',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/bookings/[token]/actions.ts#confirmAsBuyer',
        address: {
          app: 'arts-collective',
          path: '/bookings/{token}',
          anchor: 'confirm-booking-time-as-buyer',
          how: 'The time buttons on the buyer’s booking page (app/bookings/[token])',
        },
        service: ['commerce#buyerConfirmTime'],
      },
    ],
    entry: null,
    status: 'the booking shows the chosen time as confirmed',
    risk: ['money', 'others', 'emails'],
    confirm: {
      text: 'Confirm {when} for “{title}”? {person} is told, and the time is held for you. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Seller side: arts-collective.hub:confirm-booking-time.',
    canonical: 'commerce/server booking functions, with one action file per host',
    open: 'Justin, 2026-11-16: confirming is meant to take payment, so this is money. The dock only links to the checkout and never runs it; the step ticks itself from the payment status.',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'propose-booking-times-as-buyer',
    area: 'network.bookings',
    label: 'Suggest other times (buyer)',
    does: 'The buyer proposes other times with a message to the seller.',
    class: 'person',
    actors: ['visitor'],
    scope: 'other',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/bookings/[token]/actions.ts#proposeAsBuyer',
        address: {
          app: 'arts-collective',
          path: '/bookings/{token}',
          anchor: 'propose-booking-times-as-buyer',
          how: 'The propose other times form on the buyer’s booking page (app/bookings/[token])',
        },
        service: ['commerce#buyerProposeTimes'],
      },
    ],
    entry: null,
    status: 'the booking shows the buyer’s proposed times',
    risk: ['emails'],
    confirm: { text: 'Send these times to {person}? They get your message and can pick one.', status: 'draft', wave: 2 },
    drift: 'Seller side of the same flow is agent B’s app/hub/bookings/actions.ts (propose, confirm, cancel); both call commerce/server.',
    canonical: 'commerce/server booking functions, with one action file per host',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  // ---------------- network.system ----------------
  {
    id: 'run-registry-action',
    area: 'network.system',
    label: 'Run a registry step as the signed-in person',
    does: 'The doors into the action registry: the HTTP route, the app server action, and the dock-only server action. Each checks sign-in, resolves the organisation and performs one registry step, writing an audit row.',
    class: 'system',
    actors: ['person'],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/actions/[id]/route.ts#POST',
        service: ['actions#actionHttp'],
        note: 'HTTP door /api/actions/{id}.',
      },
      {
        key: 'sa:apps/arts-collective/src/lib/actions/run.ts#runAction',
        service: ['performAction', 'actionOrgId'],
        note: 'Called by TaskBox.tsx, the journey wrappers in lib/cms/journey-actions.ts and runDockAction. The server-action door.',
      },
      {
        key: 'sa:apps/arts-collective/src/lib/actions/dock-actions.ts#runDockAction',
        service: ['isDockAction', 'runAction'],
        note: 'Wired in app/layout.tsx as <Dock run={runDockAction} />. The dock-only door (allow-list of dock-offered steps).',
      },
    ],
    status: 'unverifiable: doors; each registry step has its own check',
    risk: ['public', 'others'],
    drift: 'Three doors (api/actions/[id], lib/actions/run.ts runAction, lib/actions/dock-actions.ts runDockAction) plus the tenant hub door, which is split into cases (see org-person-role-set and the org-arrival, post-from-other-site, submission and review rows). Only 7 app files go through runAction; the rest of the app writes through its own actions.',
    canonical: 'one door in packages/actions/server, mounted per host',
    open: 'P2 puts a confirm card (the wording drafted in these files) in front of the dock door. Per-step gates live in packages/actions server/run.ts.',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'serve-mcp',
    area: 'network.system',
    label: 'The MCP endpoint',
    does: 'POST, GET and DELETE for the MCP server (/api/mcp). Tools reach the registry; nothing here writes directly.',
    class: 'system',
    actors: ['person'],
    scope: 'other',
    hosts: [
      { key: 'api:apps/arts-collective/src/app/api/mcp/route.ts#POST' },
      { key: 'api:apps/arts-collective/src/app/api/mcp/route.ts#DELETE' },
    ],
    status: 'unverifiable: a protocol endpoint',
    risk: ['none'],
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'receive-meta-events',
    area: 'network.system',
    label: 'Meta, Instagram and Threads webhooks and deletion callbacks',
    does: 'Receives Meta platform events and the three data-deletion callbacks, and removes the connection data Meta asks us to.',
    class: 'system',
    actors: ['system'],
    scope: 'other',
    hosts: [
      { key: 'api:apps/arts-collective/src/app/api/meta/webhook/route.ts#POST' },
      { key: 'api:apps/arts-collective/src/app/api/instagram/webhook/route.ts#POST' },
      { key: 'api:apps/arts-collective/src/app/api/threads/webhook/route.ts#POST' },
      {
        key: 'api:apps/arts-collective/src/app/api/meta/data-deletion/route.ts#POST',
        service: ['fulfilMetaDeletion'],
      },
      {
        key: 'api:apps/arts-collective/src/app/api/instagram/data-deletion/route.ts#POST',
        service: ['fulfilMetaDeletion'],
      },
      {
        key: 'api:apps/arts-collective/src/app/api/threads/data-deletion/route.ts#POST',
        service: ['fulfilMetaDeletion'],
      },
      {
        "key": "api:apps/innergathering/src/app/api/meta/data-deletion/route.ts#POST",
        "service": [
          "@elkdonis/meta/data-deletion#createDataDeletionCallback",
          "@elkdonis/services#fulfilMetaDeletion"
        ],
        "address": {
          "app": "innergathering",
          "path": "/api/meta/data-deletion",
          "how": "called by Meta, no control"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/instagram/data-deletion/route.ts#POST",
        "service": [
          "@elkdonis/meta/data-deletion#createDataDeletionCallback",
          "@elkdonis/services#fulfilMetaDeletion"
        ],
        "address": {
          "app": "innergathering",
          "path": "/api/instagram/data-deletion",
          "how": "called by Meta, no control"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/threads/data-deletion/route.ts#POST",
        "service": [
          "@elkdonis/meta/data-deletion#createDataDeletionCallback",
          "@elkdonis/services#fulfilMetaDeletion"
        ],
        "address": {
          "app": "innergathering",
          "path": "/api/threads/data-deletion",
          "how": "called by Meta, no control"
        }
      },
    ],
    status: 'unverifiable: Meta calls these',
    risk: ['irreversible'],
    drift: "Six near-identical routes (three webhooks, three deletion callbacks) for one app registration.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (arts-collective, innergathering). Differences by app:\n- innergathering (was ig-meta-deletion-receive): files the request under this site’s orgId (arts-collective passes null) and uses lib/public-origin for the status URL; 24 diff lines, same factory.",
    canonical: 'one /api/meta/* pair, with Instagram and Threads callback URLs pointed at it in the Meta app config',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
    open: "innergathering (ig-meta-deletion-receive): Signature verification is in packages/meta/src/data-deletion.ts (parseSignedRequest, read); 503 without META_APP_SECRET per the route comment. Is this site registered as a callback URL in the Meta app, or only arts-collective?",
  },
  {
    id: 'receive-email-events',
    area: 'network.system',
    label: 'Email delivery events and inbound mail',
    does: 'SendGrid posts delivery events (bounces, opens) and forwards replies; both are signature-checked when the keys are set.',
    class: 'system',
    actors: ['system'],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/email/events/route.ts#POST',
        service: ['email#ingestEvents'],
      },
      {
        key: 'api:apps/arts-collective/src/app/api/email/inbound/route.ts#POST',
        service: ['email#recordInbound', 'email#classifyInbound'],
      },
    ],
    status: 'unverifiable: SendGrid calls these',
    risk: ['none'],
    open: 'Security finding 1 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): SENDGRID_EVENT_PUBLIC_KEY is unset in eac-arts-network, so the events route accepts unsigned posts and a forged bounce or unsubscribe can suppress any address in any org. The inbound key is set. Fix waits on Justin.',
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
  },
  {
    id: 'collect-page-pulse',
    area: 'network.system',
    label: 'Page-view pulse',
    does: 'The analytics beacon from every page.',
    class: 'system',
    actors: [
      "visitor",
      "system"
    ],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/pulse/route.ts#POST',
        service: ['analytics/route#createCollectHandler'],
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ]
      },
      {
        "key": "api:apps/elktours/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ],
        "note": "public, unauthenticated by design; defaultOrgId elktours"
      },
      {
        "key": "api:apps/forum/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ],
        "address": {
          "app": "forum",
          "path": "/api/pulse",
          "how": "the pulse beacon script in the layout; no control"
        },
        "note": "defaultOrgId null"
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ]
      },
      {
        "key": "api:apps/innergathering/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ],
        "address": {
          "app": "innergathering",
          "path": "/api/pulse",
          "how": "a beacon from the site, no control"
        }
      },
      {
        "key": "api:apps/katie-the-potter/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics/route#createCollectHandler"
        ]
      },
      {
        "key": "api:apps/art-auction/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics#createCollectHandler"
        ],
        "note": "Moved from ignored in consolidation 2. Copy of the analytics beacon (capability pulse-collect, arts-collective.network); system plumbing."
      },
      {
        "key": "api:apps/artdirect/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics#createCollectHandler"
        ],
        "note": "Moved from ignored in consolidation 2. Copy of the analytics beacon (collect-page-pulse in arts-collective.network); identical createCollectHandler mount. Lead: add this host there."
      },
      {
        "key": "api:apps/danamccool/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics#createCollectHandler"
        ],
        "note": "Moved from ignored in consolidation 2. Copy of the analytics beacon (collect-page-pulse in arts-collective.network); createCollectHandler mount with forceOrgId danamccool. Lead: add this host there."
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics#createCollectHandler"
        ],
        "note": "Moved from ignored in consolidation 2. Copy of the analytics beacon (collect-page-pulse in arts-collective.network); identical createCollectHandler mount. Lead: add this host there."
      },
      {
        "key": "api:apps/ifac/src/app/api/pulse/route.ts#POST",
        "service": [
          "@elkdonis/analytics#createCollectHandler"
        ],
        "note": "Moved from ignored in consolidation 2. Copy of the analytics beacon (capability collect-page-pulse in arts-collective.network); identical createCollectHandler mount. Lead: add this host there."
      },
    ],
    status: 'unverifiable: analytics rows',
    risk: ['none'],
    verified: '2026-11-16 read the api routes under app/api (auth, center, hub, org, my-files, upload, wizard, admin, email, meta, mcp), wizard/confirm/actions.ts, bookings/[token]/actions.ts, lib/email-suite.ts, lib/org.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 8 rows, 8 apps (arts-collective, amrit-canada, elktours, forum, fourthwayBookreaders, innergathering, katie-the-potter, sunjay). Differences by app:\n- amrit-canada (was amrit-pulse-collect): defaultOrgId siteConfig.orgId (used only when the host maps to no org). Same file in sunjay (apps.sunjay.*.ts: collect-page-pulse); differs in that one option.\n- elktours (was elktours-pulse-collect): one-line mount of the shared handler with this org as default.\n- forum (was forum-pulse-collect): defaultOrgId null (no org for non-thread pages). The writer is pkg-analytics-record-collect.\n- fourthwayBookreaders (was fourthway-pulse-collect): forceOrgId plus ignorePrefixes (/books/...). The /books prefix is hard-coded here.\n- innergathering (was ig-page-pulse-collect): forceOrgId \"inner_group\". Same copy in art-auction, elastrocal and pigeonshoot.\n- katie-the-potter (was katie-pulse-collect): forceOrgId literal katie-the-potter (same as sunjay).\n- sunjay (was sunjay-pulse-collect): forceOrgId literal \"sunjay\" (every page belongs to the org whatever the host). Same file in amrit-canada (apps.amrit-canada.*.ts: collect-page-pulse); differs in that one option.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    inputs: "event payload from the browser",
  },
];

const ignored: Area['ignored'] = [
];

export default { capabilities, ignored } satisfies Area;
