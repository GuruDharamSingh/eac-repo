# The email suite — 2026-09-17

Successor to `EMAIL_ARCHITECTURE_BRIEF_2026-09-16.md`, which ends with three
things owed: *the hub card*, *advanced email options*, and *routes — nothing yet
mounts the editor*. This session built the card, built the surface behind it,
and added the half the network never had: **mail that comes back**.

---

## 0. What this replaces

Four attempts, each app-local, each knowing about one fifth of the problem:

| Attempt | Knew about | Now |
|---|---|---|
| `apps/amrit-canada/.../EmailSurface.tsx` (352 lines) | one thread's confirmation, trigger, reminder | **kept** — it still owns per-thread email; marked SUPERSEDED IN PART |
| `apps/innergathering/src/app/hub/email/page.tsx` | the nine letters, previewed in iframes | **superseded** — is now the Letters tab, previews and all |
| `apps/hidden-enneagram/src/app/manage/contacts` | the `contacts` table | superseded by the Addresses tab |
| `apps/hidden-enneagram/src/app/manage/newsletter` | the GrapesJS editor | linked from the Letters tab |

The new thing is `@elkdonis/cms-ui/email` — **one face and one surface**, drawn
in the popup and on the page by the same component, over connectors the host
supplies. It is presentational, like the rest of that package: no database, no
routes.

**Two homes, and the difference between them is the whole design problem:**

| | route | tenancy |
|---|---|---|
| **arts-collective** | `/email?org=<slug>` | org-agnostic; the `?org=` switcher picks |
| **innergathering** | `/hub/email` + a live face on `/hub` | single-tenant; the org is `siteConfig.orgId` |

Top-level `/email`, not under `/hub`: email is the one capability every
organisation is given, so it is addressed like one — a URL you can say aloud. It
still uses the hub's session and the hub's `?org=` convention.

*Not a subdomain.* `email.arts-collective.com` resolves — there is wildcard DNS
at 69.196.152.249 — but has **no certificate**: TLS fails `unrecognized name`
while the apex answers 200. It would need its own proxy host, its own cert
(there are no NPM credentials; its sqlite has to be edited by hand) and its own
session-cookie scope, to reach what `/email` already has. It remains available
later as a pure proxy alias to the same app: one cert, zero code.

### The multi-org problem, and what solving it bought

The first cut of this shipped **three dead links per letter** on arts-collective.
`loadEmailSuite` hardcoded `/hub/email/<key>`, `/hub/email/<key>/edit` and
`/hub/newsletter` — routes that exist only in the single-tenant apps, where the
org is implied by the site. On a console that carries an `?org=` through every
URL, none of them existed. All eight rows 404'd; verified with curl, not guessed.

Omitting them would have been the cheap fix. The better one *matured the
service*: **writing a letter's own words moved out of a per-host page and into
the suite, as a connector.** A connector carries no route, so the same editor
works on a single-tenant site and an org-switching console alike — you open a
letter, read what will actually send, and edit its words in the same place.

What is left as a link is the **layout** editor, which is GrapesJS — a page's
worth of client code, so it stays a route, and a host that does not serve one
draws no link rather than a 404.

So the routing table is now: `loadEmailSuite(guard, routes)` takes its routes
from the host. arts-collective supplies one; innergathering supplies four.

---

## 1. The business layer: getting mail back

### The constraint that decides everything

**SendGrid's Inbound Parse cannot route two addresses on one MX host to two
different endpoints.** One host, one webhook. Verified against the SendGrid
docs, not assumed.

**And the orgs' own domains already receive mail.** `ifacgroup.com`,
`amritcanada.ca`, `hiddenenneagram.com` and `elkdonis-arts.org` all carry live
Bluehost MX records (50.6.19.74). Pointing any of those at SendGrid to receive
would destroy mailboxes people use.

### So the org rides in the address, not in the routing

```
inbound.elkdonis-arts.org.   MX 10 mx.sendgrid.net.     ← one record, whole network
```

```
ifac@inbound.elkdonis-arts.org            a fresh enquiry for `ifac`
ifac.QTuYH2gvch5GFab4T8Bxf@inbound.…      a reply on that thread
amrit-canada@inbound.…                    underscores become hyphens in the address
```

