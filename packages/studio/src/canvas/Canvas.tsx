'use client';

import * as React from 'react';
import { EditorContent, BubbleMenu, useEditor, type Editor } from '@tiptap/react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { EssayDoc } from '@elkdonis/utils/essay';
import { essayExtensions, type ThreadCardOptions } from './schema';
import { UploadContext, type EditorUpload } from './upload-context';

// ============================================================================
// The essay canvas: a TipTap document of blocks with a grip in the margin,
// a "+" at the foot of the hovered block that opens the block menu, a
// "Turn into…" bubble on selection, a small formatting bar, and Library or
// desktop drops that land at block boundaries (brief §7).
//
// Owns no data: `doc` in, `onChange(doc)` out. Uploads and the card search
// are the host's, passed in.
// ============================================================================

export interface CanvasUpload {
  endpoint: string;
  fields?: Record<string, string>;
}

export interface CanvasProps {
  /** The document to edit; null with `html` set parses a plain body into blocks. */
  doc: EssayDoc | null;
  html?: string;
  onChange: (doc: EssayDoc) => void;
  upload?: CanvasUpload;
  card: ThreadCardOptions;
  placeholder?: string;
}

const MEDIA_MIME = 'application/x-eac-media';

/**
 * The document as plain JSON. ProseMirror builds node attrs with a null
 * prototype, and React's server-action serialiser turns such objects into
 * "temporary references" that throw on any property access on the server
 * (seen 2026-09-27: renderEssayHtml reading attrs.style). A JSON round trip
 * makes every object plain.
 */
function plainDoc(ed: Editor): EssayDoc {
  return JSON.parse(JSON.stringify(ed.getJSON())) as EssayDoc;
}

async function uploadFile(file: File, upload: CanvasUpload): Promise<string | null> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('title', file.name.replace(/\.[a-z0-9]+$/i, ''));
  for (const [k, v] of Object.entries(upload.fields ?? {})) fd.append(k, v);
  const res = await fetch(upload.endpoint, { method: 'POST', body: fd });
  const data = (await res.json().catch(() => ({}))) as { url?: string };
  return res.ok && data.url ? data.url : null;
}

/** What MediaBrowser's drag carries: a URL, or JSON with one. */
function mediaUrlFrom(dt: DataTransfer): string | null {
  const raw = dt.getData(MEDIA_MIME);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { url?: string; src?: string };
    return j.url ?? j.src ?? null;
  } catch {
    return raw;
  }
}

/** The block menu: what "+" offers. Cards open as pickers. */
const BLOCKS: Array<{ label: string; hint: string; type: string; attrs?: Record<string, unknown>; text?: boolean }> = [
  { label: 'Paragraph', hint: 'Plain text', type: 'paragraph', text: true },
  { label: 'Picture', hint: 'One picture, captioned', type: 'essayImage' },
  { label: 'Gallery', hint: 'Two to six pictures in rows', type: 'gallery' },
  { label: 'Picture with text', hint: 'Side by side; stacks on a phone', type: 'figureText', text: true },
  { label: 'Pull quote', hint: 'A line lifted from the piece', type: 'pullQuote', attrs: { width: 'content' }, text: true },
  { label: 'Aside', hint: 'A note in the margin', type: 'aside', text: true },
  { label: 'Divider', hint: 'A rest between sections', type: 'divider' },
  { label: 'Meeting card', hint: 'One of your meetings, live', type: 'threadCard', attrs: { kind: 'meeting' } },
  { label: 'Artwork card', hint: 'From the store, with its price', type: 'threadCard', attrs: { kind: 'artwork' } },
  { label: 'Piece card', hint: 'Another piece of yours', type: 'threadCard', attrs: { kind: 'writing' } },
  { label: 'Heading', hint: 'Section title', type: 'heading', attrs: { level: 2 }, text: true },
];

