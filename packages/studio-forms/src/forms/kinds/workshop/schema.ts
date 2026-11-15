// ============================================================================
// Workshop (2026-11-14): one shared form for a site's workshops, saved by
// services' upsertWorkshopOffering (adapters/workshop.ts). Fields are cms-ui
// content-fields' `workshop` list, drawn by the shell. Host-neutral: nothing here
// assumes the Studio, a popup or a page. Sessions (workshop_sessions) and the
// materials folder stay with the site's workshop pages for now.
// ============================================================================

import { emptyContentAnswers, knownTimeZone, type ContentFieldContext } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema } from '../../contract';
import { WORKSHOP_RULES } from '../../rules/workshop';

export function emptyWorkshopAnswers(ctx: FormContext): Answers {
  return emptyContentAnswers('workshop', { ...(ctx.fields as ContentFieldContext), defaultTimeZone: knownTimeZone(ctx.timeZone) ?? undefined });
}

export const workshopKind: FormKindSchema = {
  id: 'workshop',
  label: () => 'New workshop',
  codeKind: () => 'workshop',
  specKind: () => 'workshop',
  sections: [
    // ── Essentials ──
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    { id: 'why', label: 'Why', tier: 'essentials', fields: ['excerpt'], quick: true },
    { id: 'when', label: 'When', tier: 'essentials', fields: ['scheduled_at', 'duration_minutes'], quick: true },
    { id: 'where', label: 'Where', tier: 'essentials', fields: ['format', 'location'], quick: true },
    { id: 'price', label: 'Price', tier: 'essentials', fields: ['price', 'currency'] },
    { id: 'description', label: 'What', tier: 'essentials', fields: ['body'], quick: true },
    // ── More ──
    { id: 'rsvp', label: 'Places', tier: 'more', fields: ['attendee_limit', 'rsvp_deadline', 'min_attendees'] },
    { id: 'presentation', label: 'Presentation', tier: 'more', fields: ['subtitle', 'discipline', 'level'] },
    { id: 'cover', label: 'Cover picture', tier: 'more', fields: ['cover_image_url'] },
    { id: 'publishing', label: 'Goes on', tier: 'more', fields: ['feed_slug', 'visibility'] },
  ],
  rules: WORKSHOP_RULES,
  defaultOpen: () => [],
  empty: emptyWorkshopAnswers,
};
