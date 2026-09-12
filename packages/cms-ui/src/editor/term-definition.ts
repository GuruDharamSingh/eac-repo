import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * A defined term, inline in the prose.
 *
 * The mark stores **only the term**. Its definition and its wiki slug are
 * resolved server-side at render (resolveTerms in @elkdonis/services), which
 * is why the dictionary can be network-wide and auth-gated while a public
 * article still shows the meaning: the server does the lookup, so an
 * anonymous reader gets the text inline instead of a link to a login wall.
 *
 * Resolving late rather than storing the text also means a definition
 * improved on the wiki improves everywhere it has been used, and there is one
 * copy to correct rather than one per article.
 *
 * A term whose page does not exist yet still renders — as an undefined term,
 * the same posture as an unwritten wikilink. Broken is expected state in a
 * wiki, not an error.
 *
 * Rendered as <dfn>, which is the element for exactly this, carrying the term
 * as a data attribute rather than an href so the rendering app owns the route.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    termDefinition: {
      setTermDefinition: (attrs: { term: string }) => ReturnType;
      unsetTermDefinition: () => ReturnType;
    };
  }
}

export const TermDefinition = Mark.create({
  name: 'termDefinition',

  // A term is a leaf of meaning; a second definition inside one is never
  // wanted, and `inclusive: false` stops typing past the end from extending it.
  excludes: '_',
  inclusive: false,

  addAttributes() {
    return {
      term: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-term'),
        renderHTML: (attrs) => (attrs.term ? { 'data-term': attrs.term } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'dfn[data-term]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['dfn', mergeAttributes({ class: 'eac-term' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTermDefinition:
        (attrs) =>
        ({ chain }) =>
          chain().setMark(this.name, attrs).run(),
      unsetTermDefinition:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    };
  },
});
