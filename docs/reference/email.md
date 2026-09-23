# Email and newsletter

Outbound transactional mail, the per-org sending identity, the email suite UI,
inbound mail, the delivery ledger, the GrapesJS newsletter and the DNS each
sending domain needs. Code lives in `packages/email` (`@elkdonis/email`),
`packages/newsletter` (`@elkdonis/newsletter`) and `packages/cms-ui/src/email`
(`@elkdonis/cms-ui/email`). Much of it is uncommitted in the working tree
(`git status`, 2026-09-23).

Last verified: 2026-09-23 (code, read-only DB queries, env shape checks, `dig`).

## Current state

### Is mail sending?

Yes. **Mail has been going out since at least 2026-09-19.**

- `.env` holds a `SENDGRID_API_KEY` in the `SG.<22>.<43>` shape, not the
  `.env.example` placeholder, and so do the running containers `eac-arts-network`,
  `eac-innergathering`, `eac-ifac`, `eac-amrit-canada`, `eac-sunjay`,
  `eac-hidden-enneagram`, `eac-art-auction` (shape checks; value not printed).
- `email_sends` holds 9 rows, 2026-09-19 to 2026-09-21 (ifac contact/welcome;
  inner_group notification/rsvp/welcome), all `queued`, meaning SendGrid
  returned 202. None are `delivered`, because `email_events` has 0 rows: the
  Event Webhook key `SENDGRID_EVENT_PUBLIC_KEY` is unset.
- `email_inbox` holds 4 rows (amrit_canada 1 enquiry, ifac 2 enquiries + 1 spam),
  so inbound works end to end.

### Transport (`packages/email/src/client.ts`)

- SendGrid only (`@sendgrid/mail`). No SMTP transport exists in `packages/email`
  and `SMTP_*` are unset; CLAUDE.md's "SendGrid / SMTP" is not code.
- `sendEmail(opts)` (`client.ts:60`) returns
  `{ ok, messageId, sandboxed, skipped }`. With no key it throws in production
  and returns `skipped: true` elsewhere (`client.ts:69-75`).
- With `orgId`, it resolves From/reply-to/ASM group from the org identity and
  adds `categories: ['org:<id>','kind:<kind>']`, `customArgs`
  (orgId/kind/threadId), `asm.groupId`, and a `Feedback-ID: <kind>:<org>:eac`
  header (`client.ts:79-133`).
- `EMAIL_SANDBOX=1` / `sandbox: true` validates without delivering (`client.ts:110`).
- Every send with an `orgId` writes one `email_sends` row via `recordSend`
  (`ledger.ts:58`), including failures, before re-throwing. `noLedger: true`
  skips it (used by `scripts/email-doctor.mts`).
- The ASM group is attached to every send with an `orgId` that has one, not only
  bulk mail (`client.ts:92`), and all six stored identities have one.

### Per-org identity (`packages/email/src/identity.ts`)

- Stored in `site_config` under key `email:identity` (`identity.ts:18`), read by
  `getOrgEmailIdentity(orgId)` (`identity.ts:261`) with a 60 s per-process cache.
- Fields: `fromEmail`, `fromName`, `replyTo`, `ownerEmails`, `asmGroupId`,
  `accentColor`, `palette` (`accent`, `onAccent`, `ink`, `bodyFont`, `bannerUrl`,
  `bannerAlt`, `frameColor`, `frameWidth`), `inboundReplies`; derived
  `fromIsOrgDomain`, `categoryPrefix`.
