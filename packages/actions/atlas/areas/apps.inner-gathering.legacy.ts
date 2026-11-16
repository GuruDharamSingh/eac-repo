import type { Area } from '../types';

// inner-gathering (the hyphenated LEGACY twin, Mantine stack): all 101 write hosts ignored as one decision.
// 2026-11-16, round 2 (curator ig). Evidence that it is not deployed (all read 2026-11-16):
//   - `docker ps -a`: container eac-inner-gathering is "Exited (0) 5 weeks ago"; only eac-innergathering runs.
//   - nothing listens on :3004 (`ss -ltn` shows 3015 only; curl 127.0.0.1:3004 gets no answer).
//   - docs/reference/apps.md: "superseded by apps/innergathering", status "retiring", "Do not build features into
//     apps/inner-gathering". (Its line "still running in prod mode" is stale.)
//   - org_domains: no row points at it; the one host that did, meetings.elkdonis-arts.org, is mapped to org inner_group,
//     which innergathering serves. NPM proxy host 14 still forwards meetings.elkdonis-arts.org to 192.168.0.11:3004, so that
//     name answers 502 today.
//   - the compose services (docker-compose.yml, .prod.yml, .production.yml) still define it, so `docker compose up inner-gathering`
//     would bring all of these routes back. The Nextcloud OIDC routes were ported to innergathering on 2026-09-18.
// One line per key, grouped by file. No SECURITY notes apply to reachable routes (none is reachable); see JOURNAL.md for
// what would matter if it were restarted.

const LEG =
  'legacy twin of innergathering, not deployed (container eac-inner-gathering exited 5 weeks ago, nothing listens on :3004, apps.md: superseded by innergathering)';

