import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { PullQuoteView } from '../views/PullQuoteView';
import { AsideView } from '../views/AsideView';
import { DividerView } from '../views/DividerView';
import { ThreadCardView } from '../views/ThreadCardView';
import type { ThreadCardAttrs } from '@elkdonis/utils/essay';

// ============================================================================
// The text-bearing blocks (pull quote, aside) hold inline content so they are
// typed into directly; the atoms (divider, card) are edited through their
// node views. Each parseHTML rule accepts what @elkdonis/essay renders, so a
// saved body round-trips.
// ============================================================================

export const PullQuote = Node.create({
  name: 'pullQuote',
  group: 'block',
  content: 'inline*',
  draggable: true,
  defining: true,
  addAttributes() {
    return {
      width: { default: 'content' },
      attribution: { default: '' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'blockquote.eac-pull',
        contentElement: 'p',
        getAttrs: (el) => ({
          width: (el as HTMLElement).classList.contains('eac-w-wide') ? 'wide' : 'content',
          attribution: (el as HTMLElement).querySelector('cite')?.textContent ?? '',
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const w = HTMLAttributes.width === 'wide' ? ' eac-w-wide' : '';
    return ['blockquote', mergeAttributes({ class: `eac-pull${w}` }), ['p', 0], ['cite', {}, HTMLAttributes.attribution ?? '']];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PullQuoteView);
  },
});

export const Aside = Node.create({
  name: 'aside',
  group: 'block',
  content: 'inline*',
  draggable: true,
  defining: true,
  parseHTML() {
    return [{ tag: 'aside.eac-aside', contentElement: 'p' }];
  },
  renderHTML() {
    return ['aside', { class: 'eac-aside' }, ['p', 0]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AsideView);
  },
});

export const Divider = Node.create({
  name: 'divider',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { style: { default: 'ornament' } };
  },
  parseHTML() {
    return [
      {
        tag: 'hr.eac-divider',
        getAttrs: (el) => {
          const c = (el as HTMLElement).className;
          return { style: c.includes('--rule') ? 'rule' : c.includes('--space') ? 'space' : 'ornament' };
        },
      },
      // A plain <hr> from the small editor becomes a rule.
      { tag: 'hr', getAttrs: () => ({ style: 'rule' }) },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', { class: `eac-divider eac-divider--${HTMLAttributes.style ?? 'ornament'}` }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DividerView);
  },
});

export interface ThreadCardSearchHit extends Omit<ThreadCardAttrs, 'view'> {}

export interface ThreadCardOptions {
  /** The host's search over the writer's own things, by kind. */
  search: (kind: string, q: string) => Promise<ThreadCardSearchHit[]>;
}

export const ThreadCard = Node.create<ThreadCardOptions>({
  name: 'threadCard',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return { search: async () => [] };
  },
  addAttributes() {
    return {
      threadId: { default: null },
      kind: { default: 'writing' },
      title: { default: '' },
      meta: { default: null },
      href: { default: null },
      coverImageUrl: { default: null },
      price: { default: null },
      forSale: { default: false },
      view: { default: 'card' },
      width: { default: 'content' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-eac-card="thread"]',
        getAttrs: (el) => {
          const f = el as HTMLElement;
          return {
            threadId: f.getAttribute('data-thread-id'),
            kind: f.getAttribute('data-kind') ?? 'writing',
            view: f.getAttribute('data-view') === 'compact' ? 'compact' : 'card',
            width: f.classList.contains('eac-w-wide') ? 'wide' : 'content',
            title: f.querySelector('.eac-card__title')?.textContent ?? '',
            meta: f.querySelector('.eac-card__meta')?.textContent ?? null,
            href: f.querySelector('.eac-card__title a')?.getAttribute('href') ?? null,
            coverImageUrl: f.querySelector('img')?.getAttribute('src') ?? null,
            price: f.querySelector('.eac-card__price:not(.eac-card__price--nfs)')?.textContent ?? null,
            forSale: Boolean(f.querySelector('.eac-card__price:not(.eac-card__price--nfs)')),
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as Partial<ThreadCardAttrs>;
    return [
      'figure',
      { class: `eac-card eac-card--${a.kind ?? 'thread'}${(HTMLAttributes as { width?: string }).width === 'wide' ? ' eac-w-wide' : ''}`, 'data-eac-card': 'thread', 'data-thread-id': a.threadId, 'data-kind': a.kind, 'data-view': a.view ?? 'card' },
      ['figcaption', {}, ['strong', { class: 'eac-card__title' }, a.title ?? '']],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ThreadCardView);
  },
});