One DNS record. One webhook. A new org has a working reply address the hour it
is created, with no DNS work at all — which is the difference between a feature
the network *has* and a feature each org has to be onboarded onto.

**The thread token's case is load-bearing.** A thread id is a nanoid over a
64-character alphabet, so `abc123XYZ` and `abc123xyz` are different threads.
Lowercasing the local part — the obvious thing to do to an email address, and
what the first version of this did — turned every reply token into an id
matching no row. The test caught it. The org part is now matched
case-insensitively; the token is returned exactly as it arrived, and the route
retries case-insensitively only when that is **unambiguous**.

### Triage, in order

Each step in `/api/email/inbound`:

1. **Verify** the ECDSA signature. Unverified, anyone on the internet can POST
   mail into any org's inbox. Without a key the route accepts and logs that
   warning on every single request.
2. **Resolve the org** from the local part, against the real org ids — not by
   transforming the string back, because `hidden-enneagram` and `amrit_canada`
   do not round-trip through one substitution and a guess files one org's mail
   under another. No match → dropped, 200, logged.
3. **Resolve the thread** from the token (see above).
4. **Match the sender** against `contacts`. A *convenience for the reader, never
   authentication* — SMTP lets anyone write any From.
5. **Classify**: `reply` · `enquiry` · `auto` · `bounce` · `spam`. Auto-replies
   and bounces are separated out so the unread badge means *people waiting on
   you*, which is the only reading of a badge anyone acts on. Headers first
   (RFC 3834 `Auto-Submitted`), subject matching only as a fallback and only
   ever to *downgrade* out of the count.
6. **File it**, deduped on the sender's `Message-ID` — Parse has no delivery
   guarantee and retries the same POST.

Bodies are stored **raw** and sanitised at render: sanitising on the way in
destroys the evidence of what was actually sent. The surface never injects
`body_html`; it renders the text part in a `<pre>`.

### An org that wants mail at its own address

Two paths, and the first is the default recommendation:

1. **Forward from the cPanel mailbox it already has** → `<org>@inbound.…`. No
   DNS change, so it cannot break anything.
2. Point `inbound.<theirdomain>` MX at SendGrid and add a second Parse host.
   Needs DNS access and a second webhook entry.

### Where replies go — settled

A **per-org toggle, default OFF**. `replyTo` stays whatever it is today
(`gurudharamsingh@gmail.com`, `info@ifacgroup.com`). The Look tab has a switch
that routes replies into the website instead. Off by default because turning it
on silently redirects mail somebody is currently receiving in Gmail — that is
the org's decision, not one to inherit.

---

## 2. What was built

### Schema

**Migration 134 — `email_inbox` + the address book.** Inbound mail per org, with
classification, state, attachment metadata, and a partial unique index on
`(org_id, message_id)` for dedupe. Plus `contacts.tags / notes / added_by /
updated_at` and a unique `(org_id, lower(email))` so manual entry is idempotent
(verified 0 collisions on live data first).

**Migration 135 — `email_sends` + `email_events`.** The delivery ledger. Two
tables because they answer to different owners: a send is ours, written at call
time; an event is SendGrid's, arriving late, out of order, possibly several
times, possibly for a send we hold no row for. Bodies are deliberately **not**
stored — this is a ledger, not an archive.

### Package — `@elkdonis/email`

| File | What |
|---|---|
| `inbox.ts` | addressing, classification, filing, reading |
| `address-book.ts` | the merged list, paste-parsing, manual entry, suppression |
| `ledger.ts` | `recordSend`, `ingestEvents`, `recentActivity`, `deliveryStats` |

`sendEmail` now writes a ledger row for every recipient — **including failures**,
recorded before the re-throw, so a call site that swallows the error still leaves
a trace an owner can find. `recordSend` never throws: the letter matters more
than the record of it.

### The address book is a READ, not a copy

`contacts` (migration 020) was built for one thing: a visitor who filled in a
form. So IFAC, with 31-odd memberships, was being shown a contact list of four —
and the newsletter, which sends to `contacts`, **could not reach its own
membership**.

