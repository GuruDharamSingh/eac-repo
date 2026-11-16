import type { Area, Capability, Host, HostKey } from '../types';

// hidden-enneagram site: sign-in, own profile, studio forms, site music, newsletter, contact, media upload, record
// payment. Round 2 (2026-11-16). The instrument and questionnaire hosts of this app were already claimed in
// orgapps.questionnaires; nothing of that family was left unclaimed.

const V =
  '2026-11-16 read apps/hidden-enneagram/src/{lib/forms/actions,lib/studio/service-actions,lib/audio-config-actions,lib/audio-config,lib/record-pay-action,lib/contact,lib/auth}.ts, app/api/{auth/*,upload,center/{avatar,profile,connections},newsletter/[slug]{,/send},org/[slug]/contact,pulse}/route.ts, app/manage/newsletter/page.tsx; diffed against apps/ifac copies';
const A = 'hidden-enneagram';
const AREA = 'he.site';
const k = (kind: 'sa' | 'api' | 'sql', p: string, s: string) => `${kind}:apps/hidden-enneagram/src/${p}#${s}` as HostKey;
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

const API_EDITOR = '(getApiEditor: owner or guide)';
const EDITORS: Capability['actors'] = ['guide', 'owner'];
const FORMS = 'lib/forms/site.tsx (the site compose pop-ups, packages/studio-forms)';

