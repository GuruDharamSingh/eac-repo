# Email DNS records to add — 2026-09-16

Created in SendGrid on 2026-09-16 with `automatic_security: true`, so SendGrid
holds the DKIM private keys and **all six records per domain are CNAMEs** — no
TXT SPF record to maintain by hand.

Add these at each domain's DNS host. Do **not** proxy them (if a record sits
behind Cloudflare, set it to "DNS only" / grey cloud) — a proxied CNAME breaks
validation.

---

## ifacgroup.com  — SendGrid id 33036122

| Type | Host | Value |
|---|---|---|
| CNAME | `em5156.ifacgroup.com` | `u54282917.wl168.sendgrid.net` |
| CNAME | `s1._domainkey.ifacgroup.com` | `s1.domainkey.u54282917.wl168.sendgrid.net` |
| CNAME | `s2._domainkey.ifacgroup.com` | `s2.domainkey.u54282917.wl168.sendgrid.net` |

## amritcanada.ca — SendGrid id 33036126

| Type | Host | Value |
|---|---|---|
| CNAME | `em7954.amritcanada.ca` | `u54282917.wl168.sendgrid.net` |
| CNAME | `s1._domainkey.amritcanada.ca` | `s1.domainkey.u54282917.wl168.sendgrid.net` |
| CNAME | `s2._domainkey.amritcanada.ca` | `s2.domainkey.u54282917.wl168.sendgrid.net` |

## hiddenenneagram.com — SendGrid id 33036129

| Type | Host | Value |
|---|---|---|
| CNAME | `em5087.hiddenenneagram.com` | `u54282917.wl168.sendgrid.net` |
| CNAME | `s1._domainkey.hiddenenneagram.com` | `s1.domainkey.u54282917.wl168.sendgrid.net` |
| CNAME | `s2._domainkey.hiddenenneagram.com` | `s2.domainkey.u54282917.wl168.sendgrid.net` |

## arts-collective.com — SendGrid id 33036274

| Type | Host | Value |
|---|---|---|
| CNAME | `em8442.arts-collective.com` | `u54282917.wl168.sendgrid.net` |
| CNAME | `s1._domainkey.arts-collective.com` | `s1.domainkey.u54282917.wl168.sendgrid.net` |
| CNAME | `s2._domainkey.arts-collective.com` | `s2.domainkey.u54282917.wl168.sendgrid.net` |

## danamccool.com — SendGrid id 33036275

DNS is at **renewyourname.net**, not Bluehost — a different panel from the rest.

| Type | Host | Value |
|---|---|---|
| CNAME | `em6443.danamccool.com` | `u54282917.wl168.sendgrid.net` |
| CNAME | `s1._domainkey.danamccool.com` | `s1.domainkey.u54282917.wl168.sendgrid.net` |
| CNAME | `s2._domainkey.danamccool.com` | `s2.domainkey.u54282917.wl168.sendgrid.net` |

## elkdonis-arts.org — SendGrid id 26632977 — **RE-ADD THESE**

SendGrid reports this domain as valid, but that is a cached result from when it
was first set up. **The records are not in public DNS any more.** All three
names resolve to `69.196.152.249` — a wildcard `*.elkdonis-arts.org` A record
answering for them — and a TXT lookup at `s1._domainkey.elkdonis-arts.org`
returns nothing, which is what a receiving mail server actually asks for. So
DKIM verification fails today, on the one address every app currently sends
from.

| Type | Host | Value |
|---|---|---|
| CNAME | `em6860.elkdonis-arts.org` | `u54282917.wl168.sendgrid.net` |
| CNAME | `s1._domainkey.elkdonis-arts.org` | `s1.domainkey.u54282917.wl168.sendgrid.net` |
| CNAME | `s2._domainkey.elkdonis-arts.org` | `s2.domainkey.u54282917.wl168.sendgrid.net` |

A specific record beats a wildcard, so adding these three works without touching
the wildcard itself.

> **Underscores:** Bluehost's A-record form only accepts letters, digits, `-`,
> `.` and `*`. The DKIM names must go in as **CNAME** records, where underscores
> are accepted. `_domainkey` is fixed by the DKIM spec (RFC 6376) — there is no
> underscore-free alternative, and manual security does not avoid it either.
>
> Some DNS panels append the domain automatically. If yours does, enter the host
> as just `em5156`, `s1._domainkey`, `s2._domainkey` — entering the full name
> would produce `em5156.ifacgroup.com.ifacgroup.com`.

---

## After the records propagate

**1. Validate each one** (SendGrid re-checks DNS and flips `valid` to true):

