# Cloudflare DNS import files (2026-11-06)

One BIND file per domain, for Cloudflare's DNS → Records → Import and Export →
Import. Every proxiable record is tagged `cf-proxied:false` (grey cloud), so
switching nameservers changes nobody's traffic. Proxying is a later, per-host step.

## Sources

| File | Source | Records |
|---|---|---|
| `arts-collective.com.txt` | cPanel UAPI `DNS/parse_zone`, account `wyxalsmy` | 30 |
| `elkdonis-arts.org.txt` | same | 29 |
| `amritcanada.ca.txt` | same | 21 |
| `hiddenenneagram.com.txt` | same | 18 |
| `ifacgroup.com.txt` | names from the cPanel copy, values from public DNS (the live zone is in another Bluehost account: its copy here has apex 50.6.19.74, public answer 69.196.152.249) | 23 |
| `danamccool.com.txt` | public DNS only (zone in another Bluehost account) | 5 |
| `elkdonisexperiences.com.txt` | public DNS only (nameservers `systemdns.com`) | 2 |

Verified 2026-11-06: each of the 128 records was queried at 1.1.1.1 and matched.
Left out on purpose: SOA, NS (Cloudflare supplies its own), `localhost A 127.0.0.1`,
two stale `_acme-challenge` TXT records on arts-collective.com.
Added: `live.arts-collective.com A 69.196.152.249`, the public RTMP ingest
(`RELAY_PUBLIC_INGEST_URL`), which today resolves only through the wildcard.

Not in the files: `amrit-toronto.ca` (in the cPanel account, but served by
WordPress.com nameservers). danamccool.com and elkdonisexperiences.com were read
by probing common names, so a record under an unusual name could be missing:
check the live zones with whoever holds those accounts.

## Steps per domain

1. Cloudflare → Add a domain → enter it. If Cloudflare's scan pre-fills records,
   delete them all, then import the file (scanned copies duplicate or conflict,
   and the scan proxies some records).
2. Leave "Proxy imported DNS records" unticked; the tags already say grey.
3. Compare the record count with the table above.
4. At the registrar, replace the nameservers with the two Cloudflare names.
   Bluehost: Domains → the domain → DNS/Nameservers. elkdonisexperiences.com:
   the systemdns registrar. ifacgroup.com and danamccool.com: their own accounts.
5. After the switch: `dig +short NS <domain> @1.1.1.1` shows Cloudflare;
   `dig +short A <domain> @1.1.1.1` still shows 69.196.152.249; send a test
   mail through SendGrid from that domain.

## Proxy later (orange), after NPM trusts Cloudflare's IPs and SSL is Full (strict)

- arts-collective.com: `@`, `www`, `*`, `directory`, `edit`, `forum`, `market`
- elkdonis-arts.org: `@`, `www`, `*`, `auth`, `eac`, `edit`, `meetings`
- amritcanada.ca, hiddenenneagram.com, ifacgroup.com, danamccool.com,
  elkdonisexperiences.com: `@`, `www`

## Never proxy

- `mail`, `webmail`, `cpanel`, `ftp`, `whm`, `ssh`, `webdisk`, `autoconfig`,
  `autodiscover`, `imap`, `pop`, `smtp`: Bluehost hosting and mail.
- `em*`, `s1._domainkey`, `s2._domainkey`: SendGrid domain authentication fails
  when proxied.
- `live.arts-collective.com`: RTMP on 1935 is not HTTP.
- `cloud.elkdonis-arts.org`: Nextcloud; Talk's TURN (3478) and uploads over
  100 MB do not pass the free-plan proxy.

## Open questions for the developer

- `MX 10 <apex>` on elkdonis-arts.org and ifacgroup.com points mail at this
  server, which runs no mail service (assumed, not checked). Once the apex is
  proxied that fallback resolves to Cloudflare. Removal is suggested; the files
  keep it so the switch alone changes nothing.
- `ftp`/`cpanel`/`webmail` CNAMEs to the apex on arts-collective.com,
  elkdonis-arts.org and ifacgroup.com already resolve to this server, not
  Bluehost, so they do not reach cPanel today. Left as they are.