const capabilities: Capability[] = [
  mk({
    id: 'he-sign-in-out',
    label: 'Sign in and out of the site',
    does: 'Signs a person in and out of hidden-enneagram.',
    class: 'internal',
    actors: ['visitor', 'person'],
    scope: 'person',
    hosts: [
      h(api('auth/login', 'POST'), '/login', 'sign-in form', ['@elkdonis/auth-server#handleLogin']),
      h(api('auth/logout', 'POST'), '/', 'sign-out control in the hub drawer', ['@elkdonis/auth-server#handleLogout']),
      {
        "key": "api:apps/ifac/src/app/api/auth/login/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#createLoginHandler({ joinOrgs: [ifac as viewer] })"
        ],
        "address": {
          "app": "ifac",
          "path": "/login",
          "how": "sign-in form (components/login-form.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/auth/logout/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleLogout"
        ],
        "address": {
          "app": "ifac",
          "path": "/",
          "how": "sign-out in the hub drawer (components/hub/HubDrawer.tsx)"
        },
        "note": "GET variant (handleLogoutRedirect) is a read of the session, not a host"
      },
    ],
    status: 'a session cookie exists (login) or is gone (logout)',
    risk: ['none'],
    drift: "he-sign-in-out passes joinOrgs (every login enrols the person as a viewer); this one calls handleLogin(req) bare.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (hidden-enneagram, ifac). Differences by app:\n- ifac (was ifac-sign-in-out): hidden-enneagram login is handleLogin(req) with no joinOrgs (does not enrol the person as a viewer); ifac enrols every login as viewer. Both are mounts of packages/auth-server.",
    canonical: 'packages/auth-server handlers mounted once per app (already shared).',
    open: "ifac (ifac-sign-in-out): Intentional that a login on ifac joins the person to ifac as a viewer? (createLoginHandler joinOrgs.)",
  }),
  // ---------------- studio forms ----------------
  mk({
    id: 'he-service-save',
    label: 'Save a service from the compose pop-up',
    does: 'Creates or updates a service offering (draft or published) with price, format, booking type and page, from the shared service form.',
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(k('sa', 'lib/forms/actions.ts', 'siteServiceSaveAction'), '/hub?surface=compose:service', `Save and Publish in ${FORMS}`, ['(getViewer + canEdit = owner or guide)', '@elkdonis/services#validateServiceInput', '@elkdonis/services#upsertServiceOffering', '@elkdonis/services#getOrgFeed'])],
    entry: null,
    status: 'getServiceOfferingById(org, id) returns the saved offering with status published',
    risk: ['public', 'money'],
    confirm: cf('Save the service “{title}” at {price} on {org}? If it is published, visitors can book it. Payments happen on the checkout or Stripe page, not here.'),
    inputs: 'title, excerpt, body, price, currency (CAD USD EUR GBP), format, visibility, page, booking fields',
    drift: 'Third service-save path for the same offering: orgapps.cms manage-content-save (saveContentAction kind service, /manage), orgapps.money own-service-save (own offering), and the studio publish app (he-publish-service-save). All end in upsertServiceOffering or the threads row.',
    canonical: 'services upsertServiceOffering behind one kit action.',
    open: 'Existing id is org-checked (getServiceOfferingById(ORG, id)), good. Price is a typed string parsed in serviceInputFromAnswers; no client-trusted amount reaches a charge here (checkout reads the stored price).',
  }),
  mk({
    id: 'he-publish-service-save',
    label: 'Save a service from the publish app',
    does: 'Saves a service draft from the studio publish app by delegating to the manage content action as kind service.',
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(k('sa', 'lib/studio/service-actions.ts', 'savePublishService'), '/studio', 'service editor in the publish app (components/publish)', [API_EDITOR, '(delegates to saveContentAction in lib/cms/actions.ts)'], 'wrapper: builds the input, then saveContentAction')],
    entry: null,
    status: 'same as manage-content-save: a threads row of kind service exists',
    risk: ['public', 'money'],
    confirm: cf('Save the service “{title}” at {price} on {org}? If it is published, visitors can book it. Payments happen on the checkout or Stripe page, not here.'),
    inputs: 'ServiceDraft (title, summary, body, cover, booking type, format, price, sliding scale, duration, sessions, location, registration status)',
    drift: 'Wrapper over orgapps.cms manage-content-save (hidden-enneagram saveContentAction); the same capability reached from a second screen. See he-service-save for the other path.',
    canonical: 'one service save kit action.',
    open: 'See orgapps.cms manage-content-save: hidden-enneagram saveContentAction stores post body with no sanitizeRichText (security lead from agent E).',
  }),
  // ---------------- music, newsletter, contact, upload, pay ----------------
  mk({
    id: 'he-audio-config-save',
    label: "Set the site's music",
    does: "Saves the background music settings (tracks and options, cleaned by cleanAudioConfig) for the whole site.",
    class: 'person',
    actors: EDITORS,
    scope: 'org',
    hosts: [
      h(k('sa', 'lib/audio-config-actions.ts', 'saveAudioConfigAction'), '/manage/music', 'Save in the music settings (components/manage/music-settings.tsx)', [API_EDITOR, '(cleanAudioConfig allow-list)']),
      h(k('sql', 'lib/audio-config.ts', 'saveAudioConfig'), '/manage/music', 'same control', ['(raw INSERT site_config ... ON CONFLICT via withOrg(ORG))'], 'org-scoped through withOrg and the ORG key'),
    ],
    entry: null,
    status: 'site_config key for the audio config holds the saved value (loadAudioConfig)',
    risk: ['public'],
    confirm: cf('Save the music settings for {org}? Visitors hear the change at once.'),
    inputs: 'tracks, volume, autoplay (AudioConfig)',
    drift: 'hidden-enneagram only. Org-scoped (withOrg); input is cleaned.',
    canonical: 'a site_config save helper shared with danamccool navigation (he-audio-config-save and dana-navigation-save are the same shape).',
  }),
  mk({
    id: 'he-newsletter-save',
    label: 'Save a newsletter letter',
    does: "Saves (or creates) a designed newsletter letter for the organisation's subscribers.",
    class: 'person',
    actors: EDITORS,
    scope: 'org',
    hosts: [h(api('newsletter/[slug]', 'PUT'), '/manage/newsletter/{slug}', 'newsletter editor (app/manage/newsletter/[slug]/page.tsx)', [API_EDITOR, '@elkdonis/newsletter/server#saveNewsletter', '@elkdonis/newsletter#isValidNewsletterSlug']),
      {
        "key": "api:apps/ifac/src/app/api/newsletter/series/[id]/[slug]/route.ts#PUT",
        "service": [
          "(getApiEditor: owner or guide)",
          "(findIfacSeries: must be an ifac series)",
          "@elkdonis/newsletter/server#saveNewsletter"
        ],
        "address": {
          "app": "ifac",
          "path": "/manage/email/series/{id}",
          "how": "mailing editor under Mailings to this series (app/manage/email/series/[id])"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/newsletter/[slug]/route.ts#PUT",
        "service": [
          "@elkdonis/newsletter/server#saveNewsletter"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/newsletter/{slug}",
          "how": "the Save button of the newsletter editor (packages/newsletter/src/editor.tsx, mounted in app/hub/newsletter/[slug]/page.tsx)"
        }
      },
    ],
    entry: null,
    status: 'listNewsletters(hidden-enneagram) includes the letter with the title',
    risk: ['none'],
    confirm: cf('Save the letter “{title}”? Nothing is sent yet.'),
    inputs: 'slug, title, project, html',
    drift: "Org-wide version of he-newsletter-save (series audience there).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (hidden-enneagram, ifac, innergathering). Differences by app:\n- ifac (was ifac-series-mailing-save): Series-audience version of hidden-enneagram he-newsletter-save (api/newsletter/[slug]); ifac adds findIfacSeries and an audience.\n- innergathering (was ig-newsletter-save): Same route in hidden-enneagram (api/newsletter/[slug]); not diffed. ifac has api/newsletter/series.",
    canonical: '@elkdonis/newsletter saveNewsletter behind one route mount.',
    open: "html and project stored as given (legacy designer; editors only).\ninnergathering (ig-newsletter-save): SECURITY (mild, editor-only): html is stored and sent as written; the editor output is trusted (newsletter/[slug]/route.ts:28-32). Only owner/guide can reach it.",
  }),
  mk({
    id: 'he-newsletter-delete',
    label: 'Delete a newsletter letter',
    does: 'Deletes a draft or sent letter.',
    class: 'person',
    actors: EDITORS,
    scope: 'org',
    hosts: [h(api('newsletter/[slug]', 'DELETE'), '/manage/newsletter/{slug}', 'delete on a letter (app/manage/newsletter/[slug]/page.tsx)', [API_EDITOR, '@elkdonis/newsletter/server#deleteNewsletter'], 'slug is not checked with isValidNewsletterSlug on DELETE (it is on PUT and send)'),
      {
        "key": "api:apps/ifac/src/app/api/newsletter/series/[id]/[slug]/route.ts#DELETE",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/newsletter/server#deleteNewsletter"
        ],
        "address": {
          "app": "ifac",
          "path": "/manage/email/series/{id}",
          "how": "delete on a mailing (app/manage/email/series/[id])"
        }
      },
    ],
    entry: null,
    status: 'listNewsletters(hidden-enneagram) no longer lists the slug',
    risk: ['irreversible'],
    confirm: cf('Delete the letter “{title}”? This cannot be undone.'),
    inputs: 'slug',
    drift: "Org-wide version of ifac-series-mailing-delete.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (hidden-enneagram, ifac). Differences by app:\n- ifac (was ifac-series-mailing-delete): As he-newsletter-delete, with the series audience.",
    canonical: '@elkdonis/newsletter deleteNewsletter.',
    open: 'apps/hidden-enneagram/src/app/api/newsletter/[slug]/route.ts:45-48 the slug goes to deleteNewsletter unvalidated (PUT and send call isValidNewsletterSlug); the call is org-scoped, so at worst a no-match.',
  }),
  mk({
    id: 'he-newsletter-send',
    label: 'Send a newsletter letter',
    does: 'Sends the letter to everyone who signed up and has not unsubscribed (or up to three test addresses).',
    class: 'person',
    actors: EDITORS,
    scope: 'org',
    hosts: [h(api('newsletter/[slug]/send', 'POST'), '/manage/newsletter/{slug}', 'Send on a letter (app/manage/newsletter/[slug]/page.tsx)', [API_EDITOR, '@elkdonis/newsletter/server#sendNewsletter']),
      {
        "key": "api:apps/ifac/src/app/api/newsletter/series/[id]/[slug]/send/route.ts#POST",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/newsletter/server#sendNewsletter"
        ],
        "address": {
          "app": "ifac",
          "path": "/manage/email/series/{id}",
          "how": "Send on a mailing (app/manage/email/series/[id])"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/newsletter/[slug]/send/route.ts#POST",
        "service": [
          "@elkdonis/newsletter/server#sendNewsletter",
          "@elkdonis/newsletter#publicBaseUrl"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/newsletter/{slug}",
          "how": "the Send button of the newsletter editor (editor.tsx, sendEndpoint)"
        },
        "note": "testTo: up to 3 addresses, any text containing \"@\"."
      },
    ],
    entry: null,
    status: 'listNewsletters shows sentAt and sentCount for the letter',
    risk: ['emails', 'irreversible'],
    confirm: cf('Send “{title}” to the {count} people on the {org} list? They get the email now. This cannot be undone.'),
    inputs: 'slug, testTo[] (max 3)',
    drift: "Org-wide version of he-newsletter-send, without the force flag and series audience; baseUrl is taken from NEXT_PUBLIC_APP_URL or the request Host header.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (hidden-enneagram, ifac, innergathering). Differences by app:\n- ifac (was ifac-series-mailing-send): As he-newsletter-send, with series audience and unsubscribe URL.\n- innergathering (was ig-newsletter-send): Same route in hidden-enneagram; not diffed.",
    canonical: '@elkdonis/newsletter sendNewsletter.',
    open: "SECURITY: apps/hidden-enneagram/src/app/api/newsletter/[slug]/send/route.ts:46-48 baseUrl falls back to the request Host and x-forwarded-proto headers when NEXT_PUBLIC_APP_URL is unset, and that base goes into the links of every email sent (host-header poisoning risk if the env var is missing in production). ifac pins MAILING_BASE_URL.\nifac (ifac-series-mailing-send): force:true is read from the body of the request and passed straight to sendNewsletter: an editor can resend a sent mailing to the whole series. Whether sendNewsletter rate-limits or logs it was not read.\ninnergathering (ig-newsletter-send): baseUrl is built from x-forwarded-host/host when NEXT_PUBLIC_APP_URL is unset (send/route.ts:49-53); links in the sent mail follow that header.",
  }),
  mk({
    id: 'he-record-pay',
    label: 'Pay for a recorded reading',
    does: "Starts the checkout for a service (ref service:<slug>) from the records page; an invalid ref redirects to /readings. The money step is bookAndPay.",
    class: 'person',
    actors: ['visitor', 'person'],
    scope: 'person',
    hosts: [h(k('sa', 'lib/record-pay-action.ts', 'payForRecord'), '/readings', 'Pay button in the record block (blocks/record-site.tsx)', ['(delegates to lib/booking-actions bookAndPay)'], 'wrapper: validates ref with a regex, then bookAndPay')],
    entry: null,
    status: 'a booking or order row exists for the service and the payment status from Stripe',
    risk: ['money'],
    confirm: cf('Go to checkout for “{title}” at {price}? Payments happen on the checkout or Stripe page, not here.'),
    inputs: 'ref (service:<slug>), form fields',
    drift: 'Wrapper over orgapps.commerce.booking service-book-and-pay (hidden-enneagram bookAndPay); the same capability from the records page.',
    canonical: 'startBookingCheckout + packages/booking createBooking (booking canonical).',
    open: 'The dock only links to checkout; the step ticks itself from payment status.',
  }),
];

