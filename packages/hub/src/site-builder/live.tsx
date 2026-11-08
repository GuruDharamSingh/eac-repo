'use client';

// The Site Builder's optimistic write state, shared by the pop-up and the detail page.
// Every write: apply locally, toast, `await host.act(...)`, `host.refresh?.()` on success,
// revert + toast the error string on `{ ok: false }`. Gates are never decided here; callers
// only offer what `data.can` allows.

import * as React from 'react';
import { Frame, Icon, useToast } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { SiteBuilderFaceData, SitePage } from './model';

interface Draft {
  slots: Record<string, string>;
  title?: string;
  notes?: string;
  linkPreview?: string;
}

interface Patch {
  slots?: Record<string, string>;
  title?: string;
  notes?: string;
  linkPreview?: string;
  updatedAt?: string;
  updatedBy?: string;
  exceptionGone?: boolean;
}

export interface PageMeta {
  title: string;
  notes: string;
  linkPreview: string;
}

export interface SiteLive {
  /** The loaded pages with local changes laid over. */
  pages: SitePage[];
  /** A slot's current value (draft, else saved). */
  values(page: SitePage): Record<string, string>;
  setSlot(page: SitePage, key: string, value: string): void;
  meta(page: SitePage): PageMeta;
  setMeta(page: SitePage, patch: Partial<PageMeta>): void;
  dirty(page: SitePage): boolean;
  saving: string | null;
  save(page: SitePage): Promise<void>;
  removeException(page: SitePage): Promise<void>;
  saveTemplate(page: SitePage, name: string): Promise<boolean>;
  /** Run an entry without touching local state. Resolves to an error string, or null on success. */
  call(actionId: string, input: Record<string, unknown>): Promise<string | null>;
  say(text: string): void;
  fail(text: string): void;
  /** Toasts (success and error). Render once, anywhere inside the card root. */
  toast: React.ReactNode;
}

const GENERIC = 'That didn’t go through. Try again.';