export function Canvas({ doc, html, onChange, upload, card, placeholder }: CanvasProps) {
  const uploadRef = React.useRef(upload);
  uploadRef.current = upload;
  // "/" on an empty line opens the block menu; the handler lives in a ref
  // because the editor is created before the menu state exists.
  const slashRef = React.useRef<() => void>(() => {});
  const editorUpload = React.useMemo<EditorUpload | null>(
    () => (upload ? (f) => uploadFile(f, uploadRef.current!) : null),
    [upload]
  );

  const editor = useEditor({
    extensions: essayExtensions({ placeholder, card }),
    content: doc ?? html ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'studio-cv__content', 'aria-label': 'Body' },
      handleKeyDown(view, event) {
        if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return false;
        const $from = view.state.selection.$from;
        if (!view.state.selection.empty || $from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) return false;
        event.preventDefault();
        slashRef.current();
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false; // a block moved within the doc: ProseMirror's own drop
        const dt = event.dataTransfer;
        if (!dt) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.to;
        const insertAt = boundaryNear(view.state, pos);
        const url = mediaUrlFrom(dt);
        if (url) {
          event.preventDefault();
          view.dispatch(view.state.tr.insert(insertAt, view.state.schema.nodes.essayImage.create({ src: url })));
          return true;
        }
        const files = Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length && uploadRef.current) {
          event.preventDefault();
          void (async () => {
            const srcs: string[] = [];
            for (const f of files) {
              const src = await uploadFile(f, uploadRef.current!);
              if (src) srcs.push(src);
            }
            if (srcs.length === 0) return;
            // One picture is an image; several become a gallery (brief §7).
            const node =
              srcs.length === 1
                ? view.state.schema.nodes.essayImage.create({ src: srcs[0] })
                : view.state.schema.nodes.gallery.create({
                    items: srcs.slice(0, 6).map((src) => ({ src, alt: '', caption: '', naturalWidth: null, naturalHeight: null })),
                    width: 'wide',
                  });
            view.dispatch(view.state.tr.insert(insertAt, node));
          })();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      onChange(plainDoc(ed));
    },
  });

  // A plain body parsed in becomes a doc the host should have: emit once.
  const emitted = React.useRef(false);
  React.useEffect(() => {
    if (editor && !doc && !emitted.current) {
      emitted.current = true;
      onChange(plainDoc(editor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // The hovered top-level block, for the "+" at its foot.
  const [hover, setHover] = React.useState<{ pos: number; bottom: number } | null>(null);
  const pinned = React.useRef(false);
  const root = React.useRef<HTMLDivElement>(null);
  const onNodeChange = React.useCallback(({ node, pos, editor: ed }: { node: unknown; pos: number; editor: Editor }) => {
    if (!node || pos < 0) {
      if (!pinned.current) setHover(null);
      return;
    }
    const dom = ed.view.nodeDOM(pos) as HTMLElement | null;
    const r = dom?.getBoundingClientRect();
    const rootR = root.current?.getBoundingClientRect();
    if (!r || !rootR) return;
    setHover({ pos, bottom: r.bottom - rootR.top });
  }, []);
  const tippyOptions = React.useMemo(() => ({ placement: 'left-start' as const, offset: [0, 6] as [number, number], zIndex: 4 }), []);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (menuOpen) menuRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [menuOpen]);
  /** Open the menu at the block that holds the cursor (the bar's + Block, and touch). */
  const openAtCursor = () => {
    if (!editor) return;
    const $from = editor.state.selection.$from;
    const pos = $from.depth >= 1 ? $from.before(1) : editor.state.selection.from;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    const r = dom?.getBoundingClientRect();
    const rootR = root.current?.getBoundingClientRect();
    if (r && rootR) setHover({ pos, bottom: r.bottom - rootR.top });
    pinned.current = true;
    setMenuOpen(true);
  };
  slashRef.current = openAtCursor;
  /** The permanent button under the canvas: a block at the very end. */
  const openAtEnd = () => {
    if (!editor) return;
    const last = editor.state.doc.lastChild;
    const pos = last ? editor.state.doc.content.size - last.nodeSize : 0;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    const r = dom?.getBoundingClientRect();
    const rootR = root.current?.getBoundingClientRect();
    if (r && rootR) setHover({ pos, bottom: r.bottom - rootR.top });
    pinned.current = true;
    setMenuOpen(true);
  };
  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.studio-cv__menu, .studio-cv__plus')) {
        setMenuOpen(false);
        pinned.current = false;
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  if (!editor) return <div className="studio-cv" ref={root} />;

  const insertAfterHovered = (b: (typeof BLOCKS)[number]) => {
    const pos = hover?.pos;
    let at: number;
    let replaceTo: number | null = null;
    if (pos != null) {
      const node = editor.state.doc.nodeAt(pos);
      // An empty paragraph (the "/" line) is replaced, not kept above the block.
      if (node && node.type.name === 'paragraph' && node.content.size === 0) {
        at = pos;
        replaceTo = pos + node.nodeSize;
      } else {
        at = pos + (node?.nodeSize ?? 0);
      }
    } else {
      at = editor.state.selection.$from.after(1) || editor.state.doc.content.size;
    }
    const content = b.text ? { type: b.type, attrs: b.attrs ?? {}, content: [] } : { type: b.type, attrs: b.attrs ?? {} };
    const chain = editor.chain().focus().insertContentAt(replaceTo === null ? at : { from: at, to: replaceTo }, content);
    if (b.text) chain.setTextSelection(at + 1);
    else chain.setNodeSelection(at);
    chain.run();
    if (!b.text) {
      // A picture, card or divider is selected on arrival so its tools show;
      // the trailing-paragraph rule and the typing/Enter keys take it from
      // there (schema/keys.ts). Scroll it into view.
      editor.commands.scrollIntoView();
    }
    setMenuOpen(false);
    pinned.current = false;
    setHover(null);
  };

  return (
    <UploadContext.Provider value={editorUpload}>
      <div className="studio-cv" ref={root}>
        <FormatBar editor={editor} onAddBlock={openAtCursor} />
        {/* The drag-handle plugin moves its element out of React's tree
            (tippy appends it to the editor). It gets a wrapper of its own,
            and the + and menu get theirs, so React never inserts a sibling
            "before" a node that is no longer there (DOMException,
            2026-09-27). */}
        <div className="studio-cv__handle-slot">
          <DragHandle editor={editor} tippyOptions={tippyOptions} onNodeChange={onNodeChange}>
            <div className="studio-cv__grip" title="Drag to move">
              ⠿
            </div>
          </DragHandle>
        </div>
        <div className="studio-cv__overlay">
        {hover && (
          <button
            type="button"
            className="studio-cv__plus"
            style={{ top: hover.bottom - 11 }}
            title="Insert a block after this one"
            onMouseEnter={() => {
              pinned.current = true;
            }}
            onMouseLeave={() => {
              if (!menuOpen) pinned.current = false;
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              pinned.current = true;
              setMenuOpen((v) => !v);
            }}
          >
            +
          </button>
        )}
        {menuOpen && hover && (
          <div className="studio-cv__menu" role="menu" style={{ top: hover.bottom + 4 }} ref={menuRef}>
            {BLOCKS.map((b) => (
              <button key={b.label} type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => insertAfterHovered(b)}>
                <b>{b.label}</b>
                <span>{b.hint}</span>
              </button>
            ))}
          </div>
        )}
        </div>
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100, placement: 'top' }}
          shouldShow={({ editor: ed, state }) =>
            !state.selection.empty && ed.isActive('paragraph') && !ed.isActive('pullQuote') && !ed.isActive('aside') && !ed.isActive('figureText')
          }
        >
          <TurnInto editor={editor} />
        </BubbleMenu>
        <EditorContent editor={editor} />
        <button type="button" className="studio-cv__addend" onMouseDown={(e) => e.preventDefault()} onClick={openAtEnd}>
          + Add a block at the end
        </button>
      </div>
    </UploadContext.Provider>
  );
}

