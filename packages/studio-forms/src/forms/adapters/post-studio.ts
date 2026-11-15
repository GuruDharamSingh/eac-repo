// ============================================================================
// Post → the Studio's writing actions (pass 1, the bone's): binding one of two.
//
// This binding saves network writing pieces (StudioActions: startPiece,
// savePiece, setListing), homed on the acting org. The other binding is a
// site's own `kind='post'` threads in a chosen feed (hidden-enneagram
// src/lib/studio/writing-actions.ts); a host binds that as its own
// FormActions for 'post' in FormHost.actions, and "Goes on" supplies the feed.
//
// Answer keys (the post kind reads and writes these):
//   title, excerpt (→ lede), body (HTML), body_doc (the essay Canvas document,
//   wins over body), cover_image_url, layout, also_on (org ids beyond home).
// What this binding cannot store (no visibility, no feed on a network piece)
// comes back as a warning, never silently.
// ============================================================================

import type { EssayDoc } from '@elkdonis/utils/essay';
import type { StudioActions, StudioLayout, StudioPatch, StudioPiece } from '../../types';
import type { Answers, FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';

const LAYOUTS: StudioLayout[] = ['essay', 'feature', 'note', 'announcement', 'document'];

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function orNull(v: unknown): string | null {
  const t = s(v).trim();
  return t ? t : null;
}

export function postPatch(a: Answers, status: 'draft' | 'published'): StudioPatch {
  const layout = LAYOUTS.includes(a.layout as StudioLayout) ? (a.layout as StudioLayout) : null;
  const doc = a.body_doc && typeof a.body_doc === 'object' ? (a.body_doc as EssayDoc) : undefined;
  return {
    title: s(a.title).trim() || 'Untitled',
    lede: orNull(a.excerpt),
    ...(doc ? { bodyDoc: doc } : { bodyHtml: s(a.body) }),
    coverImageUrl: orNull(a.cover_image_url),
    layout,
    status,
  };
}

export function postAnswers(p: StudioPiece, alsoOn: string[]): Answers {
  return {
    kind: 'post',
    title: p.title,
    excerpt: p.lede ?? '',
    body: p.bodyHtml,
    body_doc: p.bodyDoc ?? undefined,
    cover_image_url: p.coverImageUrl ?? '',
    layout: p.layout ?? '',
    also_on: alsoOn,
  };
}

export interface StudioPostOptions {
  /** The orgs the person may list a piece under (the Studio frame's orgs). */
  orgs: Array<{ orgId: string; name: string }>;
  /** "Your profile · <name>" in Also show on. */
  viewerName: string;
}

export function studioPostActions(actions: StudioActions, opts: StudioPostOptions): FormActions<StudioPiece> {
  return {
    async context(orgId) {
      // Network pieces have no feeds; "Goes on" is the acting org, "Also show on" the listing.
      // canSetVisibility false: a network piece is always public, so the kind does not draw Public | Members.
      return { feeds: [], listingOrgs: opts.orgs, homeOrgId: orgId, viewerName: opts.viewerName, canSetVisibility: false };
    },
    async load(id) {
      const r = await actions.loadPiece(id);
      if (!r) return null;
      const alsoOn = r.listing.selected.filter((o) => o !== r.listing.homeOrgId);
      return { answers: postAnswers(r.post, alsoOn), record: r.post };
    },
    async save(orgId, answers, intent, id, saveOpts) {
      let pieceId = id;
      if (!pieceId) {
        const started = await actions.startPiece(orgId, s(answers.title).trim() || 'Untitled');
        if (started.ok === false) return started;
        pieceId = started.value.id;
      }
      // An autosave never changes the piece's status (no status in the patch), so it can never take a piece down.
      const patch = postPatch(answers, intent);
      if (saveOpts?.autosave) delete patch.status;
      const saved = await actions.savePiece(pieceId, patch);
      if (saved.ok === false) return saved;
      const warnings: string[] = [];
      if (Array.isArray(answers.also_on)) {
        const listed = await actions.setListing(pieceId, [orgId, ...(answers.also_on as string[]).filter((o) => o !== orgId)]);
        if (listed.ok === false) warnings.push(`Saved, but "Also show on" was not: ${listed.error}`);
      }
      if (answers.visibility && answers.visibility !== 'PUBLIC') warnings.push('Members-only is not available for network pieces yet; this one is public.');
      return { ok: true, value: { record: saved.value, warnings } };
    },
    async lastSettings(orgId): Promise<FormPreset | null> {
      const list = await actions.listPieces(orgId);
      const latest = [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      if (!latest) return null;
      const r = await actions.loadPiece(latest.id);
      if (!r) return null;
      return presetFromAnswers('post', postAnswers(r.post, []), 'Your last post’s settings');
    },
  };
}
