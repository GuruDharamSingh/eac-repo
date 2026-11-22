# Email routing on the platform, 2026-11-21

Lane: email (read-only research). Branch `work/2026-11-16`. Measured on eris 2026-11-21 against `elkdonis_dev` (the live DB), the running containers, and public DNS. Guesses are marked **(guess)**. No secret values are shown; env is NAME and SET/empty only.

## Summary

All outbound platform mail goes through one function, `sendEmail` in `packages/email/src/client.ts`, which calls the SendGrid API with one shared key. There is no SMTP path and no second provider. The one exception is GoTrue (Supabase auth), whose mailer is switched off: `GOTRUE_MAILER_AUTOCONFIRM=true` and the SMTP host, user and password are empty. So the platform sends no auth mail at all (no reset, no magic link). The welcome email carries a hand-made confirm link instead (`packages/auth-server/src/api-routes.ts`).

Per-org identity (`site_config` key `email:identity`: From name, From address, reply-to, ASM group, owners, look) is honoured by every call that passes `orgId`. It is ignored by the Art-Auction order and outbid mails (hard-coded name "Art-Auction", no org), the connection-reconnect mail, and the data-deletion notice.

Mail comes back through two SendGrid webhooks hosted only in arts-collective: Inbound Parse (`/api/email/inbound`, signed, key SET) and the Event Webhook (`/api/email/events`, key EMPTY). Measured result: `email_events` has 0 rows and all 197 `email_sends` rows are `queued`. Nothing has ever been recorded as delivered, bounced or unsubscribed. So bounces and spam complaints are blind, and "suppress on bounce" has never fired.

Newsletters and "email everyone who RSVPd" are sent in-request, one SendGrid call per recipient, in sequence. There is no outbox, no retry, no queue. Reminders run from a `setInterval` in five separate app containers plus the series-site package, de-duplicated by the table `thread_reminder_sends`.

DNS is in decent shape for DKIM (s1/s2 CNAMEs on all five sending domains) but weak elsewhere: DMARC is `p=none` or missing everywhere, and the org domains' SPF does not include SendGrid, so mail passes DMARC on DKIM only.

## Map: mail kind to path

Transport is SendGrid API via `sendEmail` unless noted. Sending domain: the org's domain if it is in `EMAIL_AUTHENTICATED_DOMAINS` and the org saved a `fromEmail`, else `em6860.elkdonis-arts.org` (SendGrid link-branded subdomain). Ledger = `email_sends` row when `orgId` is passed.

