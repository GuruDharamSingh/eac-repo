# Workshops today — what an LMS can reuse (code survey, 2026-09-18)

Read-only survey of the repo. Facts first; assessment is separate at the end.

## Data model
- A workshop is a `threads` row, `kind='workshop'` (no CHECK on kind). Generic thread columns carry most of it: price/currency (037), format (038), `is_rsvp_enabled / attendee_limit / rsvp_deadline / min_attendees`, `reminder_minutes_before` (069), `nextcloud_talk_token`, `recurrence_pattern`.
- Live sidecars: `workshop_pages` (038 + 068/070/071; 30+ presentation/marketing columns, `optional_sections` JSONB keyed by template manifest), `workshop_sessions` (031:108; `notes` JSONB smuggles description/location/video/resources), `workshop_join_requests` (051, +`order_id` 097; status has never left `pending` anywhere), `thread_reminder_sends` (069).
- 115 folded `workshop_details` into `workshop_pages` + `threads`; 116 fixed one price. `threads.sessions` JSONB and `threads.is_online` are superseded, not dropped.
- Enrolment is kind-agnostic: `thread_rsvps` + `checkRsvpEligibility` (`thread-rsvp.ts:29`). `isEnrolledInWorkshop` (`workshop-offerings.ts:784`) = RSVP yes ∪ paid join.
- Materials: `EAC_Network/<org>/workshops/<threadId>/materials`, gated by `media-authz.ts` `{kind:'workshop'}` (44-89, 248). Calendar: `SCHEDULED_KINDS` (`org-calendar.ts:71`). Rota (136) keyed by (thread, occurrence).

## Authoring — six write paths, one canonical
Canonical: `upsertWorkshopOffering` / `replaceWorkshopSessions` (`packages/services/src/workshop-offerings.ts`).
1. arts-collective `WorkshopForm.tsx` (878 lines) → `saveWorkshopAction` → canonical
2. `GuidedWorkshopWizard` → `TemplateWizard` (the cms-ui section-keyed wizard **is** consumed: `hub/workshops/[orgSlug]/guided/page.tsx:70`) → canonical
3. Live-editor field actions (`lib/cms/actions.ts:284,331,431,473`) — raw SQL at `workshop_pages`
4. innergathering `lib/cms/workshop-actions.ts` → canonical
5. inner-gathering `/api/workshops` — hand-rolled SQL (app being retired)
6. inner-gathering `/api/content` tier path — own field names (app being retired)
Drift guard exists: `scripts/check-workshop-fields.mjs`.

## Learner surfaces
- arts-collective: promo template at `/sites/[slug]/[contentSlug]`; enrolment-gated **workspace** at `/sites/[slug]/workshop/[workshopSlug]` (44-58).
- innergathering `workshop-view.tsx` + `workshop-materials.tsx`; `OfferingPage.tsx` reuses the workshop template.
- `RsvpPanel` copy-pasted ×4 (only `useThreadRsvp` is shared).

## Adjacent pieces
Questionnaires (088/103: `fields` JSONB, wizard presentation, review states, optional `thread_id`); reading groups (043: programs/units/resources — closest thing to a syllabus already shipped) + `packages/reading-wizard`; `org_feeds.min_role/post_role`; cms-ui surface system + shared editor; `thread_gathers` (ordered holds), `thread_lines`; `packages/commerce` `createThreadOrder` + settlement; `packages/email` reminder/rsvp/invoice templates.

## Dead / painful
Admin workshop CRUD against the dropped `meetings` table; `workshop_sessions.notes` blob (past double-encoding bug); three raw-SQL write paths; 4× RsvpPanel, 3× content-form.

---

## Assessment (opinion)
- **A cohort run can *be* a workshop thread** with a pointer to the course: scheduling, capacity, deadline, reminders, Talk room, calendar, gated materials and paid/free join all come for one column.
- **A course step should point at** a lesson (or a thread) + optionally a questionnaire — not at a `workshop_sessions` row. Promote sessions to first-class steps so they can be discussed and defined.
- **A multi-session workshop with per-session materials is a one-module course.** `workshop_pages` is really the *marketing page* — keep it as the public face of a course/run. A single-session workshop should stay a plain workshop.
- The LMS is the moment to make the canonical service the only writer and collapse RsvpPanel/content-form into cms-ui.