Members come from `user_organizations` and guests from `thread_rsvps`, joined at
query time and marked with where they came from. Nothing is duplicated, so
nobody has a stale second copy of their own address and an org that loses a
member loses them from the list the same day. Live, IFAC now shows **6 reachable
across three sources** where `contacts` alone showed 4.

**Unsubscribe crosses every source.** It is a statement about being emailed, not
about a row — so it is resolved once, by address, and applied to every entry
whichever table it came from. Getting that backwards is how a network mails
someone who asked it not to. Re-adding an unsubscribed address by paste is
refused and *reported*, never silently honoured.

### UI — `@elkdonis/cms-ui/email`

**The face** draws the org's actual correspondence — the last letters out and in,
the unread badge, chips into each tab, and *Go to the email suite →*. Not a
description of a feature: the previous face offered a thread picker and three
verbs, which made email a thing you configure. Email is mostly a thing that
happens to you.

**The surface**, five tabs:

- **Activity** — sends and arrivals in one feed; delivery stats read from the
  *ledger*, with `Awaiting news` shown rather than folded into `delivered`,
  because a send with no event yet is genuinely unknown.
- **Inbox** — read, archive, reply (mailto), rescue from spam.
- **Addresses** — the merged list, paste-to-add, filter, stop-mailing.
- **Letters** — all eight templates, which layer is winning, *Read it* rendering
  the real letter in a sandboxed iframe, and the newsletter editor.
- **Look** — the org's palette and where replies go.

---

## 3. Three defects found and fixed on the way

1. **`saveOrgEmailIdentity` replaced the whole stored object.** It built its
   payload from the input alone, so a form saving only a palette would have
   **erased the From address, the reply-to and the owner list** — every identity
   on the network, wiped by somebody picking a colour. It now merges; `undefined`
   leaves a field alone and `null` clears it. Proved through the live HTTP route.

2. **The reply token was being lowercased**, so every threaded reply would have
   filed as an orphan. Caught by the test, not by review.

3. **Clearing your own words from a letter had never worked.** `saveOrgTemplate`
   merges, and callers expressed "go back to the network's words" by passing
   `bodyText: undefined` — which the merge reads as *leave it alone*, so the old
   words were put straight back. It now takes `null` to clear, `undefined` to
   leave (the same convention as the identity fix above), and a proof run shows
   the words going and the GrapesJS layout beside them surviving. That second
   half matters: `clearOrgTemplate` deletes the whole row, so the obvious fix
   would have destroyed an org's layout every time it edited its copy.

4. **The palette's own defaults failed contrast.** `onAccent` defaulted to
   `#ffffff`, which the checker immediately measured at **2.70:1** against the
   collective's gold — the exact white-on-brand-colour failure that keeps
   shipping here. Now `#022278`, which passes at 5.17:1. The Look tab measures
   **both** pairs the template actually uses: the org's accent as *ink on the
   fixed navy masthead* (6.48:1, what `EmailShell` really does) and the
   on-accent colour *on a fill* (5.17:1).

---

## 4. Verified, not assumed

- `packages/email/scripts/test-suite.mts` — **54 assertions against the live
  database**, cleaning up after itself, including that its own restore is
  byte-for-byte lossless (its first version was not, and quietly rewrote IFAC's
  From address).
- The inbound webhook driven end to end with five real multipart POSTs: enquiry,
  threaded reply on a real mixed-case thread id, retry (deduped), unknown org
  (dropped, 200), out-of-office (classified `auto`, excluded from the badge).
- All five tabs rendered under a real minted session and read as markup; the
  write routes exercised over HTTP; the preview route checked for a valid key,
  an invalid key and no session.
- `tsc --noEmit` clean: `packages/email`, `packages/cms-ui`, `arts-collective`,
  `amrit-canada`, `innergathering`.
- Test account, probe messages and probe contacts all removed; `email_inbox` and
  `email_sends` are back to 0 rows and `contacts` to its original 6.

One defect found by rendering rather than by types: the suite drew SurfaceFrame's
masthead and a **✕ close button on a full page with nothing to close**, under the
page's own heading. `asPage` now drops the frame entirely.

---

## 5. What is owed

**To switch inbound on** (none of it is code):

