// ============================================================================
// Workshop → services' upsertWorkshopOffering (2026-11-14).
//
// The answers ARE cms-ui content-fields' `workshop` keys (title, subtitle,
// excerpt, body, format, price, currency, scheduled_at as a wall clock in
// time_zone, duration_minutes, location, discipline, level, attendee_limit,
// rsvp_deadline, min_attendees, cover_image_url, banner_image_url,
// banner_focal_y, hero_media_url, hero_text, background_color, visibility,
// feed_slug). As with the offering (adapters/service.ts), they are converted
// on the SERVER into WorkshopOfferingInput by one shared translation; today
// that translation is apps/innergathering/src/lib/cms/workshop-adapter.ts
// toWorkshopInput, to move into services beside serviceInputFromAnswers.
// This adapter only drops forms.* keys, with a warning.
// ============================================================================

import type { StudioResult } from '../../types';
import type { Answers, FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';

export interface WorkshopContextView {
  canEdit: boolean;
  reason?: string | null;
  feeds: Array<{ slug: string; name: string }>;
  currencies?: string[];
  [key: string]: unknown;
}

export interface WorkshopRecordView {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  /** The workshop's page on this site; null when it has none yet. */
  href: string | null;
}

export interface WorkshopActions {
  context(orgId: string): Promise<WorkshopContextView>;
  /** The record and its compose answers (the offering read back into content-fields keys). */
  loadWorkshop(id: string): Promise<{ record: WorkshopRecordView; answers: Answers } | null>;
  saveWorkshop(
    orgId: string,
    answers: Answers,
    intent: 'draft' | 'published',
    id: string | null,
    opts?: { autosave?: boolean }
  ): Promise<StudioResult<{ record: WorkshopRecordView; warnings?: string[] }>>;
  listWorkshops?(orgId: string): Promise<Array<{ id: string; updatedAt: string }>>;
}

/** forms.* keys are the form's own; they never reach the server. */
export function workshopAnswersForSave(a: Answers): { answers: Answers; dropped: string[] } {
  const out: Answers = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === 'forms' || k.startsWith('forms.')) {
      if (v !== undefined) dropped.push(k);
      continue;
    }
    out[k] = v;
  }
  return { answers: out, dropped };
}

export function workshopActions(actions: WorkshopActions): FormActions<WorkshopRecordView> {
  return {
    context: (orgId) => actions.context(orgId),
    load: (id) => actions.loadWorkshop(id),
    async save(orgId, answers, intent, id, opts) {
      const { answers: out, dropped } = workshopAnswersForSave(answers);
      const res = await actions.saveWorkshop(orgId, out, intent, id, { autosave: opts?.autosave === true });
      if (res.ok === false) return res;
      const warnings = [...(res.value.warnings ?? [])];
      if (dropped.length) warnings.push('Some choices are kept in this form but not saved yet: ' + dropped.join(', ') + '.');
      return { ok: true, value: { record: res.value.record, warnings } };
    },
    async lastSettings(orgId): Promise<FormPreset | null> {
      if (!actions.listWorkshops) return null;
      const latest = (await actions.listWorkshops(orgId)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      if (!latest) return null;
      const loaded = await actions.loadWorkshop(latest.id);
      if (!loaded) return null;
      const a = loaded.answers;
      return presetFromAnswers(
        'workshop',
        { format: a.format, duration_minutes: a.duration_minutes, location: a.location, price: a.price, currency: a.currency, attendee_limit: a.attendee_limit, feed_slug: a.feed_slug, visibility: a.visibility },
        'Your last workshop’s settings'
      );
    },
  };
}
