# Email architecture brief — 2026-09-16

Scope: `@elkdonis/email`, `@elkdonis/newsletter`, and the send paths in **IFAC**,
**Amrit Canada**, **innergathering**, **hidden-enneagram**. Written after an
audit of the repo against SendGrid's documented capabilities, using the
`twilio-developer-kit` plugin skills and the Twilio/SendGrid docs MCP server
that are attached to this session.

---

## 0. Stop here first: nothing is sending

`.env` still carries the literal placeholder from `.env.example`:

```
SENDGRID_API_KEY=your-sendgrid-api-key
```

`docker-compose.yml` passes that same value into all ten app services
(`SENDGRID_API_KEY: ${SENDGRID_API_KEY}`, lines 393, 477, 692, 772, 834, 948,
1021, 1068, 1125). And [`client.ts:13-17`](packages/email/src/client.ts:13)
treats an absent key as a no-op:

```ts
if (!apiKey) {
  console.warn('[email] SENDGRID_API_KEY not set — skipping');
  return;
}
```

The key is present but invalid, so it does not take that branch — it reaches
SendGrid and 401s. Either way **every RSVP confirmation, owner notification,
reminder and contact-form email across all four orgs is being lost.**

How that failure surfaces is worth stating exactly, because it is the reason
this has gone unnoticed. The send is fire-and-forget at every call site — `void
(async () => { … })()` with a `try/catch` that `console.error`s (e.g.
[ifac rsvp route:84](apps/ifac/src/app/api/rsvp/route.ts:84), and the same shape
in amrit-canada and innergathering). So the 401 *is* logged, into container
stdout that nobody reads, while the visitor gets `{ ok: true }` and the org owner
gets no notification and no indication that one was owed. The RSVP itself is
still recorded — that part is deliberate and correct — but nobody is told.

The newsletter sender is the one honest path — it refuses up front
([`server.ts:280`](packages/newsletter/src/server.ts:280)) precisely because it
knew this trap existed.

**Resolved 2026-09-16, later the same day.** A fresh key was issued and put in
`.env`. It has the canonical `SG.<22>.<43>` shape, authenticates (`GET /v3/scopes`
→ 200) and carries `mail.send`. The containers still hold the old placeholder in
their environment until they are recreated — `docker compose up -d` on the
individual services, *not* a blanket `up -d`, because arts-collective's `.next`
is empty and must not be restarted until it builds.

One note on the key itself: it came back with 208 scopes, i.e. **full access**.
For containers that only ever call Mail Send, a restricted key limits the blast
radius if an app image or env ever leaks. Worth downgrading once things are
stable.

**The key is not anywhere else, either.** Searched and came up empty: the whole
working tree for an `SG.<22>.<43>`-shaped string; all five `.env` backups going
back to 2026-05-30 (identical 21-char placeholder in every one); git history
across all branches; the `.next` / `.next.bak` `required-server-files.json` build
outputs that bake env at build time; `SMTP_PASS` (SendGrid's SMTP relay uses the
API key as the password — it is empty); and the live environment of all six
running containers, including the old `eac-inner-gathering`, which carries the
same placeholder.

The account itself is real — `em6860.elkdonis-arts.org` is a SendGrid-generated
sending subdomain, so domain authentication was completed for elkdonis-arts.org
at some point. Only the key went missing. SendGrid shows an API key exactly once
at creation, so it most likely was never saved outside the console: the fix is
to issue a fresh key with Mail Send permission rather than to keep looking.

Two smaller env facts:
- `EMAIL_FROM_NAME` is never set, so every mail is signed "Elkdonis Arts Collective".
- `NEWSLETTER_SECRET` is unset but falls back to `INTER_APP_JWT_SECRET`, which
  *is* set — unsubscribe tokens will verify. No action needed.

---

## 1. What tooling this session actually has