1. `inbound.elkdonis-arts.org. MX 10 mx.sendgrid.net.`
2. SendGrid → Settings → Inbound Parse → Add Host & URL →
   `https://arts-collective.com/api/email/inbound`
3. Enable the **signed** Inbound Parse webhook; put the key in
   `SENDGRID_INBOUND_PUBLIC_KEY`. *Until this exists the endpoint is forgeable*
   and says so in the log on every request.
4. Set `EMAIL_INBOUND_DOMAIN=inbound.elkdonis-arts.org`.

**To switch delivery tracking on:** Settings → Mail Settings → Event Webhook →
`https://arts-collective.com/api/email/events`, signed, key in
`SENDGRID_EVENT_PUBLIC_KEY`. Until then `email_sends` rows stay `queued` for
ever and the Activity tab honestly says `Awaiting news`.

**DEPLOYED 2026-09-17.** Both hosts are live and verified:

- `eac-arts-network` recreated, now carrying `SENDGRID_API_KEY` and
  `EMAIL_AUTHENTICATED_DOMAINS`. **`email-doctor` went from "6 orgs failed" to
  "all orgs validated"** — the first time any container on this network has held
  working SendGrid credentials. Four of the six now send from their own
  authenticated domain (ifac, amrit_canada, inner_group, elkdonis); hidden-
  enneagram and danamccool still fall back to the network address.
- `eac-innergathering` rebuilt (BUILD_ID `DtFkBbTKYgzD48ql-crlH` →
  `lJ6lLqbevI_yk5bMFRecp`) and restarted. The live `.next` was tarred to the
  session scratchpad first (102MB, 6,468 entries, both manifests verified) —
  this container serves elkdonis-arts.org and a failed build would have wiped
  it. The build was clean and the backup was not needed.

Verified on the deployed builds, not on source: all eight apps and all four
live domains answer 200; innergathering's hub draws the live email face and
both retired placeholder tiles are gone; its Letters tab shows 8 "Read & edit"
and 5 layout links; saving and then CLEARING a letter's words works through the
production route, leaving the org's neighbouring `links` override intact; and a
real `sendEmail` writes a ledger row carrying SendGrid's own message id.

One pre-existing warning surfaced in the logs and is worth someone's attention:
`"next start" does not work with "output: standalone"` — innergathering is
built standalone but started with `next start`. It serves correctly, so this is
not urgent, but the two are not meant to be paired.

**Still not built:**

- **The newsletter on arts-collective.** GrapesJS is mounted in innergathering
  and hidden-enneagram, both single-tenant. Making it org-aware is the same
  shape of work the letter editor just had done to it, and is the obvious next
  piece.
- **innergathering has not been redeployed.** Its container runs a *prebuilt
  production* `.next` and serves the live elkdonis-arts.org, so none of its
  changes are visible yet. Rebuilding it compiles every other session's
  in-flight code in this tree, so it is a deliberate act, not a side effect of
  this work. Its code is verified by typecheck and by running its loader
  directly (all four routes resolve, the address book merges members and
  guests); what is unverified is only how it looks once built.

- **Per-thread email as a sixth tab.** amrit-canada's surface is the only place
  you can trigger a blast to one meeting's attendees or set its reminder. When
  that folds in, delete that pair *and* its `email` custom-surface key — it is
  the same key the shared suite registers, so the two can never coexist in one
  app.
- **Attachment bytes.** Inbound attachment *metadata* is stored; the files are
  not. Putting a stranger's 30MB into an org's Nextcloud folder is its own
  decision, with its own quota and scanning question.
- **Replying in-app.** The Inbox's Reply is a `mailto:`. Sending *as* the org
  needs the identity, the templates and a send — that is the newsletter editor's
  job, and a half-composer in the popup would be a fifth attempt at the thing
  this suite exists to end.
- **The other apps.** Only arts-collective mounts the suite. A single-tenant app
  gets it by rendering `<EmailFace>` and registering `EmailCustomSurface` under
  the `email` key.
- Everything the 2026-09-16 brief lists under §3 Layers 4 and 5 that is not
  above: one scheduler, `personalizations` batching, scheduled sends.