```bash
curl -X POST "https://api.sendgrid.com/v3/whitelabel/domains/33036122/validate" -H "Authorization: Bearer $SENDGRID_API_KEY"
```

…and the same for `33036126`, `33036129`, `33036274`, `33036275` and
`26632977`.

**2. DMARC — measured state as of 2026-09-16**

| Domain | `_dmarc` TXT |
|---|---|
| ifacgroup.com | `v=DMARC1; p=none` |
| amritcanada.ca | `v=DMARC1; p=none` |
| elkdonis-arts.org | `v=DMARC1; p=none` |
| hiddenenneagram.com | **missing** |
| arts-collective.com | **missing** |
| danamccool.com | **missing** |

So half the work is already done. Two things remain.

**2a. Add the three missing records.** TXT, at the root domain (not the `em####`
subdomain — DMARC is only ever looked up at the organisational domain):

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc.hiddenenneagram.com` | `v=DMARC1; p=none; rua=mailto:dmarc@hiddenenneagram.com` |
| TXT | `_dmarc.arts-collective.com` | `v=DMARC1; p=none; rua=mailto:dmarc@elkdonis-arts.org` |
| TXT | `_dmarc.danamccool.com` | `v=DMARC1; p=none; rua=mailto:dmarc@danamccool.com` |

`p=none` is monitor-only: it changes nothing about delivery and cannot break
mail. It is the required baseline for Gmail and Yahoo, and it is what makes the
SPF and DKIM you just set up *reportable*.

**2b. The `rua=` addresses — the part with a trap.**

The three existing records have no `rua=`, which means they publish a policy and
collect nothing. `p=none` without a reporting address is close to pointless: the
entire purpose of the monitor phase is to find out who is sending as you.

The trap: **if the `rua` mailbox is on a different domain from the DMARC record,
that other domain must authorise it** with a TXT record of its own —
`<reporting-domain>._report._dmarc.<rua-domain>` = `v=DMARC1`. That is why
`rua=mailto:someone@gmail.com` does not work: you cannot add records to
gmail.com, so strict receivers will not send the reports.

Three ways round it, in increasing order of effort:

1. **Valimail free** — `rua=mailto:dmarc_agg@vali.email`. SendGrid's documented
   partner; vali.email already publishes the authorisation records, so there is
   no EDV to set up, and you get a dashboard instead of zipped XML. For a team
   this size this is the pragmatic answer.
2. **Same-domain address** — `dmarc@<the same domain>`. No authorisation record
   needed. Works for ifacgroup.com, amritcanada.ca, hiddenenneagram.com and
   elkdonis-arts.org, which all have MX. It does **not** work for
   arts-collective.com or danamccool.com, which have no MX at all.
3. **One central mailbox plus EDV** — e.g. `dmarc@elkdonis-arts.org` for
   everything, which then needs, on elkdonis-arts.org:
   `ifacgroup.com._report._dmarc.elkdonis-arts.org` TXT `v=DMARC1`, and one such
   record per reporting domain.

Reports arrive daily as zipped XML, so whichever address you choose must accept
`.zip` attachments.

**2c. Adding `rua` to the three that already have a record** is a straight edit
of the existing TXT value — e.g. `ifacgroup.com` becomes
`v=DMARC1; p=none; rua=mailto:dmarc@ifacgroup.com`.

Tighten `p=none` to `quarantine` only once the reports show nothing legitimate
is failing.

**3. Tell the app the domains are authenticated** — in `.env`:

```
EMAIL_AUTHENTICATED_DOMAINS=ifacgroup.com,amritcanada.ca,hiddenenneagram.com,arts-collective.com,danamccool.com,elkdonis-arts.org
```

Until a domain is listed here, the identity guard in
`packages/email/src/identity.ts` refuses a `From` on it and falls back to the
network address, because an unauthenticated From is rejected outright by Gmail
and Yahoo — worse than the wrong-but-aligned sender.

**4. Set each org's From address**, e.g. `info@ifacgroup.com`, via
`saveOrgEmailIdentity` (or by editing `packages/email/scripts/seed-identities.mts`
and re-running it). Then:

```bash
docker exec -w /app/packages/email eac-ifac ./node_modules/.bin/tsx scripts/email-doctor.mts
```

should report `own domain: ✓` for that org.

---

## Unsubscribe groups created the same day

| Org | ASM group id |
|---|---|
| ifac | 214755 |
| amrit_canada | 214756 |
| inner_group | 214757 |
| hidden-enneagram | 214758 |
| elkdonis | 214762 |
| danamccool | 214763 |

Already written into each org's `email:identity`, so `sendEmail` attaches
`asm.group_id` automatically and SendGrid emits the one-click
`List-Unsubscribe` header. An unsubscribe from one org no longer silences the
others.


---

## SPF, separately

Neither `elkdonis-arts.org` nor `ifacgroup.com` includes SendGrid in its SPF
record today:

```
elkdonis-arts.org   v=spf1 ip4:50.6.19.65 a mx include:websitewelcome.com ~all
ifacgroup.com       v=spf1 a mx include:websitewelcome.com ~all
```

With automatic security this is usually harmless — SPF is evaluated against the
`em####` return-path subdomain, which CNAMEs to `sendgrid.net` and inherits
SendGrid's own SPF. It only matters once the CNAMEs are actually in place. It is
listed here so it is not mistaken for a missing step: **do not** add
`include:sendgrid.net` to the root SPF unless a domain is also sending from
SendGrid on its root address.