- Authenticated-domain guard: a stored `fromEmail` whose domain is not in
  `EMAIL_AUTHENTICATED_DOMAINS` (plus `EMAIL_FROM`'s own domain) is ignored, the
  network address `EMAIL_FROM` is used, and `fromIsOrgDomain` is false
  (`identity.ts:195-220`, `:286-297`). The guard checks the env list only; it
  does not ask SendGrid.
- `fromName` falls back to `organizations.name`, then `EMAIL_FROM_NAME` (unset),
  then "Elkdonis Arts Collective".
- `ownerEmails` falls back to legacy env vars (`IFAC_OWNER_EMAIL`,
  `AMRIT_CANADA_OWNER_EMAIL`, `INNERGATHERING_OWNER_EMAIL`, `EAC_OWNER_EMAIL`,
  `NEXT_PUBLIC_*_OWNER_EMAIL`) when no stored list exists (`identity.ts:230-247`).
- `saveOrgEmailIdentity(orgId, input)` (`identity.ts:357`) merges over the stored
  value: `undefined` leaves a field, `null`/`''` clears it; `palette` merges per
  key. Hex and `https://` allow-lists (`HEX`, `IMAGE_URL` at `identity.ts:134`)
  apply because the values land in `style`/`src` attributes.
- `emailChromeFor(identity)` (`identity.ts:332`) reads the banner and frame.

Stored identities (DB, 2026-09-23): amrit_canada, danamccool, elkdonis,
hidden-enneagram, ifac, inner_group. A `fromEmail` is stored for amrit_canada
(amritcanada.ca), elkdonis and inner_group (elkdonis-arts.org), and ifac
(ifacgroup.com). hidden-enneagram and danamccool have none and send as the
network address. `EMAIL_AUTHENTICATED_DOMAINS` in `.env` lists ifacgroup.com,
amritcanada.ca, hiddenenneagram.com, arts-collective.com, elkdonis-arts.org and
inbound.elkdonis-arts.org; danamccool.com is not listed.

The identity write routes (`apps/{ifac,innergathering}/src/app/api/hub/email/identity/route.ts`,
`apps/arts-collective/src/app/api/org/[slug]/email/identity/route.ts`) do not
accept `fromEmail`; it is set by `packages/email/scripts/seed-identities.mts` or a
direct `saveOrgEmailIdentity` call after the domain's DNS is done.

### Rendering

- React Email (`@react-email/components`, `@react-email/render`). All
  `render*Email` go through `renderEmail()` (`render-email.ts:68`), which applies
  `withOutlookWidth()` (`render-email.ts:42`), a fixed-width MSO table wrapper
  added to the rendered string.
- `components/EmailShell.tsx` is the shared frame: masthead, card, footer, and
  the `data-eac-header` / `data-eac-body` / `data-eac-footer` markers the editor
  seeder relies on. `EMAIL_FONTS` has eight body-face ids (`EmailShell.tsx:70`).
- Templates (`src/templates/`): welcome, provisioning, rsvp-guest, rsvp-owner
  (also covers signup/follow/purchase/contact via `OwnerNotificationKind`),
  reminder, meeting-trigger (reminder/cancellation/confirmation), contact-owner,
  newsletter, advanced, order-invoice, order-notification.
- Overridable template keys: `TEMPLATE_KEYS` in `template-store.ts:35` (eight).
- Override resolution, `renderWithOverrides()` (`index.ts:293`), in order:
  1. network copy (`copy-slots.ts`, `COPY_SLOTS` / `TEMPLATE_SLOTS`; `copy.ts` is
     a thin view over it);
  2. the org's words in `email_template_settings.config`: `bodyText`, `bodyHtml`,
     `copy` (per-slot overrides), `links`, `media`;
  3. the org's layout, `config.html`, which replaces the body only; shell and
     footer stay the network's.
  A per-thread key `<key>:<threadId>` (`threadTemplateKey`, `template-store.ts:58`)
  beats the org-wide key.
- The org name leads the masthead only when `fromIsOrgDomain` is true
  (`index.ts:314`). Banner, frame and body face apply regardless.
- `<OrgWords>` (`components/org-words.tsx`) renders an org's rich text through
  `sanitizeEmailHtml` (`packages/utils/src/sanitize-email.ts`), which inlines
  styles from the palette at render time.
- `saveOrgTemplate` (`template-store.ts:268`): `undefined` leaves, `null` clears.
  `clearOrgTemplate` (`template-store.ts:360`) deletes the whole row, layout
  included.
- `email_template_settings` (migration 048): 5 rows, all org `inner_group`, all
  `jsonb_typeof = object` (migration 129 decoded earlier double-encoded rows).
  `apps/inner-gathering/src/lib/email-template-settings.ts:133` still writes
  `${JSON.stringify(config)}::jsonb`; that app is being retired.

### Preview and editor call sites

`renderSample(key, opts)` (`samples.ts:323`), `renderTemplateBody(key, opts)`
(`seed.ts:153`) and `renderTemplateEnvelope(key, opts)` (`seed.ts:209`) render
from sample props. They only reflect an org's look if the caller passes it:

| Option | Source |
|---|---|
| `orgName`, `orgHeader`, `orgAccent` | `identity.fromName`, `identity.fromIsOrgDomain`, `identity.palette?.accent ?? identity.accentColor` |
| `bodyFont` | `identity.palette?.bodyFont` |
| `chrome` | `emailChromeFor(identity)` |
| `bodyText`, `bodyHtml`, `copy` | stored `OrgTemplate` (`renderSample` only) |

Call sites (2026-09-23): arts-collective `api/org/[slug]/email/preview/[key]/route.ts:45`;
ifac and innergathering `api/hub/email/preview/[key]/route.ts:41`,
`api/hub/email/[key]/test/route.ts:64`, `hub/email/[key]/page.tsx`, and
`hub/email/[key]/edit/page.tsx` (body + envelope). The two `test/route.ts:64`
`renderSample` branches omit `bodyFont` and `chrome` (see Open items).

### Email suite UI (`@elkdonis/cms-ui/email`)

`EmailFace`, `EmailSurface` / `EmailCustomSurface` (tabs: activity, inbox,
addresses, letters, look), `TemplateWordsEditor`, `email.css`,
`email-theme.css`. Presentational; hosts supply data and connectors through
`loadEmailSuite` in `apps/<app>/src/lib/email-suite.ts`.

| Host | Route | Gate |
|---|---|---|
| arts-collective | `/email?org=<slug>`; API `/api/org/[slug]/email/*`; face in the org console | view: any role in that org; edit: owner or guide (`apps/arts-collective/src/lib/email-suite.ts:33`, `:52`, `:75`) |
| innergathering | `/hub/email`, `/hub/email/[key]`, `/hub/email/[key]/edit`, `/hub/newsletter`, `/unsubscribe`; API `/api/hub/email/*`, `/api/newsletter/[slug]{,/send}` | owner or guide (`requireOrgEditor`, `getApiEditor`) |
| ifac | `/manage/email` (`/hub/email` redirects there); `/hub/email/[key]`, `/hub/email/[key]/edit`; API `/api/hub/email/*` incl. `reply` | `/manage/email`: `canManageIfac` = configured owner email, network admin, or owner/guide role (`apps/ifac/src/lib/data.ts:120`); API: owner or guide |

Not on the shared suite: amrit-canada and sunjay use their own per-thread
`components/hub/EmailSurface.tsx` (confirmation body, trigger blast, reminder
settings) under the same `email` surface key, so they cannot also mount the
shared one. hidden-enneagram has only the newsletter. The admin app has a
template preview page at `/email-templates` (port 3000). `/manage/email` is not
owner-only (see History). Test sends (`POST .../[key]/test`) go to the session user's address, never a
body-supplied one. IFAC's `api/hub/email/reply` sends a reply from the org's
identity to the stored message's sender.

### Template layout editor and `{field}` tokens

- `/hub/email/[key]/edit` (innergathering, ifac) opens the GrapesJS editor from
  `@elkdonis/newsletter/editor` in `mode="template"` (no send-to-all).
- The canvas is seeded by `renderTemplateBody`, which renders sample props,
  extracts the `data-eac-body` region, and reverse-substitutes each sample value
  back to its `{field}` token. `renderTemplateEnvelope` supplies the masthead and
  footer drawn around the canvas, outside the saved HTML.
- Fields per letter: `MERGE_FIELDS` (`merge-fields.ts:142`). At send time
  `fillHtml` (`merge-fields.ts:273`) substitutes tokens case-insensitively
  (uppercase-styled cells display `{THREADKIND}`).
- Guard: `pnpm --filter @elkdonis/email check:fields`
  (`scripts/check-merge-fields.mts`), part of `check-types`. It fails when a
  field's sample value cannot be found in the rendered body: date formats that
  differ from the template's, two fields sharing one sample value, or a field
  rendered only in the footer.

### Inbound mail (`packages/email/src/inbox.ts`)

- One receiving host: `inbound.elkdonis-arts.org` MX → SendGrid Inbound Parse →
  `POST https://arts-collective.com/api/email/inbound`
  (`apps/arts-collective/src/app/api/email/inbound/route.ts`) → `email_inbox` (134).
- Addresses are derived, not stored: `inboundAddressFor(orgId)` =
  lowercased org id with `_`→`-` @ `inboundHost()` (`inbox.ts:57`);
  `inboundAddressForThread` appends `.<threadId>` (`inbox.ts:69`).
- `parseInboundRecipient` (`inbox.ts:98`) matches the org part
  case-insensitively against real org ids and returns the thread token with its
  case intact. The route looks the thread up exactly, then retries with
  `lower(id)` and accepts only a single match (`route.ts:161-172`).
- The route verifies the ECDSA signature over the raw body before parsing
  (`route.ts:56-97`). With `SENDGRID_INBOUND_PUBLIC_KEY` set, an unsigned POST
  gets 403; that is expected, not a fault. Test with real mail.
- `inboundEnabled()` is `Boolean(EMAIL_INBOUND_DOMAIN)` (`inbox.ts:42`); it
  gates the Inbox tab and the "route replies here" toggle. The var is set in
  `.env` and passed to arts-collective, innergathering, ifac, amrit-canada and
  sunjay.
- Classification: reply, enquiry, auto, bounce, spam. Bodies stored raw and
  rendered as text; attachment metadata only.
- An org's own domain reaches the inbox through a cPanel forwarder
  `info@<domain>` → `<org>@inbound.elkdonis-arts.org`. Forwarders exist for
  ifacgroup.com, amritcanada.ca, hiddenenneagram.com (**assumed**, from memory
  notes dated 2026-09-21; cPanel not checked).

### Ledger, events and address book

- Migration 135: `email_sends` (one row per recipient, no bodies) and
  `email_events`. `POST /api/email/events` on arts-collective verifies with
  `SENDGRID_EVENT_PUBLIC_KEY` (accepts unsigned and logs a warning without it),
  then `ingestEvents` (`ledger.ts:148`) updates sends and sets
  `contacts.status='unsubscribed'` on unsubscribe-type events.
- `address-book.ts`: `listAddressBook` (`:70`) merges `contacts`,
  `user_organizations` members and `thread_rsvps` guests at read time;
  `listMailable` (`:150`) drops unsubscribed addresses across all sources;
  `suppressAddress` (`:319`) upserts an `unsubscribed` contact on the unique
  `(org_id, lower(email))` index (migration 134).

### Newsletter (`packages/newsletter`)

- Entry points: `@elkdonis/newsletter` (types, `publicBaseUrl`, starters),
  `/editor` (client GrapesJS + `grapesjs-preset-newsletter`), `/server` (store,
  recipients, send). GrapesJS must be imported dynamically.
- Storage: `site_config` key `newsletter:<slug>`, holding the project JSON and
  the inlined HTML (juice runs in the browser).
- Blocks: `blocks.ts` (37 block ids), `starters.ts` (starters are lists of block
  ids), `thread-cards.ts` (`data-eac-thread` cards resolved at send time).
  Guards: `check:cards`, `check:blocks`, `check:starters`.
- `sendNewsletter` (`server.ts:269`) refuses when `SENDGRID_API_KEY` is absent
  (`:289`) or no HMAC secret resolves (`:297`); refuses a real send with broken
  thread cards or leftover placeholder copy unless `force`; sends sequentially
  with `kind: 'newsletter'`.
- Recipients: `listRecipients` (`server.ts:154`) reads `contacts` only, minus
  `unsubscribed`. It does not use the merged address book.
- Unsubscribe (migration 128 adds `unsubscribed` to the `contacts.status` CHECK):
  `withUnsubscribe` (`server.ts:233`) appends a footer per recipient linking to
  `<baseUrl>/unsubscribe?e=<email>&t=<HMAC-SHA256(org_id, email)>`. Secret:
  `NEWSLETTER_SECRET`, else `INTER_APP_JWT_SECRET` (`server.ts:172`);
  `NEWSLETTER_SECRET` is unset in `.env`, so the fallback is in use.
- `baseUrl` comes from `publicBaseUrl()` (`index.ts:93`), which prefers the
  forwarded host over a loopback/private configured URL.
- Hosts that send newsletters and therefore serve `/unsubscribe`:
  hidden-enneagram (`/manage/newsletter`, `/api/newsletter/[slug]{,/send}`) and
  innergathering (`/hub/newsletter`, same API). arts-collective and ifac have no
  newsletter route.
- No real newsletter send is recorded in `email_sends` (no `newsletter` kind rows).

### RSVP and other triggers

| Trigger | Where | Template |
|---|---|---|
| RSVP confirmation to guest | `api/rsvp` and `api/threads/[id]/rsvp` in amrit-canada, sunjay, innergathering; `api/rsvp` in ifac | rsvp-guest |
| New RSVP to owner/author | same routes | rsvp-owner |
| Minimum attendees reached, to author | `api/threads/[id]/rsvp` in amrit-canada and sunjay (`min_attendees`) | rsvp-owner with a message |
| Attendee reminder before a gathering | `lib/reminders.ts` `runReminderTick`, 5-minute interval in `instrumentation.ts`, amrit-canada and sunjay; deduped by `thread_reminder_sends` (069, `kind` added in 136) | reminder |
| Host (rota) reminder | innergathering `lib/reminders.ts` `runHostReminderTick` | reminder |
| Manual blast (reminder/cancellation/confirmation) | `api/threads/[id]/trigger-email` in amrit-canada, sunjay, innergathering | meeting-trigger |
| Welcome on signup | `packages/auth-server/src/api-routes.ts:334`, `:581` | welcome |
| Contact form | ifac `api/signup`, innergathering `api/contact`, `packages/silex-render/src/contact.ts` | contact-owner |
| Orders | `packages/commerce/src/server/orders.ts`, `service-orders.ts` | order-invoice, order-notification |

Not implemented: automatic RSVP-cancellation mail, RSVP-deadline reminders,
organiser digests (`docs/archive/RSVP_EMAIL_TRIGGERS.md`); `sendProvisioningEmail`
has no caller. RSVP routes send in a detached `void (async () => …)()` block:
a failed email reaches the log and ledger, not the HTTP response.

## DNS checklist per sending domain

Record values come from SendGrid's domain-authentication page for that domain;
they are not repeated here. State from public `dig`, 2026-09-23. SendGrid's own
"valid" flag was not checked.

| Domain | DNS host | `em####` CNAME | `s1`/`s2._domainkey` CNAME | `_dmarc` TXT | MX | In `EMAIL_AUTHENTICATED_DOMAINS` |
|---|---|---|---|---|---|---|
| ifacgroup.com | Bluehost | em5156 present | present | `p=none`, no `rua` | Bluehost | yes |
| amritcanada.ca | Bluehost | em7954 present | present | `p=none`, no `rua` | Bluehost | yes |
| hiddenenneagram.com | Bluehost | em5087 present | present | missing | Bluehost | yes |
| arts-collective.com | Bluehost | em8442 present | present | `p=none`, no `rua` | `mx.sendgrid.net` | yes |
| danamccool.com | renewyourname.net | em6443 present | present | missing | none | no |
| elkdonis-arts.org | Bluehost | em6860 present | present | `p=none`, no `rua` | Bluehost | yes |
| inbound.elkdonis-arts.org | Bluehost | n/a | n/a | n/a | `10 mx.sendgrid.net` | listed (harmless) |

For a new sending domain:
- [ ] Create domain authentication in SendGrid (automatic security); add the
      three CNAMEs (`em####`, `s1._domainkey`, `s2._domainkey`), unproxied.
      Bluehost accepts underscores only in CNAME records.
- [ ] Validate in SendGrid.
- [ ] `_dmarc.<domain>` TXT `v=DMARC1; p=none; rua=mailto:<same-domain address>`.
      A `rua` on another domain needs an authorisation TXT on that domain.
- [ ] Do not add `include:sendgrid.net` to the root SPF; SPF is checked on the
      `em####` return path.
- [ ] Add the domain to `EMAIL_AUTHENTICATED_DOMAINS` in `.env`; recreate the
      sending containers.
- [ ] Set the org's `fromEmail` (`seed-identities.mts` / `saveOrgEmailIdentity`);
      check with `docker exec -w /app/packages/email <container> ./node_modules/.bin/tsx scripts/email-doctor.mts`.
- [ ] If the domain has MX, add a cPanel forwarder `info@<domain>` →
      `<org-id-with-hyphens>@inbound.elkdonis-arts.org`.

## Rules and constraints

- Pass `orgId` and `kind` to every `sendEmail` / `send*Email` call: without
  `orgId` the send uses the network identity and is not written to the ledger.
- Pass `bodyFont`, `chrome: emailChromeFor(identity)` and the stored `copy` at
  every `renderSample`, `renderTemplateBody` and `renderTemplateEnvelope` call:
  omitted options render the network defaults and the preview disagrees with
  what sends.
- Do not set `fromEmail` on a domain before its CNAMEs validate and it is in
  `EMAIL_AUTHENTICATED_DOMAINS`: unauthenticated From fails SPF/DKIM and Gmail
  and Yahoo reject it.
- Write identity and template config through `saveOrgEmailIdentity` /
  `saveOrgTemplate` with `undefined` = leave, `null` = clear: a full-object write
  erases fields the caller did not send. Do not use `clearOrgTemplate` to clear
  one field; it deletes the layout too.
- Store JSONB with `db.json(x)`, not `${JSON.stringify(x)}::jsonb`: the latter
  stores a JSON string and `config->'links'` reads NULL (migration 129).
- Keep the org part of an inbound address case-insensitive and the thread token
  case-preserved: thread ids are case-sensitive nanoids.
- Verify inbound and event webhooks against the raw body before parsing: the
  signature covers the exact bytes.
- Keep mailed HTML portable: inline styles only (no `<style>`, no classes);
  tables with `role="presentation"`, no flex/grid/absolute; `width` as an HTML
  attribute on images and fixed-width tables (Outlook ignores `max-width`); a
  solid `background-color` before any `linear-gradient` (Word drops gradients);
  body faces from `EMAIL_FONTS`, whose first family ships with Windows, macOS,
  iOS and Android (clients strip `@font-face`); image URLs `https://` only; alt
  text on every image. Run `check:portability` and `check:blocks`.
- Use a plain `<div>` for `dangerouslySetInnerHTML` inside templates, not
  React Email's `<Section>`: `Section` supplies children, the render throws, and
  the letter comes out empty with no type error.
- Serve `/unsubscribe` on every app that sends a newsletter, and leave the
  footer to `withUnsubscribe`: the link points at the sending host.
- Do not rotate `INTER_APP_JWT_SECRET` / `NEWSLETTER_SECRET` without accepting
  that every unsubscribe link already sent stops verifying.
- Do not move templates to SendGrid Dynamic Templates: in-repo React Email is
  reviewable, and dynamic templates render a mistyped variable as an empty string.
- Declare a new `{field}` only if its sample value renders verbatim in the
  body, is unique among the letter's samples, and is outside the footer; run
  `check:fields`.
- A new `EMAIL_FONTS` id needs a matching `.eac-email-font-sample[data-font]`
  rule in `packages/cms-ui/src/email/email.css`.

## Open items

- Test-send routes omit `bodyFont` and `chrome` in the `renderSample` branch:
  `apps/{ifac,innergathering}/src/app/api/hub/email/[key]/test/route.ts:64`.
  They also pass `orgAccent: identity.accentColor` where previews use
  `palette.accent ?? accentColor`.
- Delivery tracking: set up the signed Event Webhook to
  `https://arts-collective.com/api/email/events` and put its key in
  `SENDGRID_EVENT_PUBLIC_KEY`. Until then every send stays `queued`.
- Newsletter recipients come from `contacts` only; `listMailable` (merged,
  suppression-aware) exists but is unused.
- ASM group on transactional mail: an unsubscribe through SendGrid's one-click
  header for an org's group would also suppress that org's RSVP confirmations
  (`client.ts:92` applies the group to every org send). Decide whether
  transactional kinds should skip `asmGroupId`.
- Per-thread email (trigger, reminder settings) is still app-local in
  amrit-canada and sunjay; not a tab in the shared suite.
- Reminder ticks run per container on an in-process interval; there is no shared
  scheduler, and ifac has no reminders.
- DNS/identity gaps: DMARC missing on hiddenenneagram.com and danamccool.com,
  no domain has a `rua`; danamccool.com is not in `EMAIL_AUTHENTICATED_DOMAINS`
  and has no MX; danamccool and hidden-enneagram have no stored `fromEmail`.
- **Unknown**: whether a Parse host exists for arts-collective.com (its MX points
  at `mx.sendgrid.net`), and SendGrid's validation flag for each domain (DNS
  records are present; the API was not read).
