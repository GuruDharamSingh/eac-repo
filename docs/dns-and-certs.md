# DNS, Certs & Reverse Proxy — how EAC domains work

A plain-language guide to how a request reaches one of our apps, why
`auth.elkdonis-arts.org` was broken, and what to do long-term so adding a new
public app is a two-minute job.

---

## The three layers a request passes through

```
  Browser asks for https://auth.elkdonis-arts.org
        │
        │  1. DNS  — "what machine is that name?"
        ▼
  Bluehost answers: auth.elkdonis-arts.org → eris.in-transit.ca → 104.195.230.170
        │
        │  2. Reverse proxy (Nginx Proxy Manager) — "which app on that machine?"
        ▼
  NPM matches the hostname → forwards to 192.168.0.11:9999 (GoTrue)
        │  (NPM also terminates HTTPS here using a Let's Encrypt cert)
        ▼
  3. The app (GoTrue / Next.js app) handles the request
```

If **any** layer is missing, the site is unreachable. The Google OAuth failure
was layer 1 + 2 missing for `auth.` — the app (GoTrue) was healthy the whole
time on `localhost:9999`.

---

## The pieces, defined

### DNS (Bluehost)
- Our domain `elkdonis-arts.org` has its nameservers at **Bluehost**
  (`ns1.bluehost.com`, `ns2.bluehost.com`). That's where we edit DNS records.
- Each subdomain is a **CNAME** to `eris.in-transit.ca` (the server's dynamic
  hostname), which resolves to the server IP. Example existing records:
  `cloud`, `eac`, `meetings` → all CNAME → `eris.in-transit.ca.`
- **There is no wildcard today**, so every new subdomain needs its own record.
  This is the friction we want to remove (see "Long-term" below).

### Reverse proxy — Nginx Proxy Manager (NPM)
- Runs as the TrueNAS app `ix-nginx-proxy-manager` (v2.15.1).
- Admin UI: **http://192.168.0.11:30020**
- Public traffic enters on host ports 30021 (HTTP) / 30022 (HTTPS), which the
  router/TrueNAS maps from 80/443.
- A **Proxy Host** entry maps `some.domain` → an internal `IP:port`. This is
  what tells "auth.elkdonis-arts.org" to go to GoTrue on `:9999`.
- NPM also **gets and auto-renews the HTTPS certificate** for each host.

### Certificate (Let's Encrypt, via NPM)
- A cert proves "I really am auth.elkdonis-arts.org" so the browser shows the
  padlock instead of a warning.
- Let's Encrypt issues them free, but it must verify we control the domain.
  Two verification methods matter to us:
  - **HTTP-01** — LE hits `http://thehost/.well-known/...`. Works per-hostname,
    needs nothing but a working proxy host. **This is what NPM's one-click
    "Request a new SSL Certificate" button uses.** Auto-renews. ✅ easy.
  - **DNS-01** — LE asks us to publish a TXT record. **Required for a wildcard
    (`*.`) cert.** NPM can only automate this if our DNS provider has a
    supported API (Cloudflare, Route53, etc.). **Bluehost has no such API**, so
    a wildcard cert on Bluehost means manually pasting a TXT record every 90
    days. ❌ painful.

---

## Why `auth.elkdonis-arts.org` didn't work

- GoTrue (the auth server) was **fine** — `localhost:9999/authorize?provider=google`
  returned a correct redirect to Google.
- But `auth.elkdonis-arts.org` had **no DNS record** and **no NPM proxy host**,
  so the browser never reached GoTrue. And GoTrue tells Google to return the
  user to `https://auth.elkdonis-arts.org/callback`, so the round-trip would
  have failed on the way back too.

### The fix (one-time, manual)
1. **Bluehost DNS:** add `auth` → CNAME → `eris.in-transit.ca.`
   (or the wildcard, below).
2. **NPM:** Hosts → Proxy Hosts → Add:
   - Domain `auth.elkdonis-arts.org`, scheme `http`, forward `192.168.0.11:9999`
   - SSL tab → request a new cert (HTTP-01), Force SSL on.
3. Verify: `curl https://auth.elkdonis-arts.org/health` returns the GoTrue JSON.

---

## Long-term simplicity — two levels

### Level 1 (do now): wildcard DNS, per-host certs
Add **one** Bluehost record:
```
Type: CNAME   Host: *   Points to: eris.in-transit.ca.
```
Now **every** subdomain (`auth`, `artdirect`, `market`, anything) resolves
instantly — you never touch DNS again. Certs stay per-host via NPM's one-click
HTTP-01 button (auto-renewing, no DNS API needed).

**Result:** adding a new public app = add an NPM proxy host + click SSL. ~2 min.
This keeps Bluehost and gets ~90% of "wildcard convenience."

### Level 2 (optional, later): move DNS to Cloudflare → true wildcard cert
If we ever want a single `*.elkdonis-arts.org` cert (one cert for everything,
subdomain names hidden from public certificate logs):
1. Create a free Cloudflare account, add `elkdonis-arts.org`, import records.
2. At Bluehost, change the **nameservers** to the two Cloudflare gives us.
3. In NPM, add a Cloudflare API token; request a `*.elkdonis-arts.org` cert.
   NPM now does DNS-01 automatically and auto-renews the wildcard.

Only worth it once we have many subdomains; **not required** for anything today.

> Note: `hiddenenneagram.com` is a **separate domain**, so the
> `*.elkdonis-arts.org` wildcard does not cover it. It needs its own DNS record
> + proxy host (apex `hiddenenneagram.com` → CNAME/ALIAS or A → the server, then
> an NPM proxy host → `192.168.0.11:3012`).

---

## Quick reference: adding a new public app

1. **DNS:** already covered if the `*` wildcard CNAME exists. Otherwise add
   `newapp` → CNAME → `eris.in-transit.ca.` at Bluehost.
2. **NPM** (http://192.168.0.11:30020) → Proxy Hosts → Add:
   `newapp.elkdonis-arts.org` → `192.168.0.11:<port>`, then SSL → request cert.
3. **Allow-list (only if the app uses auth):** add
   `https://newapp.elkdonis-arts.org/**` to `ADDITIONAL_REDIRECT_URLS` in `.env`
   and recreate the `supabase-auth` container.
4. Verify: `curl https://newapp.elkdonis-arts.org/`.

### Current port → intended domain map
| App | Port | Domain |
|---|---|---|
| inner-gathering | 3004 | elkdonis-arts.org (apex) + meetings. |
| GoTrue (auth) | 9999 | auth.elkdonis-arts.org |
| Nextcloud | — | cloud.elkdonis-arts.org |
| arts-collective (hub, deprecating) | 3005 | eac.elkdonis-arts.org |
| hidden-enneagram | 3012 | hiddenenneagram.com (separate domain) |
| artdirect (OAD) | 3013 | artdirect.elkdonis-arts.org |
| art-auction | 3009 | market.elkdonis-arts.org (when public) |
| Silex editor | 6805 | edit.elkdonis-arts.org (for site owners) |
| admin | 3000 | none — LAN/IP only, never public |
