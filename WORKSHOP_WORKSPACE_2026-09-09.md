# The workshop as a workspace

**2026-09-09.** What a workshop is on this platform, where it lives, what was
built today on `apps/innergathering`, and what is still open. Read with
`HEADLESS_CMS_DIRECTION.md` (one thread, many surfaces) and
`nextcloud_storage_architecture` (principal-canonical tree).

## The idea, in one line

**One URL that shows more as you get closer.** A workshop is never three
places — a public page, a members' area, an admin form. It is one page, and
joining it, or running it, unlocks more of the same page.

| Distance | What you are | What the page shows |
|---|---|---|
| Feed | anyone | the card: cover, title, discipline, price, next date |
| Page | anyone | banner, hero, description, sessions with their *open* files, join |
| Workspace | enrolled | + the materials folder, each session's *participants-only* files, recordings, the Talk room, who else is coming |
| Desk | guide / org editor | + add and remove materials, the composer over the same page, the roster |

This is the surface principle (`project_surface_system`) applied to a
workshop: the face and the depth are one thing at two sizes. Nothing is
duplicated into a "portal"; the enrolment *is* the key.

## Where it lives

```
threads                       kind='workshop'  — title, body, price, schedule, RSVP
workshop_pages                the page's own fields (banner + focal, hero, colour, level…)
workshop_sessions             the chapters; notes JSONB carries image, colour, resources[]
thread_rsvps / workshop_join_requests   enrolment (RSVP "yes", or a paid join)

EAC_Network/<org>/workshops/<threadId>/materials/     the shelf
EAC_Network/users/<slug>/{Media,Private}/             a person's own things — NOT copies
```

Two storage rules fall out of the user-folder audit:

1. **The org owns the workshop's files.** `workshops/<id>/materials` is canonical
   and stays under the org. A person's folder (`users/<slug>/`) holds what is
   theirs — portrait, their own work — never a copy of course material. Access
   to the shelf is a *relationship* (enrolled), not a file that moves.
2. **Two doors, one key.** The browser reads the shelf through `/api/media`,
   gated by enrolment. A participant with a Nextcloud account additionally
   gets the folder *shared* into their own Files (read-only; the guide
   read-write) — same folder, second door, optional. The share never gates the
   page, and the page never depends on the share.

The materials folder is the shelf; a session's resources are the reading for
that week. Same gate for both. A recording is just a participants-only
resource of type `video` on the session it recorded.

## What was built today

**Shared (`packages/`)** — org-agnostic, every app gets it:

- `media-authz`: `EAC_Network/<org>/workshops/<id>/…` is now its own principal
  kind (`workshop`), always private, gated by `canAccessWorkshopMaterials` =
  author ∨ enrolled ∨ org editor. **Before this, every media proxy on the
  network served the PDFs in those folders to anyone with the URL** — the
  folder parsed as a public org path, and the Nextcloud shares only ever
  governed humans logged into Nextcloud. Verified with real ids after the
  change: enrolled → allowed, outsider → denied, anonymous → denied, public
  imagery unchanged; arts-collective's proxy picked it up without a rebuild.
- `workshop-offerings`: `listWorkshopMaterials`, `ensureWorkshopMaterialsFolder`,
  `uploadWorkshopMaterial` (names kept, not timestamped — a reading list is
  referred to by name), `deleteWorkshopMaterial`. Listing returns `/api/media`
  URLs, so there is one gate, not a bespoke download route per app.
- `cms-ui` composer: sessions now have a **files & links** editor — paste an
  address or pick/upload through the host's media slot (which learned
  `accept`), each row *on the open page* or *participants only*. The data
  model always had `resources[]`; nothing could put anything in it.
- Migrations **115–116**: `workshop_details` folded into `workshop_pages` and
  dropped; the one published workshop's $20 price recovered (its pricing blob
  was double-encoded JSON, which 115's type test could not see).
- Workshop Silex template docs: facilitator fields now say `users` +
  `org_profiles.role_title`, which is what the query has done for a while;
  `artist_profiles` is gone from that template. The testimonials section is
  annotated: `workshop_testimonials` does not exist.

**innergathering:**

- The workshop page renders the **Materials** section: list + download for the
  enrolled, a count-only teaser ("3 files for participants. Join the workshop
  to open them.") for everyone else, add/remove for the guide. Per-session
  participants-only resources unlock on the same page; the roster shows to
  members.
- `POST/GET/DELETE /api/workshops/[id]/materials` — bytes are sniffed
  (`validateUploadBuffer`), never trusted by extension.
- RSVP mirrors into Nextcloud: join → read-only share of the folder, leave →
  revoked; save → folder exists and the saver holds it read-write. All
  best-effort, never blocking (only provisioned accounts can receive a share).
- `/manage/compose` now offers workshops like `/hub` already did.
- `listAttendees` moved off `artist_profiles` onto `users` + `org_profiles`.

## Still open — in the order I would take them

1. **arts-collective's own SQL** in `lib/cms/actions.ts#saveWorkshopAction`
   writes the same tables the shared `upsertWorkshopOffering` writes. Move it
   onto the service; then materials, sessions' resources and the share hooks
   are one implementation.
2. **One workshop per Silex site.** `getOrgWorkshopForTemplate` is `LIMIT 1`:
   the template renders the org's *primary* workshop. Per-workshop Silex pages
   need `threads.template_id` and a per-thread render path — the same blocker
   `arts_collective_cms_state` recorded for subdomains.
3. **A guide's desk in the hub** — a tile: your workshops, enrolled counts,
   what was added this week. Everything it needs is already readable.
4. **Participant contributions.** When exercises come back, the natural home
   is `workshops/<id>/participants/<slug>/` (org-owned, shared to that person
   read-write and to the guide). Keeps custody with the org and follows
   "record authored-by, don't worry where it sits".
5. **Tell people.** New material → an email to the enrolled; the reminder
   plumbing from `workshop_suite_progress` is the place.
6. `workshop_testimonials` — either a table or drop the section.
7. `portfolio` and `dossier-classified` manifests still document
   `artist_profiles` (13 and 17 mentions). Docs, not queries — same scrub.