- The key has full-access scopes (2026-09-16 notes, assumed); a Mail-Send-only
  key would limit exposure. No batching via `personalizations`, no scheduled
  sends, inbound attachments stored as metadata only.

## History

- 2026-09-23: this document. Corrections to earlier notes:
  - "Nothing is sending" (`EMAIL_ARCHITECTURE_BRIEF_2026-09-16.md` §0) is out of
    date: the key was replaced on 2026-09-16 and `email_sends` shows sends from
    2026-09-19.
  - "`/manage/email` is owner-only in amrit-canada, innergathering and ifac"
    (memory `project_email_architecture`) is wrong for the main working tree.
    `identity-admin.ts` / `canEditEmailIdentity` and those three routes exist only
    as uncommitted files in the worktree `.claude/worktrees/funny-kalam-0c88d9`.
    Only ifac has `/manage/email`, gated by `canManageIfac` (owner, guide,
    configured owner email, or admin).
  - "IFAC has no owner row" is out of date: ifac has 2 owners and 1 guide.
  - "Five apps render the suite": only arts-collective, innergathering and ifac
    mount `@elkdonis/cms-ui/email`; amrit-canada and sunjay have their own
    `EmailSurface` and receive `EMAIL_INBOUND_DOMAIN` without using the Inbox tab.
  - "arts-collective.com has no MX" is out of date: it has MX to SendGrid.
  - "elkdonis-arts.org DKIM is missing from DNS" is out of date: all six domains'
    CNAMEs resolve.
- 2026-09-15 to 2026-09-21: newsletter + migration 128 (09-15); identity layer,
  hardened `sendEmail`, new key, domain authentication, migration 129 (09-16);
  suite, inbound, ledger 134/135 deployed (09-17); IFAC email moved to
  `/manage/email` (09-19); inbound proven with real mail (09-21). Details in the
  archived briefs below.

## Sources

Supersedes `docs/archive/EMAIL_ARCHITECTURE_BRIEF_2026-09-16.md`,
`EMAIL_DNS_RECORDS_2026-09-16.md`, `EMAIL_SUITE_BRIEF_2026-09-17.md`,
`RSVP_EMAIL_TRIGGERS.md`, and memory `project_email_architecture.md`,
`project_email_suite.md`, `project_email_templates_editor.md`,
`project_newsletter_editor.md`.