| Mail kind | Sender code | From / reply-to | Template source | Logged |
|---|---|---|---|---|
| Sign-up welcome + confirm link | `auth-server/src/api-routes.ts` signup, then `sendWelcomeEmail` (`email/src/index.ts:624`) | org identity (orgId resolved from host) / org reply-to | `templates/welcome.tsx` + org overrides (`template-store.ts`) | ledger kind `welcome` (23 rows) |
| Google sign-up welcome | same file, oauth callback | same | same | same |
| Password reset, magic link, GoTrue confirm | none (GoTrue SMTP empty, autoconfirm on) | n/a | n/a | not sent. No forgot-password UI found. |
| RSVP confirm to attendee / owner note | `services/src/rsvp-handler.ts:71` (`sendEmail`), apps `*/api/threads/[id]/rsvp`, `sendRsvpConfirmation`/`sendRsvpNotification` | org identity / org reply-to; owner notice goes to identity `ownerEmails` | `templates/rsvp-guest.tsx`, `rsvp-owner.tsx` | kind `rsvp` (56) |
| Series answer / RSVP | `series-site/src/lib/series-mail.ts` | org identity | `reminder.tsx`, `rsvp-guest.tsx` + series copy | kind `rsvp` / `reminder` |
| Guest RSVP verify, waitlist promote | no code. Atlas lists `guest-rsvp-verify` and `waitlist-promote` with 0 hosts. | n/a | n/a | not sent |
| Meeting reminder | `apps/{sunjay,amrit-canada,elktours,innergathering,ifac}/src/lib/reminders.ts`, series: `series-site/src/lib/reminders.ts`, ticks from each app `instrumentation.ts` | org identity | `templates/reminder.tsx` | kind `reminder` (53) + `thread_reminder_sends` (58 rows) |
| "Email everyone coming" blast | `apps/{sunjay,innergathering}/.../trigger-email/route.ts`, `sendMeetingTriggerEmail` | org identity | `meeting-trigger.tsx` | kind `notification` (61) |
| Newsletter (org list) | `newsletter/src/server.ts:512` `sendNewsletter`, routes in innergathering and hidden-enneagram `api/newsletter/[slug]/send` | org identity + ASM group (List-Unsubscribe only via ASM) | `newsletter` package blocks / `templates/newsletter.tsx` | kind `newsletter`: 0 rows ever sent |
| Series newsletter / mailing | `apps/ifac/.../api/newsletter/series/[id]/[slug]/send` + `ifac/src/lib/series-mail*.ts` | org identity | newsletter blocks | kind `newsletter` (0 rows) |
| Contact form to owner | `silex-render/src/contact.ts` (`sendContactNotification`), `apps/ifac/api/signup`, `apps/innergathering/api/contact`; `danamccool/api/contact` sends nothing | org identity / reply-to = visitor | `contact-owner.tsx` | kind `contact` (4) |
| Booking confirm/request/cancel/reminder | `booking/src/server/notify.ts:64` (`notify`) | org identity but reply-to overridden by the host | hand-built inline HTML in notify.ts, not the template store | kind `order`/`reminder`; 0 `order` rows ever |
| Tour / service order mail | `commerce/src/server/tours.ts:769`, `service-bookings.ts:517` | org identity, reply-to overridden | inline HTML | kind `order`, 0 rows |
| Shop orders: invoice, owner order notice | `sendOrderInvoice` / `sendOrderNotification` (`email/src/index.ts:569, 606`) | `fromName: 'Art-Auction'` hard-coded, no `orgId`, so no org identity | `order-invoice.tsx`, `order-notification.tsx` | not in ledger (no orgId) |
| Outbid, proceeds statement | `sendOutbidEmail`, `sendProceedsStatementEmail` | same hard-coded name, no orgId | `outbid.tsx`, `proceeds-statement.tsx` | not in ledger |
| Shipping label / shipped | `commerce/src/server/shipping-label.ts:283` | org identity | inline HTML | kind `order` |
| Series partner invite | `commerce/src/server/series-social.ts:495` | org identity | inline HTML | ledger |
| Provisioning / member welcome | `sendProvisioningEmail` (`index.ts:656`) | per call | `provisioning.tsx` | per call |
| Guide answered a learner | `apps/sophia/src/lib/connectors.ts:116` | hard-coded `orgId: "elkdonis"` | inline HTML | ledger kind default `notification` |
| Guide availability (elktours) | `apps/elktours/src/lib/availability-actions.ts:144`, `Promise.all` over recipients | org identity, reply-to = the guide | inline HTML | ledger |
| Meta reconnect warning | `services/src/connection-maintenance.ts:61` | no orgId: network From, name "Elkdonis Arts Collective" | inline HTML | not in ledger |
| Data-deletion request notice | `arts-collective/.../api/data/delete/route.ts:13`, innergathering twin | no orgId; reply-to = the requester | inline HTML | not in ledger |
| Inbox reply by an org | `apps/ifac/.../hub/email/reply/route.ts:67` | org identity | plain text wrapped in HTML | kind `contact`, tag `inbox-reply` |
| Test send | `apps/{ifac,innergathering}/.../hub/email/[key]/test` and `email-doctor.mts` | org identity | org template | `noLedger` for doctor |
| Admin/ops mail | none beyond the above. Admin has an `email-templates` preview page only (`apps/admin/src/app/email-templates/page.tsx`). | n/a | `@elkdonis/email` renderers | n/a |

Template layers: React Email components in `packages/email/src/templates`, org copy overrides in `email_template_settings` (inner_group 5 rows, sunjay 1), and an org-laid-out version made in the newsletter editor (`template-store.ts`). Booking, commerce, sophia, services and several app mails bypass all three and write inline HTML.

Mail-making in Silex: no Silex-to-email path found. `silex-render/src/contact.ts` only sends the contact notification. **(guess)** Silex is not a mail template source.

## Per-org identity (`org-email`)

