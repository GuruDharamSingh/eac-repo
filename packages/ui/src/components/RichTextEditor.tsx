'use client';

import { RichTextEditor as MantineRTE } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Youtube from '@tiptap/extension-youtube';
import { common, createLowlight } from 'lowlight';
import { useEffect, useCallback } from 'react';
import { ActionIcon, Tooltip, Menu } from '@mantine/core';
import { ImagePlus, Table as TableIcon, Youtube as YoutubeIcon, Type } from 'lucide-react';

const lowlight = createLowlight(common);

/** Lightweight font-size mark built on top of TextStyle. */
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

const FONT_SIZES: { label: string; value: string | null }[] = [
  { label: 'Small', value: '0.85rem' },
  { label: 'Normal', value: null },
  { label: 'Large', value: '1.35rem' },
  { label: 'Huge', value: '1.75rem' },
];

export interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** When true, shows a compact toolbar without image/code block/table controls */
  minimal?: boolean;
  /**
   * When true, shows a tasteful reduced toolbar suited to short comment/reflection
   * boxes: bold, italic, underline, blockquote, lists, link. Implies `minimal`.
   */
  compact?: boolean;
  /** Minimum height of the editing area in pixels. Defaults to 320 (120 when compact). */
  minHeight?: number;
}

const HIGHLIGHT_COLORS = [
  '#25262b', '#868e96', '#fa5252', '#e64980', '#be4bdb',
  '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886',
  '#40c057', '#82c91e', '#fab005', '#fd7e14',
];

export function RichTextEditor({
  content,
  onChange,
  placeholder: placeholderText,
  minimal = false,
  compact = false,
  minHeight,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Image.configure({
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto;',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        HTMLAttributes: {
          class: 'w-full aspect-video rounded-md',
        },
      }),
      ...(placeholderText
        ? [Placeholder.configure({ placeholder: placeholderText })]
        : []),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  // Update editor when content changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter YouTube URL');
    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
        width: 640,
        height: 480,
      });
    }
  }, [editor]);

  const setFontSize = useCallback(
    (size: string | null) => {
      if (!editor) return;
      const chain = editor.chain().focus() as unknown as {
        setMark: (name: string, attrs: Record<string, unknown>) => typeof chain;
        run: () => boolean;
      };
      chain.setMark('textStyle', { fontSize: size }).run();
    },
    [editor],
  );

  const resolvedMinHeight = minHeight ?? (compact ? 120 : 320);

  if (compact) {
    return (
      <MantineRTE editor={editor}>
        <MantineRTE.Toolbar>
          <MantineRTE.ControlsGroup>
            <MantineRTE.Bold />
            <MantineRTE.Italic />
            <MantineRTE.Underline />
          </MantineRTE.ControlsGroup>

          <MantineRTE.ControlsGroup>
            <MantineRTE.BulletList />
            <MantineRTE.OrderedList />
            <MantineRTE.Blockquote />
          </MantineRTE.ControlsGroup>

          <MantineRTE.ControlsGroup>
            <Menu shadow="md" width={140} position="bottom-start" withinPortal>
              <Menu.Target>
                <Tooltip label="Font size">
                  <ActionIcon variant="subtle" size="sm" aria-label="Font size">
                    <Type size={15} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                {FONT_SIZES.map((s) => (
                  <Menu.Item key={s.label} onClick={() => setFontSize(s.value)}>
                    {s.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <MantineRTE.ColorPicker colors={HIGHLIGHT_COLORS} />
          </MantineRTE.ControlsGroup>

          <MantineRTE.ControlsGroup>
            <MantineRTE.Link />
          </MantineRTE.ControlsGroup>

          <MantineRTE.ControlsGroup>
            <MantineRTE.Undo />
            <MantineRTE.Redo />
          </MantineRTE.ControlsGroup>
        </MantineRTE.Toolbar>

        <MantineRTE.Content style={{ minHeight: resolvedMinHeight }} />
      </MantineRTE>
    );
  }

  return (
    <MantineRTE editor={editor}>
      <MantineRTE.Toolbar>
        <MantineRTE.ControlsGroup>
          <MantineRTE.Bold />
          <MantineRTE.Italic />
          <MantineRTE.Underline />
          <MantineRTE.Strikethrough />
          <MantineRTE.ClearFormatting />
        </MantineRTE.ControlsGroup>

        <MantineRTE.ControlsGroup>
          <MantineRTE.H1 />
          <MantineRTE.H2 />
          <MantineRTE.H3 />
        </MantineRTE.ControlsGroup>

        <MantineRTE.ControlsGroup>
          <MantineRTE.Blockquote />
          <MantineRTE.Hr />
          <MantineRTE.BulletList />
          <MantineRTE.OrderedList />
        </MantineRTE.ControlsGroup>

        <MantineRTE.ControlsGroup>
          <MantineRTE.Link />
          <MantineRTE.Unlink />
        </MantineRTE.ControlsGroup>

        {/* Alignment */}
        <MantineRTE.ControlsGroup>
          <MantineRTE.AlignLeft />
          <MantineRTE.AlignCenter />
          <MantineRTE.AlignRight />
          <MantineRTE.AlignJustify />
        </MantineRTE.ControlsGroup>

        {/* Color & Highlight */}
        <MantineRTE.ControlsGroup>
          <MantineRTE.ColorPicker colors={HIGHLIGHT_COLORS} />
          <MantineRTE.UnsetColor />
          <MantineRTE.Highlight />
        </MantineRTE.ControlsGroup>

        {/* Media & Advanced — hidden in minimal mode */}
        {!minimal && (
          <MantineRTE.ControlsGroup>
            <Tooltip label="Insert image">
              <ActionIcon
                variant="default"
                size="sm"
                onClick={insertImage}
              >
                <ImagePlus size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Insert Table">
              <ActionIcon
                variant="default"
                size="sm"
                onClick={insertTable}
              >
                <TableIcon size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Insert YouTube">
              <ActionIcon
                variant="default"
                size="sm"
                onClick={insertYoutube}
              >
                <YoutubeIcon size={14} />
              </ActionIcon>
            </Tooltip>
            <MantineRTE.CodeBlock />
          </MantineRTE.ControlsGroup>
        )}

        <MantineRTE.ControlsGroup>
          <MantineRTE.Undo />
          <MantineRTE.Redo />
        </MantineRTE.ControlsGroup>
      </MantineRTE.Toolbar>

      <MantineRTE.Content style={{ minHeight: resolvedMinHeight }} />
    </MantineRTE>
  );
}
