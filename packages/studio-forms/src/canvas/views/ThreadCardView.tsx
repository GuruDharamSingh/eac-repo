'use client';

import * as React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools, WidthToggle } from './BlockChrome';
import type { ThreadCardOptions, ThreadCardSearchHit } from '../schema/blocks';

const KIND_LABEL: Record<string, string> = {
  writing: 'Piece',
  meeting: 'Meeting',
  event: 'Event',
  workshop: 'Workshop',
  artwork: 'Artwork',
  post: 'Post',
};
const KIND_NOUN: Record<string, string> = {
  writing: 'writing',
  meeting: 'meetings',
  event: 'events',
  workshop: 'workshops',
  artwork: 'artworks',
  post: 'posts',
};

/**
 * A card for one of the writer's own things. Inserted without a thread it
 * is a picker: search by title within the kind, pick, and the snapshot
 * fills in. The site swaps the snapshot for its live card when it has a
 * resolver (brief §3.6); until then the snapshot is what readers see.
 */
export function ThreadCardView({ node, updateAttributes, deleteNode, selected, extension }: NodeViewProps) {
  const a = node.attrs as { threadId: string | null; kind: string; title: string; meta: string | null; coverImageUrl: string | null; price: string | null; forSale: boolean; view: 'card' | 'compact'; width: 'content' | 'wide' };
  const search = (extension.options as ThreadCardOptions).search;
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState<ThreadCardSearchHit[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (a.threadId) return;
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      void search(a.kind, q).then((r) => {
        if (cancelled) return;
        setHits(r);
        setBusy(false);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [a.kind, a.threadId, q, search]);

  const label = KIND_LABEL[a.kind] ?? 'Thread';

  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__card is-${a.width === 'wide' ? 'wide' : 'content'} ${selected ? 'is-selected' : ''}`} data-drag-handle>
      {a.threadId && <WidthToggle value={a.width === 'wide' ? 'wide' : 'content'} allow={['content', 'wide']} onChange={(w) => updateAttributes({ width: w })} />}
      <BlockTools onRemove={deleteNode}>
        {a.threadId && (
          <>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ view: a.view === 'compact' ? 'card' : 'compact' })}>
              {a.view === 'compact' ? 'Full card' : 'Compact'}
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ threadId: null, title: '', meta: null, coverImageUrl: null, price: null, forSale: false })}>
              Change
            </button>
          </>
        )}
      </BlockTools>
      {a.threadId ? (
        <figure className={`eac-card eac-card--${a.kind} ${a.view === 'compact' ? 'eac-card--compact' : ''}`} contentEditable={false}>
          {a.coverImageUrl && <img className="eac-card__cover" src={a.coverImageUrl} alt="" />}
          <figcaption>
            <span className="eac-card__kind">{label}</span>
            <strong className="eac-card__title">{a.title}</strong>
            {a.meta && <span className="eac-card__meta">{a.meta}</span>}
            {a.kind === 'artwork' && (a.forSale && a.price ? <span className="eac-card__price">{a.price}</span> : <span className="eac-card__price eac-card__price--nfs">Not for sale</span>)}
            <span className="studio-cv__live">live · from the {KIND_NOUN[a.kind] ?? 'thread'} once the site resolves it</span>
          </figcaption>
        </figure>
      ) : (
        <div className="studio-cv__picker" contentEditable={false}>
          <div className="studio-cv__picker-h">
            <span>Which {a.kind === 'writing' ? 'piece' : label.toLowerCase()}?</span>
            <select value={a.kind} onChange={(e) => updateAttributes({ kind: e.target.value })} aria-label="Kind">
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <input autoFocus value={q} placeholder={`Search your ${KIND_NOUN[a.kind] ?? 'things'}…`} onChange={(e) => setQ(e.target.value)} />
          <div className="studio-cv__hits">
            {busy && hits.length === 0 && <p className="studio-hint">Looking…</p>}
            {!busy && hits.length === 0 && <p className="studio-hint">Nothing of yours matches.</p>}
            {hits.map((h) => (
              <button
                key={h.threadId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateAttributes({ ...h, view: 'card' })}
              >
                <b>{h.title}</b>
                {h.meta && <span>{h.meta}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
