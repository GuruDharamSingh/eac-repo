'use client';

import * as React from 'react';
import { StudioFold } from '../frame';

// ============================================================================
// A form kind's own items under the Studio column's "All pieces" (canvas R1,
// 2026-11-11): Drafts, then everything else that is not archived, newest
// first, in the same rows as the writing list (StudioShell PieceRow classes).
// The host lists them (formExtension `items`); a click opens one in the form.
// ============================================================================

export interface FormListItem {
  id: string;
  title: string;
  /** draft | published | scheduled | … ; `archived` rows are left out. */
  status: string;
  updatedAt: string;
  /** A date that matters more than the update time (a meeting's start), ISO. */
  when?: string | null;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
}

function Row({ it, current, onOpen }: { it: FormListItem; current: boolean; onOpen: () => void }) {
  const tone = it.status === 'draft' ? 'draft' : it.status === 'published' ? 'published' : '';
  return (
    <button type="button" className="studio-row" aria-current={current} onClick={onOpen}>
      <span className="studio-row__t">{it.title || 'Untitled'}</span>
      <span className="studio-row__m">
        <span className={tone ? `studio-pill studio-pill--${tone}` : 'studio-pill'}>{it.status}</span>
        <span>{fmt(it.when ?? it.updatedAt)}</span>
      </span>
    </button>
  );
}

export function FormItemList({
  noun,
  items,
  currentId,
  loading,
  onOpen,
  onNew,
  query,
}: {
  /** "Meetings", "Artwork", "Offerings". */
  noun: string;
  items: FormListItem[] | null;
  currentId: string | null;
  loading?: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** The Studio bar's search: titles that contain it. */
  query?: string;
}) {
  const needle = (query ?? '').trim().toLowerCase();
  const live = (items ?? []).filter((i) => i.status !== 'archived' && (!needle || (i.title || '').toLowerCase().includes(needle)));
  const byNewest = (a: FormListItem, b: FormListItem) => b.updatedAt.localeCompare(a.updatedAt);
  const drafts = live.filter((i) => i.status === 'draft').sort(byNewest);
  const rest = live.filter((i) => i.status !== 'draft').sort(byNewest);
  return (
    <div className="studio-formlist">
      <div className="studio-panel__h">
        <span>{noun}</span>
        <button type="button" className="studio-btn studio-btn--ghost" style={{ padding: '2px 6px' }} onClick={onNew}>
          New
        </button>
      </div>
      {items === null || loading ? (
        <p className="studio-hint">Loading…</p>
      ) : (
        <>
          <StudioFold label="Drafts" count={drafts.length}>
            <div className="studio-list">
              {drafts.length === 0 && <p className="studio-hint">Nothing in progress.</p>}
              {drafts.map((it) => (
                <Row key={it.id} it={it} current={it.id === currentId} onOpen={() => onOpen(it.id)} />
              ))}
            </div>
          </StudioFold>
          <StudioFold label="Published" count={rest.length}>
            <div className="studio-list">
              {rest.length === 0 && <p className="studio-hint">Nothing published yet.</p>}
              {rest.map((it) => (
                <Row key={it.id} it={it} current={it.id === currentId} onOpen={() => onOpen(it.id)} />
              ))}
            </div>
          </StudioFold>
        </>
      )}
    </div>
  );
}