- Storage: `site_config(org_id, 'email:identity')`, read by `getOrgEmailIdentity` (`packages/email/src/identity.ts`, 60 s cache). Fields: fromEmail, fromName, replyTo, ownerEmails, asmGroupId, palette, inboundReplies.
- Capability: registry entry `org-email` (`packages/actions/src/registry-data.ts:119`), confirm text "Send {org}'s mail as "{name}", replies to {email}. Everyone who gets its mail sees this." The runner (`actions/src/server/run.ts:333`) saves only `fromName` and `replyTo`. `fromEmail` is left out on purpose and is only settable in the hub email suite. If `inboundReplies` is on, the runner will not change reply-to.
- From-address rule: a requested `fromEmail` is used only if its domain is in `EMAIL_AUTHENTICATED_DOMAINS` (SET: ifacgroup.com, amritcanada.ca, hiddenenneagram.com, arts-collective.com, elkdonis-arts.org). Otherwise it silently falls back to `info@em6860.elkdonis-arts.org` with a console warning.
- Identity rows now: 6 of 25 orgs (elkdonis, danamccool, inner_group, amrit_canada, ifac, hidden-enneagram). Live senders without a row: sunjay, elktours, katie-the-potter, pigeonshoot and others. They fall back to the network From and the org's name.
- Per row: ifac has its own From (info@ifacgroup.com) and look. amrit_canada has From info@amritcanada.ca. elkdonis and inner_group send as info@elkdonis-arts.org. hidden-enneagram and danamccool have no `fromEmail`, so they send from the em6860 network address. hidden-enneagram has no replyTo and no ownerEmails, and `EAC_OWNER_EMAIL` is empty in its container.
- Honours it: everything passing `orgId` (RSVP, reminders, newsletter, contact, booking, tours, shipping, welcome). Ignores it: the Art-Auction shop mails, Meta reconnect, data-deletion, and `replyTo` in booking and commerce (explicit host reply-to wins, which is probably intended).

## Inbound and feedback

