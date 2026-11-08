// ============================================================================
// Service ("Offering") → services' serviceInputFromAnswers + upsertServiceOffering
// (pass 2, Ligament). PLAN §12. Reference: hidden-enneagram
// components/publish/service-kind.tsx and its saveContentAction.
//
// The answers ARE cms-ui content-fields' `service` keys, unchanged (booking_type,
// format, location, session_duration_hrs, session_count, price, currency,
// sliding_scale, price_sliding_min, sliding_scale_note, registration_status,
// subtitle, excerpt, body, cover_image_url, visibility, feed_slug), and they are
// converted on the SERVER by serviceInputFromAnswers, the one translation every
// host shares. This adapter only drops forms.* keys (with a warning) and checks
// the currency against the four checkout supports.
//
// Payee rule: the host's action saves the signed-in person as the author on
// create (resolveSettlement pays a service's thread author; hidden-enneagram
// migration 253), never the org's service account. An update keeps the author.
// ============================================================================

import type { StudioResult } from '../../types';
import type { Answers, FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';

export const SERVICE_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const;

export interface ServiceContextView {
  /** Owner or guide of the org (not the personal org). */
  canEdit: boolean;
  reason: string | null;
  feeds: Array<{ slug: string; name: string }>;
  currencies: string[];
}

export interface ServiceRecordView {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  authorId: string | null;
  publishedAt: string | null;
  updatedAt: string;
  /** The public page, when the host knows it. */
  href?: string | null;
}

export interface ServiceActions {
  context(orgId: string): Promise<ServiceContextView>;
  /** The record and its compose answers (serviceAnswersFromOffering plus the shared thread fields). */
  loadService(id: string): Promise<{ record: ServiceRecordView; answers: Answers } | null>;
  saveService(
    orgId: string,
    answers: Answers,
    intent: 'draft' | 'published',
    id: string | null,
    opts?: { autosave?: boolean }
  ): Promise<StudioResult<{ record: ServiceRecordView; warnings: string[] }>>;
  /** The org's offerings, for "your last offering's settings". */
  listServices?(orgId: string): Promise<Array<{ id: string; updatedAt: string }>>;
}

/** The answers the server converts: forms.* keys out (reported), the currency checked. */
export function serviceAnswersForSave(a: Answers): { ok: true; answers: Answers; warnings: string[] } | { ok: false; error: string } {
  const out: Answers = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === 'forms' || k.startsWith('forms.')) {
      if (v !== undefined) dropped.push(k);
      continue;
    }
    out[k] = v;
  }
  const currency = typeof a.currency === 'string' ? a.currency.trim().toUpperCase() : '';
  if (currency && !(SERVICE_CURRENCIES as readonly string[]).includes(currency)) {
    return { ok: false, error: 'Pick the price in CAD, USD, EUR or GBP.' };
  }
  const warnings = dropped.length ? ['Some choices are kept in this form but not saved yet: ' + dropped.join(', ') + '.'] : [];
  return { ok: true, answers: out, warnings };
}

export function serviceActions(actions: ServiceActions): FormActions<ServiceRecordView> {
  return {
    async context(orgId) {
      const c = await actions.context(orgId);
      return { ...c };
    },
    async load(id) {
      return actions.loadService(id);
    },
    async save(orgId, answers, intent, id, saveOpts) {
      const built = serviceAnswersForSave(answers);
      if (built.ok === false) return { ok: false, error: built.error };
      const res = await actions.saveService(orgId, built.answers, intent, id, { autosave: saveOpts?.autosave === true });
      if (res.ok === false) return res;
      return { ok: true, value: { record: res.value.record, warnings: [...built.warnings, ...res.value.warnings] } };
    },
    async lastSettings(orgId): Promise<FormPreset | null> {
      if (!actions.listServices) return null;
      const list = await actions.listServices(orgId);
      const latest = [...list].sort((x, y) => Date.parse(y.updatedAt) - Date.parse(x.updatedAt))[0];
      if (!latest) return null;
      const r = await actions.loadService(latest.id);
      if (!r) return null;
      return presetFromAnswers('service', r.answers, 'Your last offering’s settings');
    },
  };
}
