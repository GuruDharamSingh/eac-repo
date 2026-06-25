# Nextcloud & Upload Security

How user-uploaded files and owner-authored Silex HTML are defended, and the
ops steps that complete the picture.

## Threat model

Org owners get write access (via app routes today; via NC shares once
share-based provisioning lands) to their org's folders. The risks:

1. **Malware via upload** — a compromised owner machine drops infected files
   that other members then download (or open in Collabora/Talk).
2. **MIME spoofing** — an executable/HTML payload uploaded with a fake
   `Content-Type: image/png`.
3. **XSS against public visitors** — owner-authored Silex HTML is rendered on
   the public org sites; a malicious (or compromised) owner publishes
   `<script>`-bearing pages.
4. **Scriptable files served inline** — SVG/HTML navigated to directly on the
   app origin executes in the app's cookie context.

## Code-level layers (implemented)

| Layer | Where |
|---|---|
| DOMPurify sanitization of Silex HTML at render | `packages/silex-render/src/silex-site.tsx` → `sanitizeSilexHtml()` in `packages/utils/src/sanitize-silex.ts` |
| Same sanitization at publish ingestion | `apps/arts-collective/src/app/api/silex/publish/route.ts` |
| Magic-byte validation on uploads (client MIME never trusted) | `packages/utils/src/file-validation.ts`, applied in `apps/{arts-collective,inner-gathering,art-auction}` upload routes |
| SVG treated as scriptable, not as an image | `sniffFileType()` returns kind `svg`; default media pipelines reject it |
| `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` for non-passive types | media proxy routes in arts-collective, inner-gathering, art-auction |
| No raw `.html`/`.js` served from published assets; SVG served with `Content-Security-Policy: sandbox` | `api/silex/assets/[slug]/[...path]` routes (arts-collective, hidden-enneagram) |
| Owners cannot write to the published path directly (publish pipeline only) | target state of share-based provisioning (`packages/nextcloud/src/org-provisioning.ts`) |

The render-time sanitizer is the choke point: even if hostile HTML reaches
storage through WebDAV directly (bypassing app routes), it cannot reach a
visitor's browser unsanitized.

## Ops: enable ClamAV (Antivirus for Files)

Nextcloud AIO bundles an optional ClamAV container. Two steps:

1. **AIO interface** (`https://<server>:8443`) → enable the **ClamAV** option
   → restart containers. This starts `nextcloud-aio-clamav` and pre-configures
   the *Antivirus for Files* app to use it.
2. Verify in Nextcloud **Administration → Security** that *Antivirus for
   Files* shows mode **ClamAV daemon** with host `nextcloud-aio-clamav`,
   port `3310`. Set the action on infected upload to **Delete file**.

Manual alternative (non-AIO installs):

```bash
docker compose exec --user www-data nextcloud-aio-nextcloud php occ app:enable files_antivirus
docker compose exec --user www-data nextcloud-aio-nextcloud php occ config:app:set files_antivirus av_mode --value=daemon
docker compose exec --user www-data nextcloud-aio-nextcloud php occ config:app:set files_antivirus av_host --value=nextcloud-aio-clamav
docker compose exec --user www-data nextcloud-aio-nextcloud php occ config:app:set files_antivirus av_port --value=3310
docker compose exec --user www-data nextcloud-aio-nextcloud php occ config:app:set files_antivirus av_infected_action --value=delete
```

Note: ClamAV scans files on upload through Nextcloud (web, WebDAV, sync
clients). It does not retroactively scan existing files — run
`occ files_antivirus:scan` (or a background scan) after first enabling it.

## Ops: restrict external sharing

Per the provisioning design, new NC accounts should not create public links:

- Nextcloud **Administration → Sharing**: restrict to within the
  `EAC_Network` group, or disable public link creation for non-admin groups.

## Residual risks (accepted for now)

- `applyWorkshopTraits` injects DB-sourced workshop fields into published HTML
  *after* sanitization; those fields are owner-authored via app forms. Audit
  `@elkdonis/cms-bindings` escaping before exposing trait-bound templates to
  less-trusted roles.
- The Silex connector publish path (`NextcloudHosting.js`) writes whatever the
  editor produces; storage content is untrusted by design and is sanitized at
  render. Do not add any raw passthrough of published HTML.
- App passwords stored in `users.nextcloud_app_password` are currently the
  account password (see `generateAppPassword` TODO in
  `packages/nextcloud/src/users.ts`). Replace with real per-app passwords and
  encrypt at rest when auth hardening comes up.