export function useSiteLive(data: SiteBuilderFaceData, host: SiteBuilderHost): SiteLive {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [patches, setPatches] = React.useState<Record<string, Patch>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const ok = useToast(3200);
  const [error, setError] = React.useState<{ text: string; id: number } | null>(null);

  // Fresh server data (after host.refresh) replaces everything optimistic.
  React.useEffect(() => {
    setDrafts({});
    setPatches({});
  }, [data]);

  React.useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  const pages = React.useMemo(
    () =>
      data.pages.map((p) => {
        const patch = patches[p.id];
        if (!patch) return p;
        return {
          ...p,
          title: patch.title ?? p.title,
          notes: p.notes === null ? null : (patch.notes ?? p.notes),
          linkPreview: patch.linkPreview ?? p.linkPreview,
          updatedAt: patch.updatedAt ?? p.updatedAt,
          updatedBy: patch.updatedBy ?? p.updatedBy,
          exception: patch.exceptionGone ? null : p.exception,
          copySlots: patch.slots ? p.copySlots.map((s) => (s.key in patch.slots! ? { ...s, value: patch.slots![s.key] } : s)) : p.copySlots,
        };
      }),
    [data.pages, patches],
  );

  const fail = React.useCallback((text: string) => setError({ text, id: Date.now() }), []);

  const call = React.useCallback(
    async (actionId: string, input: Record<string, unknown>): Promise<string | null> => {
      try {
        const res = await host.act(actionId, input);
        if (res.ok) {
          host.refresh?.();
          return null;
        }
        return 'error' in res && typeof res.error === 'string' && res.error ? res.error : GENERIC;
      } catch (e) {
        return e instanceof Error && e.message ? e.message : GENERIC;
      }
    },
    [host],
  );

  const values = (page: SitePage): Record<string, string> => {
    const d = drafts[page.id]?.slots ?? {};
    const out: Record<string, string> = {};
    for (const s of page.copySlots) out[s.key] = s.key in d ? d[s.key] : s.value;
    return out;
  };

  const meta = (page: SitePage): PageMeta => {
    const d = drafts[page.id];
    return {
      title: d?.title ?? page.title,
      notes: d?.notes ?? page.notes ?? '',
      linkPreview: d?.linkPreview ?? page.linkPreview ?? '',
    };
  };

  const dirty = (page: SitePage): boolean => {
    const d = drafts[page.id];
    if (!d) return false;
    if (page.copySlots.some((s) => s.key in d.slots && d.slots[s.key] !== s.value)) return true;
    if (d.title !== undefined && d.title !== page.title) return true;
    if (data.can.notes && d.notes !== undefined && d.notes !== (page.notes ?? '')) return true;
    if (d.linkPreview !== undefined && d.linkPreview !== (page.linkPreview ?? '')) return true;
    return false;
  };

  const setDraft = (id: string, f: (d: Draft) => Draft) =>
    setDrafts((all) => ({ ...all, [id]: f(all[id] ?? { slots: {} }) }));

  async function save(page: SitePage) {
    const d = drafts[page.id];
    if (!d || saving) return;
    const slotValues = values(page);
    const slotsChanged = page.copySlots.some((s) => slotValues[s.key] !== s.value);
    const m = meta(page);
    const metaInput: Record<string, unknown> = { pageId: page.id };
    let metaChanged = false;
    if (m.title !== page.title) { metaInput.title = m.title; metaChanged = true; }
    if (data.can.notes && m.notes !== (page.notes ?? '')) { metaInput.notes = m.notes; metaChanged = true; }
    if (m.linkPreview !== (page.linkPreview ?? '')) { metaInput.linkPreview = m.linkPreview; metaChanged = true; }
    if (!slotsChanged && !metaChanged) return;

    const prevPatch = patches[page.id];
    const prevDraft = d;
    setSaving(page.id);
    setPatches((all) => ({
      ...all,
      [page.id]: {
        ...all[page.id],
        slots: slotsChanged ? { ...all[page.id]?.slots, ...slotValues } : all[page.id]?.slots,
        title: m.title,
        notes: data.can.notes ? m.notes : all[page.id]?.notes,
        linkPreview: m.linkPreview,
        updatedAt: new Date().toISOString(),
        updatedBy: 'You',
      },
    }));
    setDrafts((all) => {
      const n = { ...all };
      delete n[page.id];
      return n;
    });
    ok.show(`${m.title || page.title} saved. It’s live on the site.`);

    let err: string | null = null;
    if (slotsChanged) err = await call('site-section-save', { pageId: page.id, values: slotValues });
    if (!err && metaChanged) err = await call('site-page-meta-save', metaInput);
    setSaving(null);
    if (err) {
      setPatches((all) => {
        const n = { ...all };
        if (prevPatch) n[page.id] = prevPatch;
        else delete n[page.id];
        return n;
      });
      setDrafts((all) => ({ ...all, [page.id]: prevDraft }));
      fail(err);
    }
  }

  async function removeException(page: SitePage) {
    setPatches((all) => ({ ...all, [page.id]: { ...all[page.id], exceptionGone: true } }));
    ok.show(`${page.title} follows the site theme again`);
    const err = await call('site-theme-exception-remove', { pageId: page.id });
    if (err) {
      setPatches((all) => ({ ...all, [page.id]: { ...all[page.id], exceptionGone: false } }));
      fail(err);
    }
  }

  async function saveTemplate(page: SitePage, name: string): Promise<boolean> {
    const err = await call('site-template-save', { fromPath: page.path, name });
    if (err) {
      fail(err);
      return false;
    }
    ok.show(`Saved “${name}” as a template`);
    return true;
  }

  const live: SiteLive = {
    pages,
    values,
    setSlot: (page, key, value) => setDraft(page.id, (d) => ({ ...d, slots: { ...d.slots, [key]: value } })),
    meta,
    setMeta: (page, patch) => setDraft(page.id, (d) => ({ ...d, ...patch })),
    dirty,
    saving,
    save,
    removeException,
    saveTemplate,
    call,
    say: (t) => ok.show(t),
    fail,
    toast: (
      <>
        {ok.node}
        {error ? (
          <Frame elev="md" className="hc-toast" role="alert" key={error.id} style={{ top: 112 }}>
            <span className="hc-icon-accent">
              <Icon name="error" size={16} />
            </span>
            {error.text}
          </Frame>
        ) : null}
      </>
    ),
  };
  return live;
}
