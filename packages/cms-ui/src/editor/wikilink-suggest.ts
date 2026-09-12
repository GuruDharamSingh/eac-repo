import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * `[[` autocomplete.
 *
 * Wikilinks are stored as literal `[[Title]]` text and resolved server-side at
 * save time (see resolveWikilinks in @elkdonis/services), so this deliberately
 * adds no node and no mark — it only helps you type a title that will resolve.
 * That keeps the stored body identical whether it was typed by hand or picked
 * from this list, and means an unresolved link stays a first-class thing
 * rather than editor state.
 *
 * Hand-rolled rather than @tiptap/suggestion: that package is not a dependency
 * here, and all this needs is "find an unclosed [[ before the cursor".
 */

export type WikilinkTrigger = { query: string; from: number; to: number };

export interface WikilinkSuggestOptions {
  /** Called on every state change with the live trigger, or null when closed. */
  onTrigger: (
    trigger: WikilinkTrigger | null,
    coords: { left: number; bottom: number } | null
  ) => void;
  /**
   * Consulted on keydown only while a trigger is open. The dropdown owns
   * arrow/enter/escape; returning true swallows the key from the editor.
   */
  keydown: { current: ((event: KeyboardEvent) => boolean) | null };
}

const pluginKey = new PluginKey<WikilinkTrigger | null>('wikilinkSuggest');

/** An unclosed `[[`, with whatever has been typed since, at the cursor. */
const TRIGGER = /\[\[([^[\]\n]*)$/;

function triggerAt(state: EditorState): WikilinkTrigger | null {
  const { selection } = state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  if (!$from.parent.isTextblock) return null;

  // Non-text leaves collapse to a placeholder char so offsets stay aligned.
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = TRIGGER.exec(before);
  if (!match) return null;

  return {
    query: match[1],
    from: $from.start() + match.index,
    to: $from.pos,
  };
}

function coordsOf(view: EditorView, pos: number) {
  const box = view.coordsAtPos(pos);
  return { left: box.left, bottom: box.bottom };
}

export const WikilinkSuggest = Extension.create<WikilinkSuggestOptions>({
  name: 'wikilinkSuggest',

  addOptions() {
    return { onTrigger: () => {}, keydown: { current: null } };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<WikilinkTrigger | null>({
        key: pluginKey,
        state: {
          init: (_config, state) => triggerAt(state),
          apply: (_tr, _value, _oldState, newState) => triggerAt(newState),
        },
        props: {
          handleKeyDown(view, event) {
            if (!pluginKey.getState(view.state)) return false;
            return options.keydown.current?.(event) ?? false;
          },
        },
        view() {
          return {
            update(view) {
              const trigger = pluginKey.getState(view.state) ?? null;
              options.onTrigger(trigger, trigger ? coordsOf(view, trigger.from) : null);
            },
            destroy() {
              options.onTrigger(null, null);
            },
          };
        },
      }),
    ];
  },
});

/**
 * Complete the open `[[` into `[[Title]]`, replacing whatever was typed.
 * The caret lands after the closing brackets so typing simply continues.
 */
export function completeWikilink(editor: Editor, trigger: WikilinkTrigger, title: string) {
  editor
    .chain()
    .focus()
    .insertContentAt({ from: trigger.from, to: trigger.to }, `[[${title}]]`)
    .run();
}