- Reply-to targets: org identity `replyTo` (a person's own inbox: info@elkdonis-arts.org, info@ifacgroup.com, gurudharamsingh@gmail.com, danamccoolart@gmail.com), or the visitor's address for owner notices. No org has `inboundReplies` set.
- Inbound Parse: one host, `inbound.elkdonis-arts.org` (MX 10 mx.sendgrid.net), URL `https://arts-collective.com/api/email/inbound`, tenancy in the address (`ifac@inbound...`, `ifac.<thread>@inbound...`). Table `email_inbox`: 23 rows (ifac 22, amrit_canada 1), latest 2026-11-20. Signed with `SENDGRID_INBOUND_PUBLIC_KEY` (SET in `.env` and in eac-arts-network). So inbound works and is verified.
- Event Webhook: `/api/email/events`, same container only. `SENDGRID_EVENT_PUBLIC_KEY` is absent from `.env` and empty in eac-arts-network. Unset means the route accepts unsigned events and logs a warning. Either way `email_events` has 0 rows, so SendGrid is not delivering events here (guess: the webhook is not enabled in the SendGrid dashboard). This is the held security item #1.
- Bounces and suppression: `ingestEvents` (`email/src/ledger.ts`) turns bounce, dropped, spamreport and unsubscribe events into `contacts.status='unsubscribed'`. It has never run. `sendEmail` itself checks no suppression (`client.ts`). Only `listRecipients` in `newsletter/src/server.ts` filters `unsubscribed`, so confirmations, reminders and blasts still go to an unsubscribed address (already noted in `docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md:283`).
- Unsubscribe: footer link plus signed token (`unsubscribeToken`; `NEWSLETTER_SECRET` empty everywhere, `INTER_APP_JWT_SECRET` SET and used as fallback). `/unsubscribe` pages exist only in hidden-enneagram and innergathering; ifac has `/api/series/unsubscribe`. The List-Unsubscribe header exists only when the org has an `asmGroupId`: 6 orgs have one, the others get none.
- Opt-in tables: `contacts` (org-scoped; status new/contacted/unsubscribed; sources rsvp, contact-form, ifac_signup, silex-site, landing-page, ifac_rsvp: 14 rows) and `org_followers`. **(guess)** There is no separate consent or double-opt-in record.

## Queues and limits

- No outbox table, no retry, no worker. A failed send throws and is logged `failed` if there is an `orgId`. The newsletter counts the failure and moves on; there is no way to resend the failures.
- Sends are synchronous in the request, one HTTP call per recipient. The newsletter loop is sequential (deliberate). The elktours availability mail uses `Promise.all`.
- Reminders: in-process `setInterval` every 5 min per app (sunjay, amrit-canada, elktours, innergathering, ifac, artdirect, fourthwayBookreaders instrumentation). The ledger row is inserted before sending, so a failed send loses that reminder **(guess, from `sunjay/src/lib/reminders.ts:53` then `:130`)**. `DISABLE_REMINDER_SCHEDULER=1` turns it off.
- Dev guard: no key outside production returns `skipped`. In production a missing key throws. `EMAIL_SANDBOX=1` validates without delivering (empty now). Test sends pass `noLedger`. NODE_ENV is production in all main app containers; eac-admin is development and has no mail env.

## DNS (dig on eris, 2026-11-21)

| Domain | MX | SPF | DMARC | DKIM |
|---|---|---|---|---|
| arts-collective.com | 0 mx.sendgrid.net | `v=spf1 a mx include:websitewelcome.com ~all` (no sendgrid) | `v=DMARC1; p=none` | s1/s2 CNAME to u54282917.wl168.sendgrid.net; `default` TXT (Bluehost) |
| elkdonis-arts.org | 10 elkdonis-arts.org, 0 mail.elkdonis-arts.org | `ip4:50.6.19.65 a mx include:websitewelcome.com ~all` | `p=none` | s1/s2 SendGrid CNAME; `default` TXT |
| em6860.elkdonis-arts.org | u54282917.wl168.sendgrid.net, 20 mx.sendgrid.net | `include:sendgrid.net ~all` | none | link-brand CNAME em6860 to u54282917.wl168.sendgrid.net |
| inbound.elkdonis-arts.org | 10 mx.sendgrid.net | none | none | none |
| ifacgroup.com | 10 ifacgroup.com, 0 mail.ifacgroup.com | `a mx include:websitewelcome.com ~all` | `p=none` | s1/s2 SendGrid CNAME; `default` TXT |
| amritcanada.ca | 0 mail.amritcanada.ca | `ip4:50.6.19.65 a mx include:websitewelcome.com ~all` | `p=none` | s1/s2 SendGrid CNAME; `default` TXT |
| hiddenenneagram.com | 0 mail.hiddenenneagram.com | `a mx include:websitewelcome.com ~all` | none | s1/s2 SendGrid CNAME; `default` TXT |

Reading it: DKIM from SendGrid is aligned for all five org domains, so DMARC passes through DKIM. The envelope sender is the em6860 subdomain, so SPF does not align for org-domain From addresses. The org SPF records do not include sendgrid.net. That is fine for DMARC today but fragile if DKIM breaks. `arts-collective.com` MX points at SendGrid, so any mail to `@arts-collective.com` goes to SendGrid; whether a Parse host exists for it is unknown **(guess: none, so such mail is dropped)**. I did not run `dig` for other org domains (katie, sunjay and elktours domains) because they have no sender identity.

## Env (names and SET/empty only)

| Name | .env | arts-network | sunjay | elktours | supabase-auth | admin |
|---|---|---|---|---|---|---|
| SENDGRID_API_KEY | SET | SET | SET | SET | n/a | absent |
| SENDGRID_EVENT_PUBLIC_KEY | absent | empty | n/a | n/a | n/a | n/a |
| SENDGRID_INBOUND_PUBLIC_KEY | SET | SET | n/a | n/a | n/a | n/a |
| EMAIL_FROM | SET (info@em6860.elkdonis-arts.org) | same | same | same | n/a | absent |
| EMAIL_FROM_NAME | absent | empty | absent | absent | n/a | absent |
| EMAIL_AUTHENTICATED_DOMAINS | SET (5 domains) | same | same | same | n/a | absent |
| EMAIL_SANDBOX | absent | empty | absent | absent | n/a | absent |
| EMAIL_INBOUND_DOMAIN | SET | SET | SET | SET | n/a | absent |
| NEWSLETTER_SECRET | absent | empty | empty | empty | n/a | n/a |
| INTER_APP_JWT_SECRET (fallback) | n/a | SET | SET | SET | n/a | n/a |
| SMTP_HOST / USER / PASS | empty | n/a | n/a | n/a | n/a | n/a |
| GOTRUE_SMTP_HOST / USER / PASS | n/a | n/a | n/a | n/a | empty | n/a |
| GOTRUE_SMTP_ADMIN_EMAIL | SET | n/a | n/a | n/a | admin@example.com | n/a |
| GOTRUE_MAILER_AUTOCONFIRM | absent | n/a | n/a | n/a | true | n/a |
| EAC_OWNER_EMAIL | SET | n/a | n/a | n/a | n/a | n/a |
| per-org owner email names | n/a | n/a | SUNJAY_OWNER_EMAIL SET | ELKTOURS_OWNER_EMAIL SET | n/a | n/a |

Also checked: eac-ifac, innergathering, amrit-canada and katie-the-potter have the key SET. hidden-enneagram has `EAC_OWNER_EMAIL` empty. `EMAIL_INBOUND_DOMAIN` is absent in hidden-enneagram and katie-the-potter. `CRON_SECRET` and `UNSUBSCRIBE_SECRET` are not used by mail (absent/empty).

## Problems, ranked

### Broken (mail not sent, or wrong sender)
1. **No auth mail at all.** `eac-supabase-auth` has `GOTRUE_SMTP_HOST` empty and `GOTRUE_MAILER_AUTOCONFIRM=true`. There is no password reset or magic link, and no forgot-password UI exists in apps/packages (grep). A person who loses a password cannot recover it without an admin.
2. **Delivery state is blind.** `email_events` = 0 rows, `email_sends` 197 of 197 `queued`. Bounces and complaints are never seen, so suppression never fires. Cause: Event Webhook not enabled or not signed in SendGrid, and `SENDGRID_EVENT_PUBLIC_KEY` unset (docs: `HOUSEKEEPING_2026-10-18.md:371-402`).
3. **Shop and auction mail ignores org identity.** `packages/email/src/index.ts:569-620`: no `orgId`, `fromName: 'Art-Auction'`. Katie's buyers (katie-the-potter uses `sendOrderInvoice`/`sendOrderNotification`, per the compose comment at line 1949) see "Art-Auction" from the em6860 address. No ledger row either. **(guess: katie's order mail has not yet been exercised; 0 `order` rows)**
4. **Orgs with no sender row send as the network.** sunjay (31 sends), elktours, katie, pigeonshoot: From `info@em6860.elkdonis-arts.org`, with no reply-to, so a reply goes to a SendGrid-MX subdomain **(guess: bounces or drops)**. hidden-enneagram and danamccool have a row but no `fromEmail`, replyTo or owners (HE `EAC_OWNER_EMAIL` empty, so owner notices have no recipient).
5. **Documented-but-missing mails.** Atlas lists `guest-rsvp-verify` and `waitlist-promote` as capabilities with 0 hosts. elktours has waitlist UI (`rsvp-panel.tsx`) but no code sends "a place opened" mail. **(guess)**
6. **Reminders can be lost.** Ledger row is written before the send (`sunjay/src/lib/reminders.ts`), so a SendGrid failure means no retry.

