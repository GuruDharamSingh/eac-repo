import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import type { Extensions } from '@tiptap/core';
import { EssayImage } from './image';
import { Aside, Divider, PullQuote, ThreadCard, type ThreadCardOptions } from './blocks';
import { FigureText, Gallery } from './layout';
import { EssayKeys } from './keys';

/**
 * The canvas schema. StarterKit gives paragraphs, h2–h3 (rule 8: two levels),
 * lists, quotes, code and the marks; its horizontal rule and image are
 * replaced by ours so a plain body parses into the essay's blocks.
 */
export function essayExtensions(opts: { placeholder?: string; card: ThreadCardOptions }): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      horizontalRule: false,
      codeBlock: {},
    }),
    Underline,
    Highlight,
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
    Placeholder.configure({ placeholder: opts.placeholder ?? 'Start writing.' }),
    EssayImage,
    PullQuote,
    Aside,
    Divider,
    ThreadCard.configure(opts.card),
    FigureText,
    Gallery,
    EssayKeys,
  ];
}

export { EssayImage, PullQuote, Aside, Divider, ThreadCard, FigureText, Gallery };
export type { ThreadCardOptions, ThreadCardSearchHit } from './blocks';
