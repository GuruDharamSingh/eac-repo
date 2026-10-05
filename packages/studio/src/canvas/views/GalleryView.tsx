'use client';

import * as React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools, WidthToggle } from './BlockChrome';
import { useUpload } from './upload';
import type { GalleryItem } from '../schema/layout';

/** Two to six pictures in rows that share a height. Order with the arrows; each picture has its own caption and alt. */
export function GalleryView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const items = (node.attrs.items ?? []) as GalleryItem[];
  const width = node.attrs.width === 'full' ? 'full' : 'wide';
  const set = (next: GalleryItem[]) => updateAttributes({ items: next });
  const { pick, uploading } = useUpload((src) => set([...items, { src, alt: '', caption: '', naturalWidth: null, naturalHeight: null }]));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const patch = (i: number, p: Partial<GalleryItem>) => set(items.map((it, k) => (k === i ? { ...it, ...p } : it)));
  const rows = rowsOf(items);
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__gallery is-${width} ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <WidthToggle value={width} allow={['wide', 'full']} onChange={(w) => updateAttributes({ width: w })} />
      <BlockTools onRemove={deleteNode}>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={pick} disabled={uploading || items.length >= 6}>
          {uploading ? 'Uploading…' : '+ Picture'}
        </button>
      </BlockTools>
      <figure className="eac-gallery" contentEditable={false}>
        {rows.map((row, r) => (
          <div className="eac-gallery__row" key={r}>
            {row.map(({ item, index }) => (
              <figure
                key={index}
                className={`eac-gallery__item ${open === index ? 'is-open' : ''}`}
                style={{ flex: `${ratio(item)} 1 0%` }}
                onClick={() => setOpen(open === index ? null : index)}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  draggable={false}
                  onLoad={(e) => !item.naturalWidth && patch(index, { naturalWidth: e.currentTarget.naturalWidth, naturalHeight: e.currentTarget.naturalHeight })}
                />
                <span className="studio-cv__gal-ctl">
                  <button type="button" title="Earlier" onClick={(e) => { e.stopPropagation(); move(index, -1); }}>◀</button>
                  <button type="button" title="Later" onClick={(e) => { e.stopPropagation(); move(index, 1); }}>▶</button>
                  <button type="button" title="Remove" onClick={(e) => { e.stopPropagation(); set(items.filter((_, k) => k !== index)); }}>✕</button>
                </span>
              </figure>
            ))}
          </div>
        ))}
        {items.length === 0 && (
          <button type="button" className="studio-cv__pickbtn" onClick={pick} disabled={uploading}>
            {uploading ? 'Uploading…' : '▣ Add the first picture'}
          </button>
        )}
        {open !== null && items[open] && (
          <div className="studio-cv__gal-fields">
            <input className="studio-cv__caption" value={items[open].caption} placeholder={`Caption for picture ${open + 1}`} onChange={(e) => patch(open, { caption: e.target.value })} />
            <label className="studio-cv__alt">
              <span>Alt</span>
              <input value={items[open].alt} aria-invalid={!items[open].alt.trim()} placeholder="Describe this picture (required to publish)" onChange={(e) => patch(open, { alt: e.target.value })} />
            </label>
          </div>
        )}
      </figure>
      <p className="studio-cv__label">{items.length} of 6 · click a picture for its caption and alt · rows share a height</p>
    </NodeViewWrapper>
  );
}

export function ratio(i: GalleryItem): number {
  return i.naturalWidth && i.naturalHeight ? i.naturalWidth / i.naturalHeight : 1;
}

/** Up to three a row, the last row taking the remainder (2–6 pictures: 2 | 3 | 2+2 | 3+2 | 3+3). */
export function rowsOf(items: GalleryItem[]): Array<Array<{ item: GalleryItem; index: number }>> {
  const n = items.length;
  const sizes = n <= 3 ? [n] : n === 4 ? [2, 2] : n === 5 ? [3, 2] : [3, 3];
  const rows: Array<Array<{ item: GalleryItem; index: number }>> = [];
  let i = 0;
  for (const s of sizes) {
    rows.push(items.slice(i, i + s).map((item, k) => ({ item, index: i + k })));
    i += s;
  }
  return rows.filter((r) => r.length);
}
