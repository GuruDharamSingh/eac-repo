import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageView } from '../views/ImageView';

// ============================================================================
// Image: a captioned figure at one of three widths (brief §4). Atom, so the
// caption and alt are attributes edited in the node view, not child nodes:
// that keeps the whole figure one draggable unit and the document flat.
//
// parseHTML accepts the renderer's own figure (a saved canvas body) and a
// bare <img> (a body written with the small editor), so any piece opens in
// the canvas.
// ============================================================================

export interface EssayImageAttrs {
  src: string | null;
  alt: string;
  caption: string;
  width: 'content' | 'wide' | 'full';
  naturalWidth: number | null;
  naturalHeight: number | null;
  focalX: number | null;
  focalY: number | null;
  href: string | null;
}

const num = (v: string | null): number | null => (v && /^\d+$/.test(v) ? Number(v) : null);

export const EssayImage = Node.create({
  name: 'essayImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: 'content' },
      naturalWidth: { default: null },
      naturalHeight: { default: null },
      focalX: { default: null },
      focalY: { default: null },
      href: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.eac-image',
        getAttrs: (el) => {
          const fig = el as HTMLElement;
          const img = fig.querySelector('img');
          if (!img) return false;
          const w = fig.getAttribute('data-width');
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') ?? '',
            caption: fig.querySelector('figcaption')?.textContent ?? '',
            width: w === 'wide' || w === 'full' ? w : 'content',
            naturalWidth: num(img.getAttribute('width')),
            naturalHeight: num(img.getAttribute('height')),
            href: fig.querySelector('a')?.getAttribute('href') ?? null,
          };
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (el) => {
          const img = el as HTMLImageElement;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') ?? '',
            caption: img.getAttribute('title') ?? '',
            width: 'content',
            naturalWidth: num(img.getAttribute('width')),
            naturalHeight: num(img.getAttribute('height')),
          };
        },
      },
    ];
  },

  // Only for the clipboard and the parser's round trip; the page HTML comes
  // from @elkdonis/essay's renderer on the server.
  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as Partial<EssayImageAttrs>;
    return [
      'figure',
      mergeAttributes({ class: `eac-image${a.width && a.width !== 'content' ? ` eac-w-${a.width}` : ''}`, 'data-width': a.width ?? 'content' }),
      ['img', { src: a.src, alt: a.alt ?? '', width: a.naturalWidth ?? undefined, height: a.naturalHeight ?? undefined }],
      ['figcaption', {}, a.caption ?? ''],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
