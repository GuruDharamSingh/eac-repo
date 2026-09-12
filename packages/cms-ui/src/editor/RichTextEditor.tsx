'use client';

import * as React from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Youtube from '@tiptap/extension-youtube';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';

import {
  WikilinkSuggest,
  completeWikilink,
  type WikilinkTrigger,
} from './wikilink-suggest';
import { TermDefinition } from './term-definition';
import { useSurfaceOptional } from '../surface/context';

const lowlight = createLowlight(common);

/**
 * The one rich-text editor. Plain CSS (editor.css), so it renders the same in
 * a Tailwind app and a Mantine one and needs no place in any content glob.
 *
 * It replaced six near-identical Tiptap wrappers — four app-local copies plus
 * packages/studio-ui and packages/ui. Five of those six already shared this
 * exact prop signature, which is why it is `value`/`onChange` rather than
 * packages/ui's `content`; that one call site adapts.
 */

export type EditorToolbar = 'full' | 'minimal' | 'compact';

export interface WikiPageRef {
  title: string;
  slug: string;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
  className?: string;
  /**
   * `full` is everything; `minimal` drops tables/images/code/video;
   * `compact` is a short comment box — marks, lists, quote, link.
   */
  toolbar?: EditorToolbar;
  /**
   * Enables `[[` autocomplete against these pages. Omit to disable entirely —
   * the syntax still works when typed by hand, since it resolves server-side.
   */
  wikiPages?: WikiPageRef[];
  /**
   * The thread being written, so a term defined from here records a reference
   * from the writing to the term.
   */
  sourceThreadId?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight,
  ariaLabel = 'Rich text editor',
  className,
  toolbar = 'full',
  wikiPages,
  sourceThreadId,
}: RichTextEditorProps) {
  const compact = toolbar === 'compact';
  const height = minHeight ?? (compact ? 120 : 240);

  // Optional: the editor works standalone (the wiki form) and inside the
  // surface stack (a compose popup). Only the latter can open a define layer.
  const surface = useSurfaceOptional();
  const canDefine = Boolean(surface && surface.connectors.dictionary);

  const [trigger, setTrigger] = React.useState<WikilinkTrigger | null>(null);
  const [coords, setCoords] = React.useState<{ left: number; bottom: number } | null>(null);
  const [picked, setPicked] = React.useState(0);

  // The plugin calls into this on keydown; the dropdown owns the arrow keys.
  const keydown = React.useRef<((e: KeyboardEvent) => boolean) | null>(null);

  const suggestions = React.useMemo(() => {
    if (!wikiPages || !trigger) return [];
    const q = trigger.query.trim().toLowerCase();
    const pool = q
      ? wikiPages.filter((p) => p.title.toLowerCase().includes(q))
      : wikiPages;
    return pool.slice(0, 8);
  }, [wikiPages, trigger]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, codeBlock: false }),
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ controls: true, nocookie: true }),
      TermDefinition,
      ...(wikiPages
        ? [
            WikilinkSuggest.configure({
              onTrigger: (t, c) => {
                setTrigger(t);
                setCoords(c);
                setPicked(0);
              },
              keydown,
            }),
          ]
        : []),
    ],
    content: value || '',
    editorProps: {
      attributes: { 'aria-label': ariaLabel, class: 'eac-ed-content' },
    },
    onUpdate({ editor }) {
      // An empty editor is "" rather than <p></p>, so a blank draft stays blank.
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    immediatelyRender: false,
  });

  // External resets (form clear, loading a revision) flow back in.
  React.useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (editor.getHTML() !== incoming && incoming !== '<p></p>') {
      editor.commands.setContent(incoming, false);
    }
  }, [value, editor]);

  const open = Boolean(trigger && wikiPages);

  const accept = React.useCallback(
    (title: string) => {
      if (!editor || !trigger) return;
      completeWikilink(editor, trigger, title);
      setTrigger(null);
    },
    [editor, trigger]
  );

  // Registered as a ref so the plugin sees the current closure without
  // rebuilding the extension list on every keystroke.
  keydown.current = (event) => {
    if (!open) return false;
    const count = suggestions.length + (trigger?.query.trim() ? 1 : 0);
    if (count === 0) return false;

    if (event.key === 'ArrowDown') {
      setPicked((i) => (i + 1) % count);
      return true;
    }
    if (event.key === 'ArrowUp') {
      setPicked((i) => (i - 1 + count) % count);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const hit = suggestions[picked];
      accept(hit ? hit.title : (trigger?.query.trim() ?? ''));
      return true;
    }
    if (event.key === 'Escape') {
      setTrigger(null);
      return true;
    }
    return false;
  };

  /**
   * Mark the selection as a term and open the define layer over the article.
   *
   * The mark goes on first and carries only the term, so the prose is marked
   * up whether or not the definition gets written — and because the
   * definition is resolved at render from the wiki, nothing has to come back
   * from the surface for this to end up correct.
   */
  const defineSelection = React.useCallback(() => {
    if (!editor || !surface) return;
    const { from, to } = editor.state.selection;
    const term = editor.state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim();
    if (!term) return;
    editor.chain().focus().setTermDefinition({ term }).run();
    surface.push({ type: 'define', term, sourceThreadId });
  }, [editor, surface, sourceThreadId]);

  return (
    <div className={className ? `eac-ed ${className}` : 'eac-ed'}>
      <Toolbar
        editor={editor}
        toolbar={toolbar}
        onDefine={canDefine ? defineSelection : undefined}
      />
      <div
        className="eac-ed-body"
        style={{ minHeight: height }}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {open && coords && (
        <div
          className="eac-ed-suggest"
          style={{ left: coords.left, top: coords.bottom + 4 }}
          role="listbox"
          aria-label="Wiki pages"
        >
          {suggestions.map((page, i) => (
            <button
              key={page.slug}
              type="button"
              role="option"
              aria-selected={i === picked}
              className="eac-ed-suggest-item"
              onMouseDown={(e) => {
                e.preventDefault();
                accept(page.title);
              }}
            >
              {page.title}
            </button>
          ))}
          {trigger?.query.trim() ? (
            <button
              type="button"
              role="option"
              aria-selected={picked === suggestions.length}
              className="eac-ed-suggest-item eac-ed-suggest-new"
              onMouseDown={(e) => {
                e.preventDefault();
                accept(trigger.query.trim());
              }}
            >
              Link “{trigger.query.trim()}” — new page
            </button>
          ) : (
            suggestions.length === 0 && (
              <p className="eac-ed-suggest-empty">No pages yet. Keep typing to name one.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar({
  editor,
  toolbar,
  onDefine,
}: {
  editor: Editor | null;
  toolbar: EditorToolbar;
  onDefine?: () => void;
}) {
  if (!editor) return <div className="eac-ed-bar eac-ed-bar--placeholder" />;

  const full = toolbar === 'full';
  const compact = toolbar === 'compact';
  const hasSelection = !editor.state.selection.empty;

  return (
    <div className="eac-ed-bar">
      <Btn on={editor.isActive('bold')} act={() => editor.chain().focus().toggleBold().run()} label="Bold">
        <b>B</b>
      </Btn>
      <Btn on={editor.isActive('italic')} act={() => editor.chain().focus().toggleItalic().run()} label="Italic">
        <i>I</i>
      </Btn>
      <Btn on={editor.isActive('underline')} act={() => editor.chain().focus().toggleUnderline().run()} label="Underline">
        <u>U</u>
      </Btn>
      <Btn on={editor.isActive('strike')} act={() => editor.chain().focus().toggleStrike().run()} label="Strikethrough">
        <s>S</s>
      </Btn>
      <Btn on={editor.isActive('highlight')} act={() => editor.chain().focus().toggleHighlight().run()} label="Highlight">
        ▨
      </Btn>

      {!compact && (
        <>
          <Sep />
          <Btn on={editor.isActive('heading', { level: 2 })} act={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading 2">
            H2
          </Btn>
          <Btn on={editor.isActive('heading', { level: 3 })} act={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Heading 3">
            H3
          </Btn>
        </>
      )}

      <Sep />
      <Btn on={editor.isActive('bulletList')} act={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list">
        •
      </Btn>
      <Btn on={editor.isActive('orderedList')} act={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list">
        1.
      </Btn>
      <Btn on={editor.isActive('blockquote')} act={() => editor.chain().focus().toggleBlockquote().run()} label="Quote">
        ””
      </Btn>

      <Sep />
      <Btn on={editor.isActive('link')} act={() => promptLink(editor)} label="Link">
        ↗
      </Btn>
      {onDefine && (
        <Btn
          on={editor.isActive('termDefinition')}
          act={() =>
            editor.isActive('termDefinition')
              ? editor.chain().focus().unsetTermDefinition().run()
              : onDefine()
          }
          label={
            editor.isActive('termDefinition')
              ? 'Undefine this term'
              : hasSelection
                ? 'Define this term'
                : 'Select a word to define it'
          }
          disabled={!hasSelection && !editor.isActive('termDefinition')}
        >
          §
        </Btn>
      )}

      {full && (
        <>
          <Btn on={editor.isActive('codeBlock')} act={() => editor.chain().focus().toggleCodeBlock().run()} label="Code block">
            {'{ }'}
          </Btn>
          <Btn act={() => promptImage(editor)} label="Image">
            ▣
          </Btn>
          <Btn act={() => promptYoutube(editor)} label="Embed video">
            ▶
          </Btn>
          <Sep />
          <Btn
            act={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            label="Insert table"
          >
            ▦
          </Btn>
          {editor.isActive('table') && (
            <>
              <Btn act={() => editor.chain().focus().addRowAfter().run()} label="Add row">
                +R
              </Btn>
              <Btn act={() => editor.chain().focus().addColumnAfter().run()} label="Add column">
                +C
              </Btn>
              <Btn act={() => editor.chain().focus().deleteRow().run()} label="Delete row">
                −R
              </Btn>
              <Btn act={() => editor.chain().focus().deleteColumn().run()} label="Delete column">
                −C
              </Btn>
              <Btn act={() => editor.chain().focus().deleteTable().run()} label="Delete table">
                ⌧
              </Btn>
            </>
          )}
          <Sep />
          <Btn on={editor.isActive({ textAlign: 'left' })} act={() => editor.chain().focus().setTextAlign('left').run()} label="Align left">
            ⇤
          </Btn>
          <Btn on={editor.isActive({ textAlign: 'center' })} act={() => editor.chain().focus().setTextAlign('center').run()} label="Align centre">
            ↔
          </Btn>
          <Btn on={editor.isActive({ textAlign: 'right' })} act={() => editor.chain().focus().setTextAlign('right').run()} label="Align right">
            ⇥
          </Btn>
        </>
      )}

      <Sep />
      <Btn act={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} label="Clear formatting">
        ⌫
      </Btn>
    </div>
  );
}

function promptLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined;
  const url = window.prompt('Link URL', previous ?? 'https://');
  if (url === null) return;
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function promptImage(editor: Editor) {
  const url = window.prompt('Image URL');
  if (!url) return;
  const alt = window.prompt('Describe the image (for screen readers)') ?? '';
  editor.chain().focus().setImage({ src: url, alt }).run();
}

function promptYoutube(editor: Editor) {
  const url = window.prompt('YouTube URL');
  if (!url) return;
  editor.commands.setYoutubeVideo({ src: url });
}

function Sep() {
  return <span className="eac-ed-sep" aria-hidden />;
}

function Btn({
  on,
  act,
  label,
  disabled,
  children,
}: {
  on?: boolean;
  act: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={act}
      aria-label={label}
      aria-pressed={on ?? false}
      title={label}
      disabled={disabled}
      className="eac-ed-btn"
    >
      {children}
    </button>
  );
}