| Tool | State | What it is good for here |
|---|---|---|
| `twilio-developer-kit` plugin — 8 SendGrid skills | **available, no auth** | `sendgrid-email-send`, `-suppressions`, `-webhooks`, `-deliverability-advisor`, `-engagement-quality`, `-email-settings`, `-inbound-parse`, `-account-setup` |
| `twilio-docs` MCP (`twilio__search` / `twilio__retrieve`) | **available, no auth** | live SendGrid docs *and* the v3 API index — exact request schemas for `/v3/asm/groups`, `/v3/mail/send`, `/v3/suppression/*` |
| ~45 further Twilio skills (SMS, Verify, Studio, TaskRouter) | available | only relevant if reminders ever go to SMS as well as email |
| `intuit-mailchimp` connector | **needs OAuth**, unauthorised | not a path; SendGrid is already the substrate |

So: no new dependency is needed to mature this. The plugin is documentation and
recipes, not a runtime — `@sendgrid/mail` stays the client.

**One thing the tooling confirms we should *not* do:** move templates to
SendGrid Dynamic Templates (`d-…` ids). The React Email templates in
`packages/email/src/templates/` are versioned, reviewable and diffable; dynamic
templates live in a console with no code review and fail *silently* on a typo'd
variable ("Undefined template variables render as empty strings"). Keep
rendering in-repo.

---

## 2. What is wrong with the shared package, specifically

### 2.1 One sender identity for a network of unrelated organisations

Every org has its own verified primary domain in `org_domains`:

| org_id | primary domain |
|---|---|
| `ifac` | ifacgroup.com |
| `amrit_canada` | amritcanada.ca |
| `inner_group` | elkdonis-arts.org |
| `hidden-enneagram` | hiddenenneagram.com |

…and every email from every one of them goes out as
`info@em6860.elkdonis-arts.org`, named "Elkdonis Arts Collective"
([`client.ts:21-22`](packages/email/src/client.ts:21)). An IFAC collector RSVPs
to an IFAC event and gets mail from a spiritual arts collective they have never
heard of. Amrit Canada is the same. That is the single largest deliverability
and trust problem in the setup, and it is four lines of code plus DNS.

`fromName` is passed at *some* call sites (`sendRsvpConfirmation`,
`sendReminderEmail`, `sendNewsletterEmail`) and hardcoded at others —
`'Art-Auction'` at [`index.ts:123`](packages/email/src/index.ts:123), and
`sendWelcomeEmail` hardcodes the subject "Welcome to Elkdonis Arts Collective"
([`index.ts:151`](packages/email/src/index.ts:151)) regardless of which org the
person joined.

### 2.2 Suppressions are global — one org's spam complaint silences the others

From the SendGrid account-structure docs: *"a bounce or spam report on ANY email
suppresses the address from ALL future sends."* Today all four orgs share one
account and one suppression list. A member of two orgs who marks an IFAC
newsletter as spam stops receiving Amrit Canada's **RSVP confirmations** — a
transactional mail they explicitly asked for.

### 2.3 Sends carry no org identity at all

`sendEmail` sends `to / from / subject / html / replyTo` and nothing else. No
`categories`, no `custom_args`, no `asm`. Consequences:

- SendGrid's own stats cannot be broken down per org — one undifferentiated bar chart.
- Event webhooks (when added) could not be attributed back to an org or a thread.
- No `Feedback-ID` header, so Google Postmaster Tools cannot tell you *which*
  org's mail is generating complaints.

### 2.4 Nothing ever comes back

There is no Event Webhook endpoint anywhere in the repo. The Mail Send API
returns `202 Accepted` (queued), never "delivered" — delivery, bounce, block,
spam report and unsubscribe are **only** knowable via webhook. Right now:

- a hard-bounced address stays in `contacts` forever and is retried on every send;
- `newsletter.sentCount` records *attempts*, not deliveries, and is shown to the
  editor as though it were the latter;
- a spam complaint is invisible until reputation is already damaged.

### 2.5 The unsubscribe is legally sound but mechanically old-fashioned

[`withUnsubscribe`](packages/newsletter/src/server.ts:233) appends an HMAC-token
footer link, and migration 128 made `unsubscribed` a terminal `contacts.status`
that [`listRecipients`](packages/newsletter/src/server.ts:154) filters centrally.
That is good work and it satisfies CASL's visible-unsubscribe requirement.