export default {
  capabilities,
  ignored: [
    { key: k('sa', 'app/manage/newsletter/page.tsx', 'createLetter/createLetter'), why: 'writes nothing: inline server action that only redirects to the letter editor with ?title=; the letter is saved by the PUT route (he-newsletter-save)' },
    { key: k('sa', 'lib/forms/actions.ts', 'sitePostContextAction'), why: 'read: builds the post form context, writes nothing' },
    { key: k('sa', 'lib/forms/actions.ts', 'sitePostListAction'), why: 'read: lists posts for the picker' },
    { key: k('sa', 'lib/forms/actions.ts', 'sitePostLoadAction'), why: 'read: loads a post for the form' },
    { key: k('sa', 'lib/forms/actions.ts', 'siteServiceContextAction'), why: 'read: builds the service form context, writes nothing' },
    { key: k('sa', 'lib/forms/actions.ts', 'siteServiceListAction'), why: 'read: lists services for the picker' },
    { key: k('sa', 'lib/forms/actions.ts', 'siteServiceLoadAction'), why: 'read: loads a service for the form' },
    { key: k('sa', 'lib/studio/service-actions.ts', 'listPublishServices'), why: 'read: lists services for the publish app (SELECT only)' },
    { key: k('sa', 'lib/studio/service-actions.ts', 'loadPublishService'), why: 'read: loads one service for the publish app' },
  ],
} satisfies Area;