const ignored: Area['ignored'] = [
  // ---- apps/inner-gathering/src/app/api/about-document/route.ts (4) ----
  { key: 'api:apps/inner-gathering/src/app/api/about-document/route.ts#DELETE', why: LEG },
  { key: 'api:apps/inner-gathering/src/app/api/about-document/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/about-document/route.ts#DELETE', why: `${LEG}; twin of app/api/about-document/route.ts#DELETE` },
  { key: 'sql:apps/inner-gathering/src/app/api/about-document/route.ts#POST', why: `${LEG}; twin of app/api/about-document/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/account/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/account/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/account/route.ts#PATCH', why: `${LEG}; twin of app/api/account/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/admin/media-gallery/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/admin/media-gallery/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/admin/media-gallery/upload/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/admin/media-gallery/upload/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/admin/site-config/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/admin/site-config/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/admin/site-config/route.ts#PATCH', why: `${LEG}; twin of app/api/admin/site-config/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/auth/logout/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/auth/logout/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/auth/provision-nextcloud/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/auth/provision-nextcloud/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/auth/signup/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/auth/signup/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/contact/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/contact/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/contact/route.ts#POST', why: `${LEG}; twin of app/api/contact/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/content/[id]/route.ts (4) ----
  { key: 'api:apps/inner-gathering/src/app/api/content/[id]/route.ts#DELETE', why: LEG },
  { key: 'api:apps/inner-gathering/src/app/api/content/[id]/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/content/[id]/route.ts#DELETE', why: `${LEG}; twin of app/api/content/[id]/route.ts#DELETE` },
  { key: 'sql:apps/inner-gathering/src/app/api/content/[id]/route.ts#PATCH', why: `${LEG}; twin of app/api/content/[id]/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/content/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/content/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/content/route.ts#POST', why: `${LEG}; twin of app/api/content/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/create-document/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/create-document/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/email-templates/preview/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/email-templates/preview/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/email-templates/settings/[templateKey]/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/email-templates/settings/[templateKey]/route.ts#PATCH', why: LEG },
  // ---- apps/inner-gathering/src/app/api/forum/replies/[id]/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/forum/replies/[id]/route.ts#DELETE', why: LEG },
  // ---- apps/inner-gathering/src/app/api/forum/threads/[slug]/pin/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/forum/threads/[slug]/pin/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/forum/threads/[slug]/replies/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/forum/threads/[slug]/replies/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/forum/threads/[slug]/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/forum/threads/[slug]/route.ts#DELETE', why: LEG },
  // ---- apps/inner-gathering/src/app/api/forum/threads/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/forum/threads/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/guestbook/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/guestbook/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/guestbook/route.ts#POST', why: `${LEG}; twin of app/api/guestbook/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/inquiries/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/inquiries/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/inquiries/route.ts#POST', why: `${LEG}; twin of app/api/inquiries/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/meetings/[id]/attendees/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/meetings/[id]/attendees/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/meetings/[id]/attendees/route.ts#PATCH', why: `${LEG}; twin of app/api/meetings/[id]/attendees/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/meetings/[id]/event-page/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/meetings/[id]/event-page/route.ts#POST', why: LEG },
  { key: 'api:apps/inner-gathering/src/app/api/meetings/[id]/event-page/route.ts#PUT', why: LEG },
  // ---- apps/inner-gathering/src/app/api/meetings/[id]/guides/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/meetings/[id]/guides/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/meetings/[id]/guides/route.ts#PATCH', why: `${LEG}; twin of app/api/meetings/[id]/guides/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/meetings/[id]/replies/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/meetings/[id]/replies/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/meetings/[id]/trigger-email/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/meetings/[id]/trigger-email/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/nextcloud/files/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/nextcloud/files/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/nextcloud/upload/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/nextcloud/upload/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/notifications/mark-read/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/notifications/mark-read/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/notifications/mark-read/route.ts#POST', why: `${LEG}; twin of app/api/notifications/mark-read/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/oidc/token/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/oidc/token/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts (4) ----
  { key: 'api:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts#DELETE', why: LEG },
  { key: 'api:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts#PUT', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts#DELETE', why: `${LEG}; twin of app/api/org/[orgId]/blog-password/route.ts#DELETE` },
  { key: 'sql:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts#PUT', why: `${LEG}; twin of app/api/org/[orgId]/blog-password/route.ts#PUT` },
  // ---- apps/inner-gathering/src/app/api/org/[orgId]/blog-password/verify/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/verify/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/polls/[id]/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/polls/[id]/route.ts#DELETE', why: LEG },
  // ---- apps/inner-gathering/src/app/api/polls/[id]/vote/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/polls/[id]/vote/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/polls/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/polls/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/posts/[id]/replies/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/posts/[id]/replies/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/profile/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/profile/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/profile/route.ts#PATCH', why: `${LEG}; twin of app/api/profile/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/question-polls/[id]/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/question-polls/[id]/route.ts#DELETE', why: LEG },
  // ---- apps/inner-gathering/src/app/api/question-polls/[id]/vote/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/question-polls/[id]/vote/route.ts#DELETE', why: LEG },
  { key: 'api:apps/inner-gathering/src/app/api/question-polls/[id]/vote/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/question-polls/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/question-polls/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/threads/[id]/rsvp/route.ts (3) ----
  { key: 'api:apps/inner-gathering/src/app/api/threads/[id]/rsvp/route.ts#DELETE', why: LEG },
  { key: 'api:apps/inner-gathering/src/app/api/threads/[id]/rsvp/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/threads/[id]/rsvp/route.ts#POST', why: `${LEG}; twin of app/api/threads/[id]/rsvp/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/upload/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/upload/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/upload/route.ts#POST', why: `${LEG}; twin of app/api/upload/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/webhooks/nextcloud/calendar/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/webhooks/nextcloud/calendar/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/webhooks/nextcloud/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/webhooks/nextcloud/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/work-question/respond/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/work-question/respond/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/work-question/respond/route.ts#POST', why: `${LEG}; twin of app/api/work-question/respond/route.ts#POST` },
  // ---- apps/inner-gathering/src/app/api/workshops/[id]/materials/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/workshops/[id]/materials/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/workshops/[id]/replies/route.ts (1) ----
  { key: 'api:apps/inner-gathering/src/app/api/workshops/[id]/replies/route.ts#POST', why: LEG },
  // ---- apps/inner-gathering/src/app/api/workshops/[id]/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/workshops/[id]/route.ts#PATCH', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/workshops/[id]/route.ts#PATCH', why: `${LEG}; twin of app/api/workshops/[id]/route.ts#PATCH` },
  // ---- apps/inner-gathering/src/app/api/workshops/route.ts (2) ----
  { key: 'api:apps/inner-gathering/src/app/api/workshops/route.ts#POST', why: LEG },
  { key: 'sql:apps/inner-gathering/src/app/api/workshops/route.ts#POST', why: `${LEG}; twin of app/api/workshops/route.ts#POST` },
  // ---- apps/inner-gathering/src/lib/actions.ts (3) ----
  { key: 'sa:apps/inner-gathering/src/lib/actions.ts#createMeetingAction', why: LEG },
  { key: 'sa:apps/inner-gathering/src/lib/actions.ts#createPostAction', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/actions.ts#createMeetingAction', why: `${LEG}; twin of lib/actions.ts#createMeetingAction` },
  // ---- apps/inner-gathering/src/lib/draft-actions.ts (6) ----
  { key: 'sa:apps/inner-gathering/src/lib/draft-actions.ts#deleteDraftAction', why: LEG },
  { key: 'sa:apps/inner-gathering/src/lib/draft-actions.ts#loadDraftAction', why: LEG },
  { key: 'sa:apps/inner-gathering/src/lib/draft-actions.ts#loadDraftsAction', why: LEG },
  { key: 'sa:apps/inner-gathering/src/lib/draft-actions.ts#saveDraftAction', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/draft-actions.ts#deleteDraftAction', why: `${LEG}; twin of lib/draft-actions.ts#deleteDraftAction` },
  { key: 'sql:apps/inner-gathering/src/lib/draft-actions.ts#saveDraftAction', why: `${LEG}; twin of lib/draft-actions.ts#saveDraftAction` },
  // ---- apps/inner-gathering/src/app/api/oidc/authorize/route.ts (1) ----
  { key: 'sql:apps/inner-gathering/src/app/api/oidc/authorize/route.ts#GET', why: LEG },
  // ---- apps/inner-gathering/src/lib/data.ts (4) ----
  { key: 'sql:apps/inner-gathering/src/lib/data.ts#createEventPage', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/data.ts#createMeeting', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/data.ts#createPost', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/data.ts#updateEventPage', why: LEG },
  // ---- apps/inner-gathering/src/lib/email-template-settings.ts (2) ----
  { key: 'sql:apps/inner-gathering/src/lib/email-template-settings.ts#deleteEmailTemplateSettings', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/email-template-settings.ts#saveEmailTemplateSettings', why: LEG },
  // ---- apps/inner-gathering/src/lib/forum.ts (6) ----
  { key: 'sql:apps/inner-gathering/src/lib/forum.ts#createForumThread', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/forum.ts#deleteForumReply', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/forum.ts#deleteForumThread', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/forum.ts#ensureForumTopicId', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/forum.ts#getOrCreateGuestUserId', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/forum.ts#setThreadPinned', why: LEG },
  // ---- apps/inner-gathering/src/lib/oidc.ts (2) ----
  { key: 'sql:apps/inner-gathering/src/lib/oidc.ts#createAuthCode', why: LEG },
  { key: 'sql:apps/inner-gathering/src/lib/oidc.ts#validateAuthCode', why: LEG },
  // ---- apps/inner-gathering/src/lib/reminders.ts (1) ----
  { key: 'sql:apps/inner-gathering/src/lib/reminders.ts#runReminderTick', why: LEG },
];

const area: Area = { capabilities: [], ignored };
export default area;