Both domains already publish `v=DMARC1; p=none`, which satisfies the Gmail and
Yahoo baseline.

---

# Inbound — one record for the whole network (added 2026-09-17)

Everything above authorises **sending**. It creates no mailbox: inbound mail is
governed by MX, and nothing here changes that.

To let replies and enquiries come back into the site, add **one** record:

| Type | Host | Priority | Value |
|---|---|---|---|
| MX | `inbound.elkdonis-arts.org` | 10 | `mx.sendgrid.net` |

Then SendGrid → **Settings → Inbound Parse → Add Host & URL**:

| Field | Value |
|---|---|
| Receiving domain | `inbound.elkdonis-arts.org` |
| Destination URL | `https://arts-collective.com/api/email/inbound` |
| POST the raw, full MIME message | **off** (parsed mode) |
| Check incoming emails for spam | **on** (supplies `spam_score`) |

Finally set `EMAIL_INBOUND_DOMAIN=inbound.elkdonis-arts.org` and recreate the
`arts-collective` container.

## Why a subdomain, and why only one

**Not the orgs' own domains.** `ifacgroup.com`, `amritcanada.ca`,
`hiddenenneagram.com` and `elkdonis-arts.org` all carry live MX records pointing
at the same Bluehost server (50.6.19.74). Inbound Parse requires MX to point at
`mx.sendgrid.net`, so switching any of those over would **destroy mailboxes
people currently use**. `inbound.` is a subdomain nobody has, so adding it can
break nothing.

**One host, not one per org,** because Parse cannot route two addresses on one
host to two different webhooks. So the organisation rides in the local part:

```
ifac@inbound.elkdonis-arts.org          a fresh enquiry for `ifac`
ifac.<threadId>@inbound.…               a reply on that thread
amrit-canada@inbound.…                  underscores in an org id become hyphens
```

One record covers every organisation on the network, including ones that do not
exist yet.

## An org that wants mail at its own address

**That Bluehost is ours.** Verified 2026-09-17: `mail.ifacgroup.com`,
`mail.amritcanada.ca`, `mail.hiddenenneagram.com` and `mail.elkdonis-arts.org`
all resolve to 50.6.19.74 — one account, ours, not four third parties. So the
forwarder path is not a request to anybody; it is a form in a cPanel we already
sign into, and it works the same afternoon.

1. **Forward** `info@<domain>` → `<org>@inbound.elkdonis-arts.org` in cPanel →
   Email → Forwarders. Nothing about the MX changes, so nothing can break, and
   it can be undone in one click. **This is the path for all four domains.**
2. Add `inbound.<domain>. MX 10 mx.sendgrid.net.` and a **second** Parse host
   pointing at the same URL. Only worth it for a domain that should receive
   *nothing but* website mail.

**The two without any MX at all** are `arts-collective.com` and
`danamccool.com` — mail to those bounces today, so there is no forwarder to
make and nothing to preserve. For those, either the shared
`inbound.elkdonis-arts.org` address is simply the address, or give them their
own MX from scratch.

## Signed webhooks — do this at the same time

Both endpoints are public and unauthenticated until their verification keys are
set. Unsigned, anyone on the internet can POST mail into an org's inbox, or forge
a bounce and have an address suppressed network-wide. Each route logs that
warning on every request until its key exists.

| SendGrid setting | Endpoint | Env var |
|---|---|---|
| Settings → Inbound Parse (signed) | `/api/email/inbound` | `SENDGRID_INBOUND_PUBLIC_KEY` |
| Settings → Mail Settings → Event Webhook (signed) | `/api/email/events` | `SENDGRID_EVENT_PUBLIC_KEY` |

The Event Webhook is what closes the loop that has been open since this network
sent its first letter: until it exists, a hard-bounced address stays in
`contacts` and is retried on every send. See `EMAIL_SUITE_BRIEF_2026-09-17.md`.
