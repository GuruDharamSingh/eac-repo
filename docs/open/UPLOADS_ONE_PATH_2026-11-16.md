# One upload path (design, 2026-11-16)

Status: DESIGN ONLY. Nothing under `apps/` or `packages/*/src` has been touched. Direction from Justin (2026-11-16): "merging the avatars/upload etc. into one sounds good" (atlas JOURNAL, drift.md "Direction" notes).

Source read: atlas `drift.md` / `JOURNAL.md`, `ATLAS_SECURITY_2026-11-16.md` (#54 and the blog-server note), and the route and service code named below, all on eris `~/eac`.

## 0. What already exists (the shared pieces)

| Piece | Where | What it gives |
|---|---|---|
| `validateUploadBuffer(buf, kinds, {allowText})` | `packages/utils/src/file-validation.ts` | Magic-byte sniff. SVG is its own kind (`svg`), so asking for `image` refuses it. HEIC sniffs as `image/heic`. Unknown bytes are refused unless `allowText`. No size logic. |
| `uploadFilename(name, title)` | `packages/services/src/nextcloud.ts:265` | Slugged, random-suffixed, whitelisted extension. Never overwrites. |
| `getUploadPath(org, type, filename, visibility)` | `nextcloud.ts:286` | `EAC_Network/<org>/(Media\|Private/Media)/<Images\|Audio\|Videos\|Documents>/<file>`. |
| `uploadFile(path, buf, mime)`, `getProxyFileUrl(path)` | `nextcloud.ts` | Raw PUT (service account) and `/api/media/<path>`. The `path` is NOT confined here; confinement is the caller's job. |
| `uploadOrgFile(orgId, folder, name, bytes, mime, uploaderId)` | `org-storage.ts:78` | Confined under `orgStorageRoot` via `resolveWithin`, makes the folder, timestamps the name, inserts a `media` row. Used by fourthway and ifac hub. Does NOT sniff, cap, or use `uploadFilename`. |
| `uploadUserFile(slug, folder, ...)`, `resolveUserPath`, `createUserFolder`, `getStorageSlug` | `user-storage.ts` | Confined under `users/<storage_folder>`, folder from enum `USER_MEDIA_FOLDERS`. Side effect: `createUserFolder` calls `markArtistByFolder`, so EVERY person-folder write marks the person an artist of the collective (see open question 3). |
| `resolveWithin(root, rel)` | `dav.ts:55` | Throws on escape. The confinement primitive. |
| `davChunk*` | `dav.ts:270+` | Nextcloud chunking v2. |
| `mediaUploadRoutes(site)` | `packages/series-site/src/routes/mediaUpload.ts` | The only existing route-handler factory for uploads. Mounted by sunjay and ifac `/api/media/upload` (6 lines each). |
| `sitePortfolioRoutes({orgId, who})` | `services/src/site-portfolio.ts` | Factory with a POST upload into the person's folder. Mounted as `/api/center/portfolio` (17 lines) by sunjay, innergathering, hidden-enneagram. Sniffs. |
| `centerRoutes({who})` / `connectionsHandlers(who)` | `services/src/center-routes.ts`, `connections.ts:985` | The pattern to copy: services owns the handler, the app passes `who`. |
| `serveMedia(options)` | `services/src/media-serve.ts:174` | The read side. `canReadMedia` (media-authz.ts) decides per path; `inline` only for an allow-list of types, SVG/HTML go out as `attachment`, `nosniff`. Every app `/api/media/[...path]` is a thin wrapper (22 to 49 lines in the modern ones; 100+ lines in amrit-canada, elktours, sunjay, hidden-enneagram, inner-gathering, pigeonshoot are older hand copies). |
| `stripImageMetadata(buf)` | `apps/elktours/src/lib/assets.ts:455` (app-local) | sharp re-encode, drops EXIF and GPS, refuses HEIC, refuses if GPS survives. Candidate to move into services. |
| pigeonshoot re-encode | `apps/pigeonshoot/src/app/api/upload/route.ts` | sharp, `limitInputPixels`, rotate, resize to full and card sizes, jpeg. App-specific (card images), stays app-side but should use the same helper for the strip step. |

`sharp` is already a dependency of `packages/services`, so a re-encode step costs no new dependency.

## 1. Inventory

Common to the "Nextcloud" rows: bytes go to Nextcloud over the service account and are read back through `/api/media/<path>` (`serveMedia`). Any difference is noted. "Type" = what is checked: client MIME (`file.type`), magic-byte sniff, size, confinement, re-encode. All size checks use the browser-declared `file.size`, not counted bytes (the whole file is buffered anyway, `formData()` then `arrayBuffer()`; a 500 MB video is held in RAM).

### 1a. Avatar (profile picture)

| App | Route | Who | Destination | Checks | Called by |
|---|---|---|---|---|---|
| amrit-canada, elktours, hidden-enneagram, innergathering, sunjay (byte-identical, md5 a32d2092) | `api/center/avatar` POST | any signed-in person (`getViewer`) | own tree `users/<storage_folder>/Media/Images/` via `uploadUserFile` | client MIME `image/*`, 8 MB declared, NO sniff, no re-encode, no media row | `cms-ui/src/hub/connectors.ts:93,419` (`connectors.avatar`), ifac `HubSurfaces.tsx` |
| ifac | same route | same | same | same (comment text differs only) | same |
| arts-collective | same route | same (`getCurrentUser`) | same | same | same |

Gaps: client MIME only, so `image/svg+xml` or any bytes labelled `image/png` are stored (served as attachment, so not an XSS, but a signed-in person can park arbitrary files in their folder). SVG avatars store but render broken. `uploadUserFile` marks the uploader an artist as a side effect.

### 1b. Site / org media (owner or guide, org tree)

| App | Route | Who | Destination | Checks |
|---|---|---|---|---|
| sunjay, amrit-canada, elktours (md5 3f029301, 198 lines) | `api/upload` | `getApiEditor` (owner/guide) | org tree `Media\|Private/Media/<type>` by visibility | MIME picks category, caps image 25, audio 150, video 500, doc 50 MB (declared), sniff against category (SVG refused), media row via raw SQL |
| innergathering, inner-gathering (legacy) | `api/upload` | same | same | same family, minor differences (not diffed) |
| sunjay, ifac | `api/media/upload` via `mediaUploadRoutes` | owner/guide, or occurrence host (threadId + occurrenceAt) | org tree by visibility | same caps, sniff, media row |
| hidden-enneagram | `api/upload` | `getApiEditor` | org tree | image 25 / audio 60 only (`kind=audio`), sniff, media row |
| fourthwayBookreaders | `api/upload` | `getApiEditor` | `uploadOrgFile` org tree `Media/<folderForMime>` | sniff against all four kinds, SVG refused, per-kind caps by sniffed kind (bytes, not declared), media row via `uploadOrgFile` |
| ifac | `api/hub/upload` | any hub member (`getHubViewer`) | `uploadOrgFile`, any folder under the org root (client `path` field) | client MIME for cap and folder, NO sniff (security #54), confined by `resolveWithin` only |
| blog-tester, blog-guru-dharam | `api/media/upload` (4 lines) to `packages/blog-server/src/media.ts` | org owner/guide/member | org tree | client MIME (trusted), caps, NO sniff (security #13) |
| arts-collective | `api/upload/image` | member/owner/guide of the named org (or admin, or personal org) | org: `EAC_Network/<org>/<context>/(covers\|videos)/` with `overwrite: true` and own mkdir loop; personal: `uploadUserFile` | MIME picks image/video, 10 MB image / 500 MB video, sniff (note: on the org branch sniff runs after the folders are created) |
| arts-collective | `api/org/[slug]/files` | org members | org tree | file browser, separate; reads and uploads |
| danamccool | `api/media/upload` | `getViewer().canEdit` | site OWNER's personal folder, `Media/Images` or `Galleries/<slug>` (regex checked) | MIME image, 25 MB, sniff, media row |
| katie-the-potter | `api/media/upload` | `getViewer().canEdit` | artist's personal folder, same shape as dana | as dana plus HEIC refused with a friendly message |
| elastrocal (mobile) | `api/mobile/v1/media` | org owner | `Private/Jerusalem/<month>` under org root, streamed `davPutStream` | MIME prefix from header, declared length cap (audio 200, image 40, video 1000 MB), NO sniff |
| elkdonis-arts-collective (legacy) | `api/admin/media-gallery/upload` | admin | Nextcloud, `overwrite: true` | MIME, 60 MB |
| admin | `api/nextcloud/upload` | `isAdmin` | any path, `overwrite: true` | none (security #3) |
| inner-gathering (legacy) | `api/nextcloud/upload` | allowed folders list | any allowed folder, `overwrite: true` | 500 MB, no sniff |

### 1c. Personal file / artist image (person's own tree)

| App | Route | Who | Destination | Checks |
|---|---|---|---|---|
| ifac | `api/upload` | org editor or the member themself; admin-only for a profile not yet saved | `users/<storage_folder>/Media/Images`, `target=gallery\|avatar\|file`, `gallery` appends to `org_profiles.portfolio` | MIME image, 25 MB, sniff, media row if the member exists, `markArtist` |
| artdirect | `api/upload` | `canEditProfile(user, profile)` | `users/<folder>/Media/Images`, `target=gallery\|avatar\|page`, `gallery` appends to `users.portfolio` | MIME image, 25 MB, sniff, no media row (ArtDirect is not an org) |
| arts-collective | `api/my-files` POST (+GET list, DELETE) | the signed-in person | `uploadUserFile`, folder enum | sniff per folder (image, audio, video, document), 100 MB declared |
| hidden-enneagram, innergathering, sunjay | `api/center/portfolio` POST via `sitePortfolioRoutes` | the person, or admin (`canEditProfile`) | person's `Media/Images` | sniff, 25 MB |
| arts-collective | `api/upload/image` (personal branch) | any signed-in | `uploadUserFile` Images/Videos | sniff |

### 1d. Artwork image (marketplace)

| App | Route | Who | Destination | Checks |
|---|---|---|---|---|
| art-auction | `api/upload` | store owner or member, series editor, or admin | person's `Media/Images` | MIME image, 25 MB, sniff, no media row |
| art-auction | `api/series/media` | `canEditSeries` | person's folder | image 25 / video 250 MB, sniff |
| art-auction | `api/about/media` | `canEditAbout` | person's folder | image 25 / video 250 MB, sniff |

### 1e. Attachment (pipeline card, forum, materials)

| App | Route | Who | Destination | Checks |
|---|---|---|---|---|
| amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay (identical `lib/pipeline.ts`, same route) | `api/pipeline/cards/[cardId]/attachments` POST (+ `[attachmentId]` GET/DELETE) | `withMember` (org member); delete `withEditor` | NOT the media tree: Nextcloud Deck attachment (`addOrgCardAttachment`), read back through the app with `Content-Disposition: attachment`, `no-store` | 100 MB declared, non-empty, NO sniff, any type, filename and MIME from client |
| elktours | `api/upload/forum` | signed-in affiliate (follower), 20 per 10 min in-memory limiter | org tree by audience (PUBLIC / ORGANIZATION / INVITE_ONLY), `getUploadPath` | image 15 / video 100 MB, sniff, sharp re-encode with metadata and GPS strip (`stripImageMetadata`), media row |
| innergathering | `api/workshops/[id]/materials` POST | `getApiEditor` | the workshop's folder (always private per media-authz) | 50 MB, sniff all four kinds with text allowed |
| fourthwayBookreaders | `api/akhand-path/recording` POST | any reader | circle's `Meeting Recordings/<date> Day N` | audio/video sniff, 400 MB |
| fourthwayBookreaders | `api/akhand-path/uploads` | circle author or editor | circle folder | (list/serve, not diffed) |
| pigeonshoot | `api/upload` | anyone (guest cookie), rate limited, blocklist | its own `lib/nextcloud` helpers | sniff, `sharp` re-encode into full and card jpegs, pixel limit, EXIF GPS read for the card |

### 1f. Chunked / streamed large video (separate protocol)

| App | Route | Who | Destination | Checks |
|---|---|---|---|---|
| arts-collective | `api/studio/recordings/upload` (`op=start/part/finish/abort`) -> `services/recordings.ts` | signed-in person | `users/<folder>/Private/Video/Recordings/` | filename must end `.webm .mp4 .mov .m4v .mkv`, parts of at most 64 MB, parts in order, upload ids in process memory (12 h TTL), NO total cap, NO sniff |
| arts-collective | `api/broadcast/camera-upload` -> `services/obs.ts` | admin | `.../Private/Video/Camera/` | same engine |
| arts-collective | `api/capture/[code]` | phone, authorised only by a short code (`captureCreate`) | `.../Recordings/` | same engine; `ext` is `webm\|mp4` |
| arts-collective | `api/reels/upload` | signed-in person | reel project slot via `reelUploadPath`, `davPutStream` raw body | slot rules by `Content-Type` header (client), declared `Content-Length` cap (up to 1 GB), no sniff |
| elastrocal | `api/mobile/v1/media` | org owner | org tree, `davPutStream` | as 1b |
| arts-collective | `api/broadcast/graphics` | admin | OBS graphics (base64 to the obs service) | 25 MB total, folder is a client string handed to `obsGraphicsUpload` |
| arts-collective | `api/silex/publish` | (site publish, not an upload of a user file) | | out of scope |

### 1g. Client components that call these (do not change in the early steps)

`cms-ui` `MediaPicker` (reads `body.url`, sends optional `uploadFields`), `CoverField`, `GallerySurface`, `ProfileGallery`; `cms-ui/hub/connectors.ts` (avatar); `blog-client` `BlogPostEditor` (`uploadEndpoint`); `packages/ui` `MediaUpload`; `studio-forms` `MediaField` and `canvas/views/upload.ts`; `studio-ui` `multi-image-uploader`; `silex-render` `media-upload`; per-app `components/manage/media-field.tsx` (sunjay, amrit-canada, elktours, innergathering), `CoverImageUpload.tsx`, `image-upload-field.tsx` (ifac). Every one of them needs only `ok` and `url` back (some also read `filename`, `success`, `id`, `path`). That is why the response shape in section 2 keeps those keys.

## 2. The one path

### 2.1 Services function

New file `packages/services/src/uploads.ts` (exported from `index.ts`). One function does the whole job; every route is a caller of it.

```ts
export type UploadKind = 'avatar' | 'site' | 'personal' | 'artwork' | 'forum' | 'card';

export interface UploadActor { userId: string; orgId?: string }   // who is acting (already authenticated by the caller)

export interface StoreUploadInput {
  kind: UploadKind;
  actor: UploadActor;
  file: { name: string; type: string; bytes: Uint8Array };        // bytes already read
  // kind-specific, all validated inside:
  orgId?: string;               // site, forum, card: the org whose root confines the write
  ownerUserId?: string;         // personal, artwork: whose tree (defaults to actor)
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  folder?: 'Images'|'Audio'|'Videos'|'Documents';   // personal only, enum
  gallery?: string;             // personal only, ^[a-z0-9][a-z0-9-]{0,79}$
  title?: string;
  narrow?: Partial<Policy>;     // an app may only TIGHTEN: lower caps, fewer kinds
}

export type StoreUploadResult =
  | { ok: true; id: string | null; url: string; path: string; name: string; filename: string;
      mimeType: string; size: number; mediaType: 'image'|'audio'|'video'|'document';
      width?: number; height?: number }
  | { ok: false; status: 400|403|413|415|422|502|503; error: string };

export async function storeUpload(input: StoreUploadInput): Promise<StoreUploadResult>;
```

Order of work inside `storeUpload`, always the same:
1. Look up the kind's `Policy` (section 2.3); apply `narrow` (min of caps, intersection of kinds; it can never widen).
2. Size gate on `bytes.byteLength` (counted, not the browser's `file.size`). Callers also check `Content-Length` before reading the body so a 500 MB body is refused early (the factory does this).
3. Sniff with `validateUploadBuffer(bytes, policy.kinds, {allowText})`. The client MIME is never used to decide type, only as a hint for the error message. `svg` is never in any policy's kinds. The sniffed MIME (not `file.type`) is what is stored and sent to Nextcloud. Kind `card` sets `allowUnknown` (see 2.3).
4. Per-kind size cap by the SNIFFED kind (so a video labelled image does not get the image cap).
5. Re-encode images where the policy says so (shared `processImage` moved from elktours `stripImageMetadata`: sharp, rotate, drop metadata, `limitInputPixels`, refuse if GPS survives; GIF and animated WebP are kept as-is; HEIC is refused with the existing friendly message; avatar also resizes to 1024 px on the long edge).
6. Resolve the destination (section 2.4). Throws turn into `ok:false, 400`.
7. `uploadFilename(name, title)` for the name; mkcol the chain; `davPut` with the sniffed (or re-encoded) MIME.
8. Record a `media` row if the policy says `record` (best effort, as today: a failed row never fails the upload).
9. Return the one response shape.

Side effects that are not storage stay out of `storeUpload` and live in an optional `onStored(result)` hook on the route factory: ifac `target=gallery` appending to `org_profiles.portfolio`, artdirect appending to `users.portfolio`, `markArtist`. They stay app-side until a later step lifts them into the portfolio routes (see section 4).

### 2.2 Route-handler factory

New file `packages/services/src/upload-routes.ts`, same shape as `centerRoutes`/`connectionsHandlers`: services owns the handler; the app passes identity and, only where the app needs it, an authorizer.

```ts
export function uploadRoutes(opts: {
  orgId?: string;                                       // the site's org, when it has one
  who: () => Promise<{ userId: string; canEdit?: boolean; role?: string } | null>;
  kinds: UploadKind[];                                  // which kinds this app mounts
  defaultKind?: UploadKind;                             // so a legacy URL can fix the kind
  authorize?: (a: { kind: UploadKind; viewer: Viewer; form: FormData }) => Promise<boolean | { ownerUserId: string }>;
  narrow?: Partial<Record<UploadKind, Partial<Policy>>>;
  onStored?: (r: StoreUploadResult & { ok: true }, a: { kind: UploadKind; viewer: Viewer; form: FormData }) => Promise<void>;
}): { POST: (req: Request) => Promise<Response> };
```

Mounting, one file per app: `app/api/uploads/route.ts`

```ts
export const dynamic = "force-dynamic";
export const { POST } = uploadRoutes({ orgId: siteConfig.orgId, who, kinds: ["avatar","site","personal"] });
```

The form carries `file` plus `kind` (and `visibility`, `folder`, `gallery`, `title`, `threadId`+`occurrenceAt` where relevant). The legacy URLs (`/api/center/avatar`, `/api/upload`, `/api/media/upload`, `/api/hub/upload`) stay as 3-line re-exports that call `uploadRoutes({... defaultKind: "avatar"})`, so no client component changes in the early steps and no URL breaks in cached pages. Retiring legacy URLs is the last step (section 3).

What the factory does that no copy does today: refuses a body whose `Content-Length` is over the policy's biggest cap before reading it; rejects a `kind` the app did not mount; maps `StoreUploadResult` to JSON with the right status; logs one line `[uploads] <app> <kind> <userId> <size> <mime>` (no file names); owns `try/catch` so the apps stop hand-writing 40 lines of it.

### 2.3 Per-kind policy

Caps are the largest values apps use today (so no legitimate upload starts failing); where copies disagree the larger value is kept as the default and apps may `narrow`. "Re-encode" is the `processImage` step.

| Kind | Who (factory check) | Max size | Allowed (sniffed) | Re-encode images | Destination (confined) | Media row |
|---|---|---|---|---|---|---|
| `avatar` | any signed-in person (self only) | 8 MB | image (jpeg, png, webp, gif, avif); HEIC refused with message; SVG refused | YES: strip metadata, resize to 1024 px long edge, keep format class (png stays png, else jpeg or webp) | actor's own tree `users/<storage_folder>/Media/Images/` | no (as today; ifac's `target=avatar` writes one, keep via narrow `record:true`) |
| `site` | org owner or guide (`who().canEdit`), plus the occurrence-host path from `mediaUploadRoutes` through `authorize` | image 25, audio 150, video 500, document 50 MB (narrow: HE audio 60, elastrocal cap higher, see 3) | image, audio, video, document (pdf, zip/OOXML, legacy OLE), text/plain; SVG refused | YES strip metadata, no resize | org root: `EAC_Network/<orgId>/(Media\|Private/Media)/<Images\|Audio\|Videos\|Documents>/` by visibility; folder chosen from the SNIFFED kind, never from the client path | yes |
| `personal` | the person themself, or `authorize` returns `{ownerUserId}` (site owner for dana/katie, `canEditProfile` for artdirect/ifac, admin) | image 25 MB, other 100 MB (my-files today) | image by default; `folder` enum widens to audio/video/document | YES strip metadata, no resize (artist originals keep their pixels) | `users/<owner storage_folder>/Media/<folder>/` or `Galleries/<gallery>/` via `resolveUserPath`; `gallery` regex enforced | yes when the app has an org, else no (artdirect) |
| `artwork` | `authorize` required: store owner/member, series editor, `canEditAbout`, admin | image 25, video 250 MB | image (+ video when the caller asks for it) | YES strip metadata (seller phone photos carry GPS) | owner's `Media/Images` or `Media/Videos` | no (as today) |
| `forum` | `who()` plus `authorize` (affiliate check) and a per-user rate limit (the elktours 20 per 10 min, moved into services, Redis-backed when `packages/redis` is available) | image 15, video 100 MB | image, video | YES strip metadata | org root by audience visibility, `Images` or `Videos` | yes |
| `card` (pipeline attachment) | org member (`who()`); delete stays editor-only in the app | 100 MB | any KNOWN type (all sniffed kinds + text) plus `allowUnknown` for odd work files (`.psd`, `.blend`, `.key`); never SVG or HTML as an inline-served type | no (files stay byte-exact) | not the media tree: sink is `addOrgCardAttachment` (Deck), so the same front half (cap, sniff, name) and a different last step | no |

Rules that hold for every kind:
- SVG and HTML are never accepted as images (`svg` kind is in no policy). Exception for `card` with `allowUnknown`: HTML or SVG is stored as an opaque attachment; the read route already sends `attachment` + `nosniff`, and `/api/media` never serves non-allow-listed types inline. Open question 2.
- The stored MIME is the sniffed one. The extension comes from `uploadFilename`'s whitelist. (A `.png` name on JPEG bytes is renamed `.jpg` by the re-encode path; non-re-encoded types keep the whitelisted client extension.)
- Never overwrite: every name has a random suffix; the arts-collective and admin/legacy routes that pass `overwrite: true` move to this path or stay documented as admin-only exceptions.
- A caller can only tighten via `narrow`.

### 2.4 Destination confinement

One resolver inside `uploads.ts`, the only code that turns kind + inputs into a Nextcloud path:

- org root: `resolveOrgPath(orgId, "Media|Private/Media/<fixed enum>")`. The caller never supplies a path. The ifac `hub/upload` "any folder under the org root" behavior is dropped (members get `Media/<type>` only; an editor needing another folder uses the file-manager routes, which are a different surface).
- person root: `resolveUserPath(slug, "Media/<enum>/..." | "Galleries/<regex slug>/...")`. The slug is `getStorageSlug(ownerUserId)` (`users.storage_folder`), never a client field. `memberSlug`/`slug` form fields are resolved to a user id first and run through `authorize` (that is today's ifac and artdirect flow).
- Org access is the caller's job but is made impossible to forget: `site`, `forum` and `card` take `orgId` from the factory options (the site's own org), never from the form. The only route with a form-supplied org today is arts-collective `upload/image` (`orgSlug`); it stays an `authorize` callback that resolves the slug and checks `hasOrgRole`, and returns the org id.
- `resolveWithin` throws on `..`, absolute paths and separators; every throw maps to 400. `orgStorageRoot` and `userStorageRoot` already reject `/` and `..` in ids.

### 2.5 Response shape

Success, HTTP 200:

```json
{ "ok": true, "success": true, "id": "<media id or null>", "url": "/api/media/EAC_Network/...",
  "path": "EAC_Network/...", "name": "nightjar-4k9wqp.jpg", "filename": "Nightjar.jpg",
  "mimeType": "image/jpeg", "size": 123456, "mediaType": "image", "width": 1600, "height": 1200 }
```

`success` and the original-name `filename` are kept so every existing client (MediaPicker reads `url`; ifac and gallery code read `filename`, `id`; `mediaUploadRoutes` clients read `name` as the ORIGINAL name, so for the legacy `/api/media/upload` shim `name` = original name, a documented quirk of that shim only) keep working. Failure: `{ "ok": false, "error": "<message a person can act on>" }` with status 400 / 401 / 403 / 413 / 415 / 422 / 502. Messages come from services, one wording per case ("That file is over the 25 MB limit", "This looks like an SVG, which is not accepted", "HEIC photo: please send a JPEG").

### 2.6 `/api/media` stays the single read path

Uploads return only `/api/media/<path>`, never a Nextcloud URL. Reads are untouched by this work: `serveMedia` + `canReadMedia` (private paths authorised by org affiliation or the person), `inline` only for the allow-list, `attachment` otherwise. Consequences for the design:
- Visibility is encoded in the PATH (`Private/Media`), so `site` and `forum` must put audience content under `Private/` exactly as `getUploadPath` does today; no per-file flag is introduced.
- Card attachments are served by their own `[attachmentId]` route (Deck bytes, `no-store`, `attachment`); that is a different store, so it stays its own read route.
- Separate cleanup, not part of this work: the 100+ line hand-copied `/api/media/[...path]` routes (amrit-canada, elktours, hidden-enneagram, inner-gathering, pigeonshoot, sunjay) should collapse to the 22 to 49 line `serveMedia` wrapper. It is the read-side twin of this merge and can be a later step; `serveMedia`'s allow-list already carries the SVG-as-attachment protection.

## 3. Migration order

Rule for every step: write the new services code first (nothing imports it, so nothing changes on disk that builds ship), then switch consumers one app at a time, each its own small commit, then rebuild only the apps listed. Atlas capability rows are updated in the same commit as each step (merged rows, new hosts).

### Step 0: services groundwork (no app rebuild)
New: `packages/services/src/uploads.ts`, `packages/services/src/upload-routes.ts`, `packages/services/src/image-process.ts` (moved from elktours `stripImageMetadata` plus the resize). Edit: `packages/services/src/index.ts` (exports). Add tests (section 5). Nothing imports it yet; apps that consume `@elkdonis/services` do not need a rebuild until they use it.
Rebuild: none.

### Step 1: avatar (7 near-identical copies, smallest blast radius)
Files (the entire step; each becomes a 3-line `uploadRoutes({... kinds:["avatar"], defaultKind:"avatar"})` re-export, `who` taken from the app's existing viewer helper):
- `apps/amrit-canada/src/app/api/center/avatar/route.ts`
- `apps/elktours/src/app/api/center/avatar/route.ts`
- `apps/hidden-enneagram/src/app/api/center/avatar/route.ts`
- `apps/innergathering/src/app/api/center/avatar/route.ts`
- `apps/sunjay/src/app/api/center/avatar/route.ts`
- `apps/ifac/src/app/api/center/avatar/route.ts` (only the comment differs from the five above)
- `apps/arts-collective/src/app/api/center/avatar/route.ts` (uses `getCurrentUser` from `@/lib/session` instead of `getViewer`)

No client change: `packages/cms-ui/src/hub/connectors.ts:93` keeps `/api/center/avatar`, and the response keeps `ok`, `url`.
Behaviour changes to call out to Justin: avatars now sniffed (an SVG or non-image labelled `image/*` is refused with a clear message), re-encoded and resized to 1024 px, metadata stripped; limit stays 8 MB. No change to who may upload or where it lands. The artist-marking side effect is preserved in this step (open question 3).
Rebuild: all seven apps (`amrit-canada`, `elktours`, `hidden-enneagram`, `innergathering`, `sunjay`, `ifac`, `arts-collective`). A reasonable cut is two batches, with `sunjay` first as the canary (it is also where `mediaUploadRoutes` lives, so it will be rebuilt again in step 2).

### Step 2: site / org media (the `mediaUploadRoutes` and `/api/upload` family)
2a. Move `mediaUploadRoutes` onto `storeUpload` (keep its signature and its occurrence-host check as the `authorize` callback so ifac and sunjay stay a 6-line file):
- `packages/series-site/src/routes/mediaUpload.ts` (body replaced; `apps/ifac/.../api/media/upload/route.ts` and `apps/sunjay/.../api/media/upload/route.ts` unchanged)
- rebuild: `ifac`, `sunjay`

2b. Org-editor `/api/upload` copies to `uploadRoutes({kinds:["site"]})`:
- `apps/sunjay/src/app/api/upload/route.ts`, `apps/amrit-canada/src/app/api/upload/route.ts`, `apps/elktours/src/app/api/upload/route.ts` (md5-identical 198-line copies)
- `apps/innergathering/src/app/api/upload/route.ts` (diffs from the three; read the diff before switching)
- `apps/hidden-enneagram/src/app/api/upload/route.ts` (narrow audio to 60 MB, images only plus audio)
- `apps/fourthwayBookreaders/src/app/api/upload/route.ts` (already sniffs and uses `uploadOrgFile`; becomes the same call)
- `apps/ifac/src/app/api/hub/upload/route.ts` (fixes #54: sniff, `Media/<type>` only, no client `path`)
- `apps/blog-tester/src/app/api/media/upload/route.ts` and `apps/blog-guru-dharam/src/app/api/media/upload/route.ts` plus `packages/blog-server/src/media.ts` (fixes #13: stops trusting the browser MIME; blog-server keeps its own member check as `authorize`)
- rebuild: `sunjay`, `amrit-canada`, `elktours`, `innergathering`, `hidden-enneagram`, `fourthwayBookreaders`, `ifac`, `blog-tester`, `blog-guru-dharam`
- NOT in this step: `inner-gathering` (legacy app, compose retired), `elkdonis-arts-collective` media-gallery, `admin` nextcloud upload, `inner-gathering` nextcloud upload. These are admin/file-manager surfaces with `overwrite: true`; they are fixed by the separate security items (#3) not by joining the media upload path.

2c. arts-collective `upload/image` and the CoverImageUpload caller:
- `apps/arts-collective/src/app/api/upload/image/route.ts` (org branch moves onto `site` with the org resolved by `authorize`; personal branch onto `personal`; the free `context` subfolder (`Workshops/covers`) is kept through an optional, regex-checked `subfolder` that is always under the org root, because workshop/event covers are addressed by that path today)
- rebuild: `arts-collective`

### Step 3: personal, artwork, forum and attachments
3a. personal / gallery (artist trees): `apps/danamccool/src/app/api/media/upload/route.ts`, `apps/katie-the-potter/src/app/api/media/upload/route.ts` (keep the HEIC message through the policy's `heicMessage`), `apps/ifac/src/app/api/upload/route.ts` and `apps/artdirect/src/app/api/upload/route.ts` (portfolio append moves to `onStored`), `apps/arts-collective/src/app/api/my-files/route.ts` (POST only; GET/DELETE untouched), and `packages/services/src/site-portfolio.ts` (its POST calls `storeUpload`). Rebuild: `danamccool`, `katie-the-potter`, `ifac`, `artdirect`, `arts-collective`, `sunjay`, `innergathering`, `hidden-enneagram`.
3b. artwork: `apps/art-auction/src/app/api/upload/route.ts`, `api/series/media/route.ts`, `api/about/media/route.ts`. Rebuild: `art-auction`.
3c. forum: `apps/elktours/src/app/api/upload/forum/route.ts` (limiter moves to services, `stripImageMetadata` import in `apps/elktours/src/lib/assets.ts` re-exports from services so the asset pipeline keeps working). Rebuild: `elktours`.
3d. pipeline attachments: the six identical `app/api/pipeline/cards/[cardId]/attachments/route.ts` (POST only) in `amrit-canada`, `elktours`, `hidden-enneagram`, `ifac`, `innergathering`, `sunjay`; sink stays `addOrgCardAttachment`. Rebuild those six.
3e. elastrocal mobile media, pigeonshoot `api/upload` and workshop materials/akhand-path recording: adopt only the shared front half (cap by counted bytes, sniff, name) via `storeUpload`'s lower-level `checkUpload(bytes, policy)` export; they keep their destinations. Rebuild: `elastrocal`, `pigeonshoot`, `innergathering`, `fourthwayBookreaders`.

### Step 4: retire legacy URLs and clients
After the shims have been live and nothing logs the old paths for a few days: point `cms-ui` `connectors.ts`, `MediaPicker` users and per-app `media-field.tsx` at `/api/uploads?kind=...`, delete the shims, update the atlas rows. Rebuild: every app that was touched above (one final pass).

## 4. What stays separate, and why

1. **The chunked recording protocol** (`api/studio/recordings/upload`, `api/broadcast/camera-upload`, `api/capture/[code]`, `services/recordings.ts`). It truly differs: multi-request (`start`/`part`/`finish`/`abort`), parts up to 64 MB, ordered, upload ids in process memory (a restart drops unfinished uploads by design), Nextcloud chunking v2 assembly on `finish`, a phone-capture mode authorised by a one-time code and not a session. A single multipart POST cannot carry a multi-gigabyte recording. What they SHOULD share, and what step 3 adds to them without changing the protocol:
   - the sniff: validate part 1's bytes with `validateUploadBuffer(part, ["video"])` (today only the extension is checked);
   - a total cap (today unlimited parts; add e.g. 4 GB, counted as parts arrive);
   - the destination helper (`userStorageRoot` + fixed `Private/Video/<folder>`; already confined, keep);
   - the same error wording and the one `[uploads]` log line.
2. **`reels/upload` and elastrocal `mobile/v1/media`** stream the raw body to Nextcloud (`davPutStream`) with no buffering; they should keep streaming, because buffering 1 GB defeats the point. Add a counted-bytes stream guard and a sniff of the first chunk instead.
3. **Pipeline card attachments** keep their SINK (Deck) and their own read route; they only join the front half of the pipeline (section 2.1 steps 1 to 5).
4. **File managers** (`admin/api/nextcloud/*`, `arts-collective/api/org/[slug]/files`, `inner-gathering/api/nextcloud/upload`, `elkdonis-arts-collective` media-gallery, `broadcast/graphics`): they take arbitrary paths by design (admin tools, OBS folders). They are not the "media upload" path; their fixes belong to ATLAS_SECURITY items #3 and #54.
5. **pigeonshoot's card derivatives** (full + card jpegs, EXIF capture time, guest cookies, rate limit, blocklist): app-specific pipeline. It adopts only the strip helper and the cap/sniff front half.
6. **Portfolio list writes** (`appendOrgPortfolio`, `users.portfolio`, `setOrgPortfolio`): a profile edit, not an upload. The ifac `target=gallery` and artdirect `target=gallery` behaviours stay as `onStored` hooks until the portfolio editors call the portfolio routes themselves.

## 5. Tests

Run as a script against `storeUpload` with the Nextcloud layer stubbed (`davPut` and `davMkcol` recorded, not called), plus a handful of live route checks after each step's rebuild (curl with a real cookie, cleaning up the test file through the DAV delete helper). The unit tests live next to the code in `packages/services` (a vitest or node:test file; the repo has no test runner wired in `packages/services/package.json`, so step 0 adds one with `node --test` and no new dependency).

For EVERY kind:
- An SVG named `a.png` with `Content-Type: image/png` is refused 415, nothing is written.
- An SVG named `a.svg` with `image/svg+xml` is refused 415.
- HTML bytes labelled `image/jpeg` are refused 415 ("Unrecognized file content").
- A PNG labelled `video/mp4` goes to `Images` not `Videos` for `site`; the stored MIME is `image/png`.
- A file of `cap + 1` bytes is refused 413 and one of `cap` bytes passes, and a body whose `Content-Length` lies low but whose counted bytes exceed the cap is refused (counted bytes decide).
- Path traversal: `gallery=../x`, `gallery=a/b`, `folder=../../x`, `memberSlug=../x`, a `title` of `../../x.png`, a file named `..%2f..%2fx.png` and a client `path` field never leave the confinement root (the resolver throws, route answers 400); the stored path starts with the expected root.
- The filename is `uploadFilename` shaped (random suffix, whitelisted extension) and a second upload of the same name does not overwrite.
- Unauthenticated -> 401; wrong role -> 403; a `kind` the app did not mount -> 400.

Per kind:
- `avatar`: a person cannot write into another person's tree even with a forged `ownerUserId` or `memberSlug` field (ignored); a 4000 x 3000 JPEG returns at most 1024 px on the long edge with EXIF GPS removed (`exifr.gps` returns null); a HEIC returns the friendly message; an animated GIF is kept.
- `site`: a member (non-editor) is refused; an editor's file lands under the site's org and NOT another org even if the form has `orgId`/`orgSlug` (ignored); `visibility=ORGANIZATION` lands under `Private/Media`; the `media` row has the right `org_id`; an occurrence host can upload only for a thread in this org and an occurrence they host; ifac `hub/upload` no longer accepts a `path` field (it is ignored, file lands under `Media/<type>`).
- `personal`: a person cannot upload to another person's folder; an editor can for the artist slug they are allowed (`canEditProfile`); `gallery` regex accepted values pass and bad ones 400; for a user with no storage folder the answer is 409 with the "storage not set up" message.
- `artwork`: a signed-in person with no store is 403; a series editor of another series is 403; video up to 250 MB passes, 251 MB fails.
- `forum`: the 21st upload in 10 minutes is 429 with `Retry-After`; a non-affiliate is 403; the stored image has no GPS; the audience maps to the right visibility folder.
- `card`: a member of another org cannot attach to this org's card (`requireCard` already enforces; test pins it); an unknown-type file passes; an executable passes as an attachment and is served `attachment` + `nosniff`; an empty file is 400.
- Chunked (step 3 additions): part 1 that is not video is refused at `part`; a 5th GB of parts is refused (total cap); an upload id from another user is refused (`ownUpload`, existing, pin with a test).
- Read side: `/api/media/<svg path>` returns `Content-Disposition: attachment` and `nosniff`; `/api/media/<Private path>` for a non-affiliate is refused.

## 6. Open questions for Justin

1. **Avatars: re-encode and shrink to 1024 px, and refuse SVG?** Re-encoding makes every avatar safe and small and strips location data, but it changes the stored bytes (a transparent PNG logo stays PNG; a very large photo is downsized). Yes or no? (Recommended: yes.)
2. **Pipeline card attachments: allow any file type?** Today any file up to 100 MB is accepted unchecked. The plan accepts any KNOWN type, plus unknown ones as opaque attachments (so a `.psd` or `.blend` still works). Should HTML and SVG be allowed as attachments (they are always downloaded, never shown inline), or refused? (Recommended: allow, since the read route forces download.)
3. **Does uploading an avatar make a person an "artist" of the collective?** Today it does, by accident: every write into a person's folder runs `markArtistByFolder`, so a person who only set a profile picture is listed as an oad member. The plan preserves that in step 1 so nothing visible changes. Do you want avatar uploads to stop marking people as artists (the likely intent), or is that behaviour wanted?

   **Answered 2026-11-24 (developer):** no upload marks anyone. `markArtistByFolder` is removed; `oad` membership is a deliberate step. Where an avatar for a person without space should be stored (org folder) is not done: see identity-and-tenancy.md, "Platform membership".

## Justin's notes (2026-11-16, after this design)
- **Per-org avatars and descriptions, with fallback.** A person may carry an org-specific avatar and bio (versioned per org) that falls back to their network profile (`users.avatar_url`/`bio`). This extends sunjay's `org_profiles.bio_override` pattern and the #20 fix (write the org half, not the global row). For this plan: the `avatar` kind takes an optional `orgId`. With an org, it stores the image under the org and records it on the org profile; without one, it updates the network profile. Readers resolve org first, then global. Keeping earlier versions is wanted ("allow versioning").
- **Uploads should go through the content library.** Uploads and the library were already moving toward the content library (`docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md`). `storeUpload` should create or attach content-library media items rather than loose files, so an upload is findable and reusable in the library.
- cms-ui vs site-forms: Justin hasn't compared them yet; noted as an open comparison (cms-ui is in 16 apps, site-forms in 6).

## Implementation log: Steps 0 and 1 (2026-11-16, same day)

**Built (not rebuilt, not committed, migration not applied):**
- `packages/services/src/uploads.ts` (`storeUpload`, `checkUpload`, `UPLOAD_POLICIES`, `applyNarrow`, `registerLibraryItem`, `resolveAvatarUrl`), `upload-routes.ts` (`uploadRoutes`), `image-process.ts` (`processImage`, `UploadRefusal`); exports added at the end of `packages/services/src/index.ts`.
- The 7 `app/api/center/avatar/route.ts` files are now shims: `uploadRoutes({ orgId, who, kinds:["avatar"], defaultKind:"avatar" })` (arts-collective has no single org, so it omits `orgId`).
- Tests: `packages/services/scripts/check-uploads.mts` (69 checks, stubbed storage and DB, passes). Backups of the 8 changed files: `~/eac-backups/uploads-step1-2026-11-16/`.
- Kinds implemented in `storeUpload` already: avatar, site, personal, artwork, forum. Card attachments adopt only `checkUpload` (their sink stays Deck).

**Changes from the design above, found while testing:**
- Plain-text loophole closed: `allowText` is honoured only when the person said it is text (`text/plain`, `.txt`, `.md`, `.csv`), and text that starts with `<` is refused. Before this, HTML or any NUL-free binary sent to a route with `allowText` sniffed as "text" and was stored as a document. The existing `/api/upload` copies do the same only when `file.type === "text/plain"`; step 2 inherits the stricter rule.
- The route factory takes a test-only `io` option (swap storage and DB).
- Response keeps `ok`, `success`, `url`, `path`, `name`, `filename`, `mimeType`, `size`, `mediaType`, `width`, `height`, plus `id` (library row) and, for org avatars, `recorded` and `versionId`.

**Justin's notes, how they landed:**
- (a) Per-org avatars. `avatar` takes `scope=org` on the form (never an `orgId` field; the org is the site's own, or what `resolveOrg` returns). With an org: the person must hold a role (not viewer) or an `org_profiles` row; the image goes to `EAC_Network/<org>/Media/Images/Avatars/`; `org_profiles.photo_override` (exists since migration 084, "falls back to users.avatar_url") is upserted; a version row is written. Without `scope=org` nothing changes: the person's own tree, the route returns the URL, the client saves `users.avatar_url` as before. Versioning: new migration `packages/db/migrations/276_profile_avatar_versions.sql` (`profile_avatar_versions`, one current row per person per org, org NULL = network). It is written and NOT applied; `storeUpload` catches "table missing" (42P01) and only loses the history. 275 is left for `lms_dock_state`. Reader: `resolveAvatarUrl(userId, orgId?)` returns org first, then `users.avatar_url`. No page uses it yet, and no client sends `scope=org` yet (step 2 wiring). Network-avatar history is not recorded yet (the client decides when `users.avatar_url` changes).
- (b) Content library. The content-library doc covers threads and artworks (`@elkdonis/content`); it has no media items, and `studio_items` is a person's Studio lineage. The one library of media that exists is the `media` table that every picker's Library tab lists. So `storeUpload` writes through ONE seam, `registerLibraryItem(item)` in `uploads.ts`, which today inserts that row (site, personal and forum; avatars and artwork write no row, as today). When media items join the content library, change that one function.
- (c) `markArtistByFolder` is kept on the network avatar path (it runs inside `createUserFolder`). Still open question 3. Org avatars do NOT call it (they write under the org, not a person folder), which is a small difference to confirm.

**Left for step 2:** `mediaUploadRoutes` onto `storeUpload`; the `/api/upload` copies and `hub/upload`; blog-server; arts-collective `upload/image`; wire a `scope=org` toggle into the avatar UI (`cms-ui/src/hub/connectors.ts:419` posts the avatar) and switch the profile readers to `resolveAvatarUrl`; apply migration 276 when Justin agrees; add a `check:uploads` script to `packages/services/package.json`.