### Risky (deliverability or security)
1. **Event webhook is unauthenticated when its key is unset.** `apps/arts-collective/src/app/api/email/events/route.ts` accepts unsigned events and suppresses addresses network-wide. Today it is harmless only because nothing arrives. The moment the dashboard webhook is turned on without the key, anyone can forge a bounce. Fix order: key first, then dashboard, or make the route refuse when the key is empty. The inbound route has the same fail-open shape, but its key is SET.
2. **DMARC `p=none` everywhere, none on hiddenenneagram.com and em6860.** No enforcement, and no `rua` reports. SPF on org domains omits sendgrid.net, and the envelope domain is em6860, so only DKIM carries DMARC.
3. **No suppression check on transactional sends** (`client.ts`). An unsubscribed address still gets confirmations, reminders and blasts.
4. **List-Unsubscribe only with an ASM group**: orgs without a row (sunjay, elktours, katie) send newsletters or bulk blasts without the header or an ASM group. `/unsubscribe` pages exist in only 2 apps; links from other apps' mail depend on `baseUrl` **(guess)**.
5. **One shared SendGrid key and sender reputation for all 25 orgs.** `Feedback-ID` and categories help, but a spam spike from one org hurts all.
6. **arts-collective.com MX is SendGrid.** Anything mailed to a human at that domain bypasses a mailbox **(guess)**.
7. **In-request sending.** Large lists in a web request, with no resume. The elktours availability mail fans out with `Promise.all`.
8. **Stale comment:** `apps/danamccool/src/app/api/contact/route.ts` says the key is a placeholder and nothing is emailed. The key is now SET, so the route still sends nothing, and Dana gets no notice of contact messages.

