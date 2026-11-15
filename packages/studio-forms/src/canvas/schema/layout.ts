import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FigureTextView } from '../views/FigureTextView';
import { GalleryView } from '../views/GalleryView';

// ============================================================================
// The two blocks that place pictures beside or among each other (brief §4):
//
//   figureText  one picture beside a paragraph or two; the only side-by-side
//               block, and it stacks under 60ch (rule 3)
//   gallery     two to six pictures in rows that share a height by aspect
//               ratio (Ghost's flex trick), wide or full
// ============================================================================

export interface GalleryItem {
  src: string;
  alt: string;
  caption: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
}

const num = (v: string | null | undefined): number | null => (v && /^\d+$/.test(v) ? Number(v) : null);

export const FigureText = Node.create({
  name: 'figureText',
  group: 'block',
  content: 'inline*',
  draggable: true,
  defining: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      side: { default: 'left' },
      share: { default: 45 },
      naturalWidth: { default: null },
      naturalHeight: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure.eac-figtext',
        contentElement: '.eac-figtext__text',
        getAttrs: (el) => {
          const f = el as HTMLElement;
          const img = f.querySelector('img');
          return {
            src: img?.getAttribute('src') ?? null,
            alt: img?.getAttribute('alt') ?? '',
            caption: f.querySelector('figcaption')?.textContent ?? '',
            side: f.classList.contains('eac-figtext--right') ? 'right' : 'left',
            share: num(f.getAttribute('data-share')) ?? 45,
            naturalWidth: num(img?.getAttribute('width')),
            naturalHeight: num(img?.getAttribute('height')),
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes: a }) {
    return [
      'figure',
      mergeAttributes({ class: `eac-figtext eac-figtext--${a.side ?? 'left'}`, 'data-share': a.share ?? 45 }),
      ['img', { src: a.src, alt: a.alt ?? '' }],
      ['div', { class: 'eac-figtext__text' }, ['p', 0]],
      ['figcaption', {}, a.caption ?? ''],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureTextView);
  },
});

export const Gallery = Node.create({
  name: 'gallery',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      items: { default: [] as GalleryItem[] },
      width: { default: 'wide' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure.eac-gallery',
        getAttrs: (el) => {
          const f = el as HTMLElement;
          const items: GalleryItem[] = Array.from(f.querySelectorAll('.eac-gallery__item')).map((it) => {
            const img = it.querySelector('img');
            return {
              src: img?.getAttribute('src') ?? '',
              alt: img?.getAttribute('alt') ?? '',
              caption: it.querySelector('figcaption')?.textContent ?? '',
              naturalWidth: num(img?.getAttribute('width')),
              naturalHeight: num(img?.getAttribute('height')),
            };
          });
          return { items: items.filter((i) => i.src), width: f.classList.contains('eac-w-full') ? 'full' : 'wide' };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes: a }) {
    const items = (a.items ?? []) as GalleryItem[];
    return [
      'figure',
      { class: `eac-gallery eac-w-${a.width === 'full' ? 'full' : 'wide'}` },
      ['div', { class: 'eac-gallery__row' }, ...items.map((i) => ['figure', { class: 'eac-gallery__item' }, ['img', { src: i.src, alt: i.alt }]] as never)],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GalleryView);
  },
});
