"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";

import { cn } from "./cn";

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
  className?: string;
};

/**
 * A small Tiptap rich-text editor styled to match the shadcn input/textarea
 * aesthetic. Stores HTML strings — easy to render server-side without a
 * runtime dependency on Tiptap. Sanitize the HTML on the server before
 * persisting (e.g. sanitizeRichText from @elkdonis/utils).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 160,
  ariaLabel = "Rich text editor",
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing…",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: cn(
          "tiptap-content prose prose-sm max-w-none focus:outline-none",
          "prose-headings:font-serif prose-p:my-2 prose-li:my-1",
          "prose-a:text-primary prose-strong:text-foreground",
          "dark:prose-invert"
        ),
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    immediatelyRender: false,
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (current !== incoming && incoming !== "<p></p>") {
      editor.commands.setContent(incoming, false);
    }
  }, [value, editor]);

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-transparent shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50",
        className
      )}
    >
      <Toolbar editor={editor} />
      <div
        className="px-3 py-2 text-sm"
        style={{ minHeight }}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="h-9 border-b border-input bg-muted/30" />;
  }
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/30 px-2 py-1">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Heading 3"
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Quote"
      >
        “”
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        •
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered list"
      >
        1.
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as
            | string
            | undefined;
          const url = window.prompt("Link URL", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        }}
        label="Link"
      >
        ↗
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        label="Clear formatting"
      >
        ⌫
      </ToolbarButton>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs",
        "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}