### Duplicated
1. **Reminder code x5 plus series-site.** `apps/{sunjay,amrit-canada,elktours,innergathering,ifac}/src/lib/reminders.ts` differ by 20 to 256 diff lines; `packages/series-site/src/lib/reminders.ts` is a sixth path (386 lines). Each app also has its own scheduler in `instrumentation.ts`.
2. **Email suite per app**: `apps/{arts-collective,ifac,innergathering}/src/lib/email-suite.ts` (505 lines) plus identity, template, address and message routes duplicated in arts-collective (`api/org/[slug]/email/*`), ifac and innergathering (`api/hub/email/*`).
3. **Newsletter send routes**: innergathering, hidden-enneagram and ifac series each have their own `send` route. All end in `sendNewsletter`.
4. **Inline HTML mail** in booking, commerce, sophia, services, elktours, bypassing the template store and org look (about 8 senders).
5. **Owner-email resolution**: five legacy env names (`LEGACY_OWNER_ENV` in identity.ts) beside `ownerEmails` in site_config, and `silex-render/contact.ts` resolves the owner by its own SQL.
6. **Org-identity edit**: three hosts for `save-org-email-identity`, plus the `org-email` runner (same service, `fromEmail` left out).

## Recommendations

1. One mail service: make `sendEmail` the only door. Require `orgId` (type error without it). Move the Art-Auction, reconnect and data-deletion mails to it. Add a suppression check inside `sendEmail`, honoured by every kind.
2. One outbox and one log: an `email_outbox` table (queued, sent, failed, attempts, next_try) drained by one worker. Retire per-app reminder schedulers and the in-request newsletter loop, and keep `email_sends` as the log with events joined in.
3. Close the loop on feedback: set `SENDGRID_EVENT_PUBLIC_KEY`, recreate `eac-arts-network`, then enable the signed Event Webhook. Make the events route refuse when the key is empty.
4. Per-org identity everywhere: give every live org a row (sunjay, elktours, katie), `fromEmail` on its own authenticated domain, a reply-to that is a monitored address, and an ASM group. Show "uses network sender" as a status in the dock.
5. One template source: put booking, order, sophia and connection mail into `template-store` keys, so the org look applies and editors can change the words.
6. Auth mail: either point GoTrue at SendGrid SMTP (`smtp.sendgrid.net`, user `apikey`) or add a SendGrid-backed reset link; then turn on autoconfirm only deliberately.
7. DNS: add `include:sendgrid.net` to the org SPF records, DMARC `p=none` with `rua=` to a mailbox, then move to quarantine after a month of clean reports. Add DMARC to hiddenenneagram.com.

## Gaps for the dock / MCP

- `org-email` sets name and reply-to only. There is no dock capability for the From address, the ASM group, the owner notification list, or the inbound-replies switch (`save-org-email-identity` is hub-only for those).
- Newsletter course steps with no capability: write letter (`pkg-newsletter-letter`) and send (`pkg-newsletter-send`) exist as atlas capabilities, and `grep org-email` shows only that one email id in the dock registry, so I found no dock entry for either (guess: not wired). There is no "send a test to me", no audience choice, no "schedule", no "resend to failures".
- No capability for: read delivery state (sent, bounced, unsubscribed) of a send, stop or resume email to an address from the dock (hub-only `stop-email-to-address`), or the inbox (`mark-inbox-message`, reply). The atlas tracks `site-production-email` has only `email-identity` as a step.
- `guest-rsvp-verify` and `waitlist-promote` are capabilities with no host. They are promises with no code behind them.
- A "check my mail is set up" read (From domain authenticated, reply-to monitored, ASM set, events live) is missing. The data is there (`fromIsOrgDomain`, `email_sends` status).