/** The nearest block boundary at or after `pos`: drops never split a paragraph (rule 10). */
function boundaryNear(state: Editor['state'], pos: number): number {
  const $pos = state.doc.resolve(pos);
  if ($pos.depth === 0) return pos;
  const after = $pos.after(1);
  const before = $pos.before(1);
  return pos - before < after - pos ? before : after;
}

/** Marks and headings only; blocks come from the "+" at each block's foot. */
function FormatBar({ editor, onAddBlock }: { editor: Editor; onAddBlock: () => void }) {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    editor.on('transaction', force);
    return () => {
      editor.off('transaction', force);
    };
  }, [editor]);
  const btn = (label: React.ReactNode, active: boolean, run: () => void, title?: string) => (
    <button type="button" aria-pressed={active} title={title} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  );
  return (
    <div className="studio-cv__insert" role="toolbar" aria-label="Formatting">
      <button type="button" className="studio-cv__insert-add" onMouseDown={(e) => e.preventDefault()} onClick={onAddBlock} title="Add a block (or type / on an empty line)" aria-label="Add a block">
        +
      </button>
      <span className="studio-cv__insert-sep" />
      {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn('H3', editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      <span className="studio-cv__insert-sep" />
      {btn(<b>B</b>, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn(<i>I</i>, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn(<u>U</u>, editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
      {btn('▮', editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight().run(), 'Highlight')}
      <span className="studio-cv__insert-sep" />
      {btn('“ ”', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote')}
      {btn('• List', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {btn('1. List', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      {btn('Link', editor.isActive('link'), () => {
        const prev = editor.getAttributes('link').href as string | undefined;
        const href = window.prompt('Link to', prev ?? 'https://');
        if (href === null) return;
        if (!href) editor.chain().focus().unsetLink().run();
        else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      })}
    </div>
  );
}

/** "Turn into…": the selection becomes a pull quote (copied), an aside (moved), a picture-with-text (moved beside a picture), or a heading. */
function TurnInto({ editor }: { editor: Editor }) {
  const selectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };
  const afterBlock = () => editor.state.selection.$from.after(1);
  return (
    <div className="studio-cv__turn">
      <span>Turn into</span>
      <button
        type="button"
        onClick={() => {
          const text = selectedText();
          editor.chain().focus().insertContentAt(afterBlock(), { type: 'pullQuote', attrs: { width: 'wide' }, content: [{ type: 'text', text }] }).run();
        }}
      >
        Pull quote
      </button>
      <button
        type="button"
        onClick={() => {
          const text = selectedText();
          editor.chain().focus().deleteSelection().insertContentAt(afterBlock(), { type: 'aside', content: [{ type: 'text', text }] }).run();
        }}
      >
        Aside
      </button>
      <button
        type="button"
        onClick={() => {
          const text = selectedText();
          editor
            .chain()
            .focus()
            .deleteSelection()
            .insertContentAt(afterBlock(), { type: 'figureText', attrs: { side: 'left', share: 45 }, content: [{ type: 'text', text }] })
            .run();
        }}
      >
        Picture with text
      </button>
      <button type="button" onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}>
        Heading
      </button>
    </div>
  );
}