What it does not produce is the `List-Unsubscribe` / one-click header that Gmail
and Yahoo want. **Accuracy note:** that requirement binds *bulk senders*, defined
as >5,000 messages/day to a given provider. With 6 contacts across all four orgs
you are nowhere near it, so this is a "build it right now while it's cheap",
not an emergency. A SendGrid ASM group gets you the header for free.

### 2.6 Reminders exist in one app out of four

| app | RSVP mail | trigger/blast | scheduled reminders | newsletter |
|---|---|---|---|---|
| amrit-canada | ✅ | ✅ | ✅ `lib/reminders.ts` + `instrumentation.ts` | ❌ |
| innergathering | ✅ | ✅ | ❌ | ❌ |
| ifac | ✅ | ❌ | ❌ | ❌ |
| hidden-enneagram | ❌ | ❌ | ❌ | ✅ (only app with it) |

Every capability that exists, exists in exactly one place. `runReminderTick`
([`reminders.ts:25`](apps/amrit-canada/src/lib/reminders.ts:25)) is already
org-parameterised in everything but name — it reads `siteConfig.orgId` and is
otherwise generic, with a sound single-winner claim
(`INSERT … ON CONFLICT DO NOTHING` on `thread_reminder_sends`). It is one
argument away from being shared.

Its driver is the weak part: an in-process interval in `instrumentation.ts`
fires per container, so it stops when the container restarts and doubles if the
app is ever scaled.

### 2.7 Recipient sources and owner addresses are scattered

Three unrelated notions of "audience":
- `contacts` (newsletter),
- `thread_rsvps ∪ guest_submissions` (reminders and blasts),
- owner addresses in env vars, under five different naming conventions —
  `EAC_OWNER_EMAIL`, `AMRIT_CANADA_OWNER_EMAIL`, `INNERGATHERING_OWNER_EMAIL`,
  `NEXT_PUBLIC_IFAC_OWNER_EMAIL`, `NEXT_PUBLIC_DANAMCCOOL_OWNER_EMAIL`.

The `NEXT_PUBLIC_` ones ship the org's contact address into the browser bundle
for scrapers — minor, but it is a real change of audience for that value.

There is also no consent record: nothing stores *when* and *how* a contact
opted in, which is the evidence CASL asks for if a complaint is ever made.

---

## 3. Recommended shape

### Decision 0 — one SendGrid account, or a subuser per org?

The docs make this a genuine fork:

- **Subuser per org** gives **true** suppression isolation ("a recipient no longer
  receives email from Customer A but still receives email from Customer B"),
  separate stats, and separate teammate access — the parent can generate a
  domain-auth record and assign one to each subuser, which fits one-org-per-
  subuser exactly. Cost: N accounts to administer, and subusers require a paid
  plan tier — **verify your current plan before designing around this**.
- **One account + categories + ASM groups** gives per-org analytics and per-org
  *unsubscribe* scoping, but bounces and spam reports stay global.

**Settled by the account itself: `GET /v3/subusers` returns 403 — subusers are
not available on the current plan.** So this is not a choice today. The design is
one account + per-org categories + per-org ASM groups, and the code should keep
the subuser path as a config value (`orgEmailIdentity.subuserAuth`) so an upgrade
later is configuration rather than a rewrite.

That makes per-org domain authentication the *load-bearing* step rather than a
nice-to-have — it is the only per-org isolation available on this plan.

### Live account state, read 2026-09-16

Read directly from the API with the new key, so this is measured rather than assumed:

| Check | Result | Consequence |
|---|---|---|
| Authenticated domains | 4 records, **only `em6860.elkdonis-arts.org` is valid**; `em1058`, `em3691`, `em8298` are stale failed attempts on the same domain | ifacgroup.com, amritcanada.ca and hiddenenneagram.com have **no** domain auth at all |
| ASM unsubscribe groups | **0** | nothing to attach `asm.group_id` to yet; four need creating |
| Event webhook | **disabled**, no URL | confirms §2.4 — nothing comes back |
| Subusers | **403** | not on this plan; see Decision 0 |
| Bounces / spam reports / blocks | **5 / 0 / 0** | mail *was* sent from this account at some point before the key was lost, and it has a clean complaint record |

The domain finding sharpens the ordering below. Switching `From:` to
`info@ifacgroup.com` **before** authenticating ifacgroup.com would be worse than
the status quo: an unauthenticated From fails SPF and DKIM, and per SendGrid's
own guidance Gmail and Yahoo now reject that outright. Authenticate first, then
switch — per org, one at a time.

Also worth a few minutes: delete the three invalid `elkdonis-arts.org` whitelabel
records so the console shows one true answer per domain.

### Layer 1 — `getOrgEmailIdentity(orgId)`, in the database, not in env

One resolver in `@elkdonis/email`, backed by a `site_config` key
(`email:identity`, matching the `newsletter:<slug>` and `puck:<slug>`
precedent — no migration needed) with an env fallback:

```ts
interface OrgEmailIdentity {
  orgId: string;
  fromEmail: string;        // info@ifacgroup.com
  fromName: string;         // International Fine Art Collectors
  replyTo?: string;
  ownerEmails: string[];    // replaces the five env conventions
  asmGroupId?: number;      // SendGrid unsubscribe group, per org
  categoryPrefix: string;   // 'ifac'
}
```

This one change fixes 2.1 and the env sprawl in 2.7, and gives every later layer
somewhere to hang.

### Layer 2 — harden `sendEmail`

```ts
export async function sendEmail(opts: SendEmailOptions & {
  orgId: string;
  kind: 'rsvp' | 'reminder' | 'newsletter' | 'notification' | 'welcome' | 'order';
  threadId?: string;
}): Promise<{ messageId: string | null; sandboxed: boolean }>
```

- resolve `from`/`replyTo` from the identity;
- `categories: ['org:<orgId>', 'kind:<kind>']` (max 10, we use 2);
- `customArgs: { orgId, kind, threadId }` — these come back on every webhook event;
- `asm: { groupId }` for anything bulk — this is what emits `List-Unsubscribe`;
- `headers: { 'Feedback-ID': '<kind>:<orgId>:eac' }` for Google Postmaster attribution;
- `mailSettings.sandboxMode` when `EMAIL_SANDBOX=1`, so tests and seed scripts
  validate a real request without delivering (returns 200, not 202);
- **throw, don't warn**, when the key is missing and `NODE_ENV=production`.
  Section 0 is the argument for this line.
- return the `x-message-id` so it can be written to the ledger below.

### Layer 3 — `email_sends` ledger + a signed event webhook

The largest single maturity jump. A migration adding:

```
email_sends(id, org_id, kind, thread_id, to_email, sg_message_id,
            status, sent_at, updated_at)
email_events(sg_event_id PK, sg_message_id, org_id, event, reason, occurred_at)
```

and one shared route (`/api/email/events`) mounted per app or, better, once on
admin:

- parse the **array** SendGrid posts (batched, not one object per request);
- verify `X-Twilio-Email-Event-Webhook-Signature` (ECDSA P-256) — the endpoint is
  unauthenticated otherwise and anyone could POST fake bounces;
- dedupe on `sg_event_id` (stable across SendGrid's 24h retries);
- on `bounce` / `dropped` / `spamreport` / `unsubscribe`, update `contacts.status`
  — this is what finally closes the loop that 2.4 leaves open;
- return 2xx always, or SendGrid retries for a day.

Treat `event.reason` as untrusted — it is text from a third-party mail server.

### Layer 4 — one scheduler

Move `runReminderTick` to `@elkdonis/services` taking `(orgId, appOrigin)`,
drop the `siteConfig` import, and drive it from a single scheduled job rather
than four `instrumentation.ts` intervals. IFAC, innergathering and
hidden-enneagram then get reminders by configuration instead of by porting a
file for the third time.

### Layer 5 — the GrapesJS newsletter editor

The foundation is good: separate editor instance (correct — loading the
newsletter preset over a Silex project would rewrite it), project JSON *and*
inlined HTML both stored, juice inlining in-browser, central unsubscribe
filtering. Five things would mature it:

1. **ASM group instead of the hand-rolled footer.** Keep the footer for the
   visible CASL text; add `asm.groupId` so SendGrid adds the one-click header
   and records the unsubscribe on its side too. Your `contacts.status` stays the
   source of truth; SendGrid's group becomes a belt-and-braces second filter.
2. **Batch with `personalizations`.** Up to 1,000 recipients per call, one
   personalization each (recipients in the same `to` array can see each other).
   The current loop is one HTTPS round-trip per person — correct and safe at six
   contacts, untenable at six hundred.
3. **Scheduled send.** Request a `batch_id` from `/v3/mail/batch` *before*
   sending, pass `send_at` — **Unix seconds, not `Date.now()`**, which is
   silently rejected as >72h — and you get "send Tuesday 9am" plus a working
   Cancel button (`POST /v3/user/scheduled_sends`). Ceiling is 72 hours.
4. **Real send stats.** Replace `sentCount` (attempts) with a read of the
   `email_events` ledger: sent / delivered / bounced / unsubscribed. An editor
   staring at "sent to 240" deserves to know 31 of them bounced.
5. **Lift the routes out of hidden-enneagram.** The four files under
   `apps/hidden-enneagram/src/app/{api/newsletter,manage/newsletter,unsubscribe}`
   are org-agnostic apart from an orgId and an auth check — a shared route
   factory gives Amrit Canada, IFAC and innergathering a newsletter for roughly
   the cost of reading this paragraph.

---

## 4. Suggested order

| # | Work | Unblocks |
|---|---|---|
| 1 | Real `SENDGRID_API_KEY` in `.env`; recreate containers | literally everything |
| 2 | Authenticate ifacgroup.com / amritcanada.ca / hiddenenneagram.com + DMARC `p=none`; bin the 3 stale elkdonis records | `From:` that matches the org — **hard prerequisite** for step 3 |
| 3 | ~~Layer 1 — `getOrgEmailIdentity`~~ **DONE** | per-org From/reply-to/owners |
| 4 | ~~Layer 2 — `sendEmail` categories, custom args, sandbox, throw-in-prod~~ **DONE** | attribution; no more silent loss |
| 5 | Layer 3 — ledger + signed webhook | bounce handling, real stats |
| 6 | Layer 5.1–5.3 — ASM group, batching, scheduling | the newsletter becomes a product |
| 7 | Layer 4 — shared reminder tick | reminders for the other three orgs |
| 8 | Layer 5.5 — shared newsletter routes | newsletter for the other three orgs |

Steps 1 and 2 are configuration, not code, and they are worth more than 3–8
combined.

---

## 5. Adjacent, deliberately not proposed

The same plugin carries Twilio Verify, Messaging and Studio skills, so an SMS
reminder alongside the email reminder is a small step once Layer 4 exists. It is
noted here only so it is not rediscovered as a surprise — it is not part of this
brief, and it brings A2P 10DLC registration with it, which is its own project.


---

## 6. Built 2026-09-16 — Layers 1 and 2

**`packages/email/src/identity.ts`** — `getOrgEmailIdentity(orgId)` /
`saveOrgEmailIdentity`, backed by `site_config` key `email:identity` with an env
fallback and a 60s per-process cache. It reads the org's real name from
`organizations`, so every org signs its own mail today without touching DNS.

It carries an **authenticated-domain guard**: a `fromEmail` on a domain that is
not in `EMAIL_AUTHENTICATED_DOMAINS` (which always includes `EMAIL_FROM`'s own
domain) is refused and falls back, with a warning naming the fix. This exists
because of §3's finding — setting `From: info@ifacgroup.com` today would fail
SPF/DKIM and be rejected outright, which is worse than the status quo. The
resolved identity exposes `fromIsOrgDomain` so an admin screen can say so.

Legacy `*_OWNER_EMAIL` env vars are still read as a fallback, so nothing
regressed on the day this shipped. They can be deleted once each org has a
stored identity.

**`packages/email/src/client.ts`** — `sendEmail` now takes `orgId` / `kind` /
`threadId` (all optional, so the pre-existing call sites still compile), applies
the identity, and adds `categories: ['org:<id>','kind:<k>']`, `customArgs`,
`asm.groupId`, a `Feedback-ID` header, and sandbox mode via `EMAIL_SANDBOX=1`.
It returns `{ ok, messageId, sandboxed, skipped }` instead of `void`, and in
production it **throws** rather than warning when the key is missing — the
direct fix for §0.

**17 call sites wired** across ifac, amrit-canada and innergathering (RSVP,
signup, contact, trigger-email, reminders), plus the newsletter sender. All pass
`orgId` alongside the `orgName` they already had.

**`packages/email/scripts/email-doctor.mts`** — a keepable probe that resolves
each org's identity and puts a real request through SendGrid in **sandbox mode**,
which validates the whole message and delivers nothing:

```
docker exec -w /app/packages/email <container> ./node_modules/.bin/tsx scripts/email-doctor.mts
```

Verified 2026-09-16: all four orgs resolve and validate (`ok=true`,
`sandboxed=true`), each sending as its own name — "International Fine Art
Collectors", "Amrit Canada", "InnerGathering", "The Hidden Enneagram" — over the
one authenticated address. `tsc --noEmit` is clean for the email package, ifac
and hidden-enneagram; amrit-canada and innergathering each report one
*pre-existing* `CenterLayout.arrangement` error from a stale `@elkdonis/services`
dist, unrelated to this work.

### Still open, and needing a decision

- **Owner addresses.** The doctor shows `owners: (none)` for three orgs, because
  each app container only carries its own org's env var. That is the
  fragmentation §2.7 describes, seen live. Seeding `email:identity` rows fixes
  it — but the addresses are yours to confirm, and hidden-enneagram's is not
  written down anywhere in the repo.
- **Domain authentication** for ifacgroup.com / amritcanada.ca /
  hiddenenneagram.com — a write to the SendGrid account, which returns the CNAME
  records to add to DNS.
- **Four ASM unsubscribe groups** — also a SendGrid write. Until they exist,
  `asm.groupId` resolves to nothing and bulk mail has no one-click header.

### Where replies go — an unresolved design question

*Noted 2026-09-16 while setting per-org From addresses.*

Authenticating a domain authorises **sending** as it. It creates no mailbox.
Inbound mail is governed by MX, and the six domains split two ways:

| Has MX (a mailbox or forwarder is possible) | No MX (mail to it bounces) |
|---|---|
| ifacgroup.com, amritcanada.ca, hiddenenneagram.com, elkdonis-arts.org — all on the same Bluehost server, 50.6.19.74 | arts-collective.com, danamccool.com |

In practice little lands on the From address: human replies follow `reply-to`,
and bounces go to SendGrid via the `em####` return-path, not to the From. What
is left — auto-replies, hand-edited To fields, anyone whose client ignores
reply-to — currently has nowhere to go for an org whose `info@` mailbox does not
exist.

Two pieces are owed, and they are different problems:

1. **Operational: a forwarder per sending domain.** `info@<domain>` → an inbox
   somebody actually reads, created in Bluehost cPanel. Cheaper than a mailbox
   (nothing new to log into) and it stops the stragglers vanishing. Needed for
   any org whose From is on its own domain. arts-collective.com and
   danamccool.com would need an MX first.

2. **Product: let an org choose its own reply address.** The mechanism already
   exists — `OrgEmailIdentity.replyTo`, settable through
   `saveOrgEmailIdentity` — but there is **no UI**, so today it is a developer
   running a seed script. An org should be able to say "send our mail as
   `info@ourdomain.org` but route replies and RSVP notifications to
   `whoever@gmail.com`" from its own admin screen. That also resolves the
   hidden-enneagram gap, which is only unresolved because nobody has been asked
   which inbox they want.

The right home is the `/manage` console each org already has, alongside the
other identity settings. Until it exists, every new org needs a developer to
seed its identity — which is exactly the env-var fragmentation this work set out
to remove, moved one layer down.

---

## 7. State of email operations — 2026-09-16

### How an email is composed

One package does all of it. `@elkdonis/email`:

```
templates/*.tsx   React Email components — 9 of them
  ↓ renderXEmail()
components/EmailShell.tsx   the shared chrome every template sits inside
  ↓ HTML string
client.ts sendEmail()   identity, categories, ASM, SendGrid
```

`EmailShell` is the network's house style, and it is *fixed*: an "Elkdonis Arts
Collective" header in Brothers, Basteleur body copy (both served from
`elkdonis-arts.org/fonts`), a gold border, the gold/navy palette
(`EAC_GOLD #b79a55`, `EAC_INK #022278`), light and dark variants, and a
not-for-profit footer. The only per-org hook that exists is `emblemUrl` —
amrit-canada's Khanda — and no other caller sets it. **There is no org name, no
org palette and no org logo anywhere in the chrome.** Every email from every
organisation currently wears the collective's clothes. Per §6, the *envelope*
(From name, reply-to) is now per-org; the *body* is not.

### The nine templates

| Template | Sent by | Which orgs |
|---|---|---|
| `welcome` | `handleSignup` (auth-server) | **all 15 apps** that mount the shared signup route |
| `rsvp-guest` | RSVP routes | ifac, amrit-canada, innergathering |
| `rsvp-owner` | RSVP routes | ifac, amrit-canada, innergathering |
| `contact-owner` | contact + IFAC signup + silex-render | ifac, innergathering, elkdonis-arts-collective |
| `meeting-trigger` | manual blast from `/manage` | amrit-canada, innergathering |
| `reminder` | scheduled tick | **amrit-canada only** |
| `newsletter` | GrapesJS editor | **hidden-enneagram only** |
| `order-invoice` | commerce | art-auction |
| `order-notification` | commerce | art-auction |

### The signup email already is a network-standard template

This is worth stating plainly because it is easy to miss: **the network already
supplies one signup email to every organisation.** `handleSignup` in
`packages/auth-server/src/api-routes.ts:329` (and again at :564 for a fresh
Google signup) sends `welcome` for all fifteen apps that mount the shared route.
There is no per-org signup email and never has been.

It is also doing **double duty**: the primary CTA is the email-confirmation
link, and confirming is what triggers Nextcloud provisioning. Any rewrite has to
keep that, or new accounts stop getting their storage.

Its editable copy comes from `loadWelcomeEmailSettings()`, which reads:

```sql
SELECT config FROM email_template_settings
WHERE org_id = 'inner_group' AND template_key = 'welcome'
```

**`org_id` is a hardcoded literal.** Sign up at ifacgroup.com and you receive
inner_group's copy. That is defensible if the intent is one network-wide letter
— but it is currently *accidental* rather than chosen, and there is no way for
an org to add anything of its own.

### Three verified defects in that email

1. **The Google-signup path sends a dead link.** The stored `inner_group`
   welcome config's first link is
   `http://localhost:3004/feed?welcome=1` — a localhost URL, on port 3004, which
   is the retired inner-gathering app. The password path overrides `links` with
   the confirm URL so it never shows; the Google path at :566 passes no `links`
   override, so **every Google signup gets that button.**
2. **The fallback default is also dead.** `welcome.tsx` defaults `portalUrl` to
   `https://gathering.elkdonis-arts.org`, which does not respond (`elkdonis-arts.org`
   itself returns 200). This is what renders if `generateConfirmationLink` ever
   returns null.
3. **The copy is a placeholder.** The live body is "This is an email to confirm
   your sign up. / Thanks." plus a soft-launch apology. This is the first thing
   every new member of every organisation reads.

### What is actually running

| | |
|---|---|
| Orgs with an email identity | **6 of 17** |
| Sending domains authenticated | 5 of 6 (danamccool.com pending DNS) |
| Containers holding the working API key | **0 of 5** — still the placeholder |
| Delivery visibility | **none** — no Event Webhook exists |
| Total contacts across the network | 6 |
| Org memberships with an email address | ~31 |

So: the composition layer is good, the identity layer is now correct, the
audience is tiny, and **nothing has left the building yet** because the app
containers have not been recreated since the key was fixed.

That last row is the whole operational summary. Everything else here is about
being ready for the first real send.


---

## 8. The email suite — built 2026-09-16

### The copy lives in one file

`packages/email/src/copy.ts` holds every default sentence the network puts in
an organisation's mail, as exported arrays of paragraphs. Revising the
collective's letter is now an edit to a paragraph rather than a hunt through
nine components. `fill()` substitutes `{org}` / `{thread}` placeholders and is
deliberately dumb — no expressions, no conditionals — because it runs over copy
an organisation may have typed.

One line is marked **TODO** in that file: the reminder's closing sentence. The
dictated source was garbled ("This is part of this organization murder on
those…") and nothing was invented in its place; it currently reads "This is part
of {org}."

### Three layers, resolved in one place

```
1. copy.ts                      the network default — always present
2. config.bodyText/links/media  the org's own words, typed into a form
3. config.html (+ project)      the org's own LAYOUT, from the newsletter editor
```

`renderWithOverrides()` in `index.ts` runs every send helper through this, so an
org's override applies wherever that email is sent from — rather than each app
remembering to look one up, which is how amrit-canada and inner-gathering ended
up with two different per-thread schemes. A per-thread key (`reminder:th_abc`)
beats the org-wide one.

Layer 3 replaces the body but **not** the shell — so an org cannot compose its
way out of the header, the footer, or the unsubscribe link the footer carries.

### New and rewritten

| File | What |
|---|---|
| `copy.ts` | the network's words, as data |
| `components/cards.tsx` | `ProfileCard`, `ThreadCard`, `Prose` — table-based, email-safe |
| `templates/welcome.tsx` | rewritten: confirmation → profile card → thread card (purchase) → confirm button → network note → the collective's letter |
| `templates/provisioning.tsx` | **new** — "claim your Nextcloud account" |
| `templates/rsvp-guest.tsx` | rewritten with the thread card and reminder options |
| `templates/rsvp-owner.tsx` | generalised to every arrival: rsvp / signup / follow / purchase / contact, noun derived from the thread's kind |
| `templates/reminder.tsx` | rewritten; "Begins in 3 hours" computed at send time |
| `templates/advanced.tsx` | an org's own HTML, wrapped in the network's envelope |
| `template-store.ts` | load / save / resolve an org's override |

### The newsletter editor as the advanced path

`@elkdonis/newsletter` now has `blocks.ts` — twelve drag-and-drop blocks in the
house vocabulary (paragraph, section label, profile card, thread card, detail
box, button, link list, divider, image, two columns, footer note, NFP note).
Every one is `<table>` with inline styles, and the palette is a parameter so the
blocks match the dark card the suite's templates actually use.

The editor gained `mode="template"`, which removes the "Send to everyone"
button — handing someone a button that would mail an RSVP confirmation to the
whole contact list is a mistake you only get to make once — and it now loads the
brand faces *into* the canvas, so what the editor shows is what the inbox gets.

### Three defects fixed on the way

1. **`loadWelcomeEmailSettings` had `org_id = 'inner_group'` as a literal**, so
   every organisation's signup used inner_group's copy. It now resolves the
   actual signup org through the shared store.
2. **The Google-signup path mailed `http://localhost:3004/feed?welcome=1`** as
   its only button. Removed from the stored config by migration 129, and that
   path now passes no `links` at all.
3. **`config` was double-encoded in all four rows.** Every writer used
   `${JSON.stringify(config)}::jsonb`, which the postgres.js driver turns into a
   jsonb *string* — `jsonb_typeof` said `string`, so `config->'links'` returned
   NULL and **every org customisation was being silently ignored**. Migration
   129 decodes them, amrit-canada's writer now uses `db.json()`, and the reader
   parses either shape.

### Verified, not assumed

- `scripts/preview.mts` renders all ten templates to HTML and flags anything
  over 100KB, where Gmail clips.
- `scripts/test-layers.mts` proves the three layers resolve against the real
  database, including per-thread precedence, and cleans up after itself.
- `tsc --noEmit` clean for the email package, auth-server, ifac, amrit-canada,
  innergathering and hidden-enneagram.

### Still owed

- **The hub card.** Each org reaching its email settings from its hub face.
- **Advanced email options on the RSVP form.** The org choosing, while making a
  thread, between the network default, its own words, and the editor.
- **Routes** — nothing yet mounts the editor in `mode="template"`; the store and
  the editor both exist but no app wires them together.
