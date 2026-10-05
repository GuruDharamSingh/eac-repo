import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';

// ============================================================================
// The keys that make blocks feel like paragraphs (dev, 2026-09-27: "if I
// click on the block and start typing, the block disappears", "I can't go
// back to typing underneath the block").
//
// ProseMirror's defaults: typing over a selected node replaces it; Enter in
// a single-line block stays in it; a document may end with an atom, leaving
// nowhere to click into. Here:
//
//   trailing paragraph   the document always ends with an empty paragraph
//   type on a block      starts a paragraph after the selected block instead
//   Enter                in a pull quote, aside or picture-with-text, or on a
//                        selected block: a new paragraph after it
//   Backspace            in an empty pull quote or aside: back to a paragraph
//   Escape               on a selected block: the cursor after it
//   Mod-Alt-↑ / ↓        move the block the cursor is in (or the selected one)
// ============================================================================

const SINGLE_LINE = new Set(['pullQuote', 'aside', 'figureText']);

/** A paragraph after the top-level block that holds `pos`, with the cursor in it. */
function paragraphAfterBlock(state: EditorState, tr: Transaction, blockEnd: number, text = ''): Transaction {
  const para = state.schema.nodes.paragraph.create(null, text ? state.schema.text(text) : undefined);
  tr.insert(blockEnd, para);
  tr.setSelection(TextSelection.create(tr.doc, blockEnd + 1 + text.length));
  return tr.scrollIntoView();
}

/** Swap the top-level block at the selection with its neighbour; the selection travels with it. */
function moveBlock(state: EditorState, dispatch: (tr: Transaction) => void, dir: -1 | 1): boolean {
  const sel = state.selection;
  const $from = sel.$from;
  const start = sel instanceof NodeSelection ? sel.from : $from.depth >= 1 ? $from.before(1) : null;
  if (start === null) return false;
  const node = state.doc.nodeAt(start);
  if (!node) return false;
  const end = start + node.nodeSize;
  const index = state.doc.resolve(start).index(0);
  const target = index + dir;
  if (target < 0 || target >= state.doc.childCount) return false;
  const other = state.doc.child(target);
  const otherStart = dir < 0 ? start - other.nodeSize : end;
  const offsetInBlock = sel instanceof NodeSelection ? null : sel.from - start;
  const tr = state.tr.delete(start, end);
  const insertAt = dir < 0 ? otherStart : otherStart + other.nodeSize - node.nodeSize;
  tr.insert(insertAt, node);
  tr.setSelection(offsetInBlock === null ? NodeSelection.create(tr.doc, insertAt) : TextSelection.create(tr.doc, insertAt + offsetInBlock));
  dispatch(tr.scrollIntoView());
  return true;
}

export const EssayKeys = Extension.create({
  name: 'essayKeys',

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const sel = state.selection;
        if (sel instanceof NodeSelection) {
          const end = sel.from + sel.node.nodeSize;
          editor.view.dispatch(paragraphAfterBlock(state, state.tr, end));
          return true;
        }
        const $from = sel.$from;
        if ($from.depth >= 1 && SINGLE_LINE.has($from.node(1).type.name)) {
          const end = $from.after(1);
          editor.view.dispatch(paragraphAfterBlock(state, state.tr, end));
          return true;
        }
        return false;
      },
      Backspace: ({ editor }) => {
        const { state } = editor;
        const $from = state.selection.$from;
        if (!state.selection.empty || $from.depth < 1) return false;
        const block = $from.node(1);
        if ((block.type.name === 'pullQuote' || block.type.name === 'aside') && block.content.size === 0) {
          const start = $from.before(1);
          const tr = state.tr.replaceWith(start, start + block.nodeSize, state.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, start + 1));
          editor.view.dispatch(tr);
          return true;
        }
        return false;
      },
      'Mod-Alt-ArrowUp': ({ editor }) => moveBlock(editor.state, editor.view.dispatch, -1),
      'Mod-Alt-ArrowDown': ({ editor }) => moveBlock(editor.state, editor.view.dispatch, 1),
      Escape: ({ editor }) => {
        const { state } = editor;
        const sel = state.selection;
        if (!(sel instanceof NodeSelection)) return false;
        const end = sel.from + sel.node.nodeSize;
        const $end = state.doc.resolve(Math.min(end, state.doc.content.size));
        const next = TextSelection.findFrom($end, 1, true) ?? TextSelection.create(state.doc, state.doc.content.size);
        editor.view.dispatch(state.tr.setSelection(next).scrollIntoView());
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('essayTrailingParagraph'),
        // The document always ends with an empty paragraph, so there is
        // always somewhere to click and type after the last block.
        appendTransaction(_trs, _old, state) {
          const last = state.doc.lastChild;
          if (last && last.type.name === 'paragraph' && last.content.size === 0) return null;
          return state.tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create());
        },
        props: {
          // Typing on a selected block starts a paragraph after it, with what
          // was typed, instead of replacing the block.
          handleTextInput(view, _from, _to, text) {
            const sel = view.state.selection;
            if (!(sel instanceof NodeSelection)) return false;
            const end = sel.from + sel.node.nodeSize;
            view.dispatch(paragraphAfterBlock(view.state, view.state.tr, end, text));
            return true;
          },
        },
      }),
    ];
  },
});
