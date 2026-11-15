# Anomaly 1: redirect loops and sign-in landing on the wrong site (a2, 2026-11-14, read-only)

Reported by Justin on 2026-11-14 for paratheater.arts-collective.com, and sometimes pottery.arts-collective.com, market.arts-collective.com and elkdonisexperiences.com. Investigated read-only with curl through the edge, NPM's configs and access logs, the app logs, the GoTrue environment (URL settings only) and the code. Nothing was changed.

## Verdict: not a regression from today's sunjay build (233XY)
- **The loop is in code and config that today's build didn't touch:**
  - `packages/auth-server/src/sso-proxy.ts` (last changed in the 1-7 November snapshot);
  - sunjay's `proxy.ts` (unchanged);
  - NPM's host settings.
- **pottery (katie) and market (art-auction)** have the same exposure, and we didn't rebuild them.
- **The Channel `org-domains` change** in this build only adds a read-only `listOrgHosts`, which the SSO path doesn't call.

## 1. The redirect loop: plain http on three hosts, plus the once-per-visit SSO mark

**What the proxy log shows.** NPM `proxy-host-23_access.log` (arts-collective.com), 2026-11-14 15:20:46-15:21:08 EST: one browser alternating about three times a second between these two hops:

    GET https://arts-collective.com/api/auth/handoff/accept?token=…&next=/api/auth/handoff?to=http://paratheater.arts-collective.com/&plain=1   307
    GET https://arts-collective.com/api/auth/handoff?to=http://paratheater.arts-collective.com/&plain=1                                       307
    → http://paratheater.arts-collective.com/  → (sunjay mirrors again) → back to …/accept

The browser stops it with "arts-collective.com redirected you too many times". The repeats show up in arts-collective's own log as `[handoff] refused: token already used` (20:21:06, 20:21:07, 20:39:12, 20:41:26 UTC) and as `/login?…&error=handoff`.

**Mechanism** (`sso-proxy.ts`):
1. A page view on a site signed in locally but without the `eac_sso=m` mark goes out to arts-collective.com to mirror the sign-in.
2. On the way out, the site sets `eac_sso=m`, `secure` only when the page is https.
3. On `http://paratheater…` the mark never sticks. An earlier https visit left a Secure `eac_sso` cookie for that host, which the browser doesn't send over http and refuses to replace from an http page. This step is inferred from browser cookie rules; the log shows the effect.
4. So every return to `http://…/` starts the mirror again, and it never ends.

**Why only these sites.** NPM "Force SSL" is off on three hosts, so plain http is served (200) instead of being redirected to https:

| Host | NPM host | `http://` answers | Force SSL |
|---|---|---|---|
| paratheater.arts-collective.com | 29 | 200 | off |
| pottery.arts-collective.com | 37 | 200 | off |
| market.arts-collective.com | 26 | 200 | off |
| directory.arts-collective.com | 27 | 200 | not checked; serves http |
| hiddenenneagram.com | ? | 200 | serves http |
| arts-collective.com, www | 23 | 301 → https | on |
| elkdonisexperiences.com, www | 35 | 301 → https | on |
| *.arts-collective.com (wildcard) | 32 | → https | on |
| ifacgroup.com, danamccool.com, elkdonis-arts.org | | 301 → https | on |

None of them sends HSTS. elktours forces https, so it shouldn't loop this way. Its "sometimes" is more likely the refusals below or the cookie state left by a loop. Not reproduced.

**Signed out, every site is fine:** one hop to `arts-collective.com/api/auth/handoff?to=<site>&next=/` and back with 200. Fresh-jar chains with browser headers, each one 307 → 307 → 200:
- paratheater (http and https), pottery, market, elkdonisexperiences and www.elkdonisexperiences;
- `paratheater/hub/organization` ends 404, because that route is arts-collective's, not sunjay's.

Plain curl is skipped by the SSO proxy (`curl` is in `BOT_UA`), so these tests needed browser headers.

## 2. `www.paratheater.arts-collective.com`
- The `*.arts-collective.com` certificate doesn't cover two levels, so browsers warn (curl: "no alternative certificate subject name matches").
- Past the warning, NPM's wildcard host (32) sends it to the arts-collective app, which draws its own landing page and, after sign-in, its tenant `/hub/organization`. That's what Justin saw; it isn't the Para Theater site.
- No `www.` host exists for any `*.arts-collective.com` site. Either add an NPM redirect host `www.paratheater…` → `paratheater…` with its own certificate, or don't use `www.` on subdomains.

## 3. Google sign-in landing on elkdonis-arts.org
- GoTrue: `GOTRUE_SITE_URL=https://elkdonis-arts.org`, with `GOTRUE_URI_ALLOW_LIST` taken from `ADDITIONAL_REDIRECT_URLS`. A sign-in whose return address isn't on that list is sent to SITE_URL, which is the "long URL on elkdonis-arts" Justin saw.
- **Missing from the list (2026-11-14):**
  - `https://pottery.arts-collective.com/**` (katie)
  - `https://hiddenenneagram.com/**`, plus `www.` if HE answers there
  - `https://books.elkdonis-arts.org/**` (fourth way)
  - `http://paratheater.arts-collective.com/**`, `http://market…`, `http://pottery…`: only while those hosts serve http. Better fixed by Force SSL (§1).
  - `https://www.paratheater.arts-collective.com/**`: better fixed as §2.
- **Present:** elkdonis-arts.org, eac., meetings., cloud., ifacgroup.com and www, amritcanada.ca and www (http and https), arts-collective.com and www, directory., market., paratheater., danamccool.com and www (http and https), sophia., elkdonisexperiences.com and www.
- **Google Cloud console:** nothing to add for these. Google redirects to GoTrue's callback (`https://auth.elkdonis-arts.org/callback`), and the per-site return is GoTrue's allow list above.
- Also refused today: `[handoff] refused: unknown issuer` (×2, 18:16 UTC), so some site's origin isn't in arts-collective's `isAllowedHandoffOrigin`. That allows the network host and its subdomains, `ADDITIONAL_REDIRECT_URLS` and `SITE_URL`. A site outside those, most likely hiddenenneagram.com or books.elkdonis-arts.org, can't mirror to the network host. Not traced to a request.

## 4. Fixes, in the order I'd do them (all need Justin's yes; none done)
1. **NPM: turn on Force SSL** (and HSTS when ready) for hosts 29 (paratheater), 37 (pottery) and 26 (market), and check 27 (directory) and hiddenenneagram's host. This alone ends the loop. No code, no rebuild.
2. **Justin, now:** clear site data for those three hosts (or use `https://` explicitly) to drop the stuck cookies.
3. **GoTrue `ADDITIONAL_REDIRECT_URLS`:** add the missing entries from §3, then restart GoTrue. An env change only.
4. **Code hardening** (shared `auth-server/sso-proxy.ts`, owner to name; needs a rebuild of every site):
   - in production, send an http page view to https before any SSO step;
   - and a loop guard: a return trip carries a marker, and a page that arrives with it is never mirrored again in that visit. Then a cookie that can't stick costs one extra hop, not a loop.
5. **`www.<site>.arts-collective.com`:** an NPM redirect host with a certificate, or tell people not to use it (§2).
