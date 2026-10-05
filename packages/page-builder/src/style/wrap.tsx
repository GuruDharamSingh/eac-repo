import type { CSSProperties, ReactNode } from "react";
import { STYLE_SHEET, cleanStyle, styleToCss } from "./schema";

// ============================================================================
// The published half of "Style": wraps one block in a <div> carrying its
// settings. Server-safe (no hooks, no DOM) because it runs on the public page
// and in the editor's canvas alike.
//
// A block with nothing set renders exactly as it did before this existed, with
// no wrapper, so turning the feature on changed no saved page.
// ============================================================================

export function BlockStyleWrap({
  settings,
  editing = false,
  children,
}: {
  settings: unknown;
  /** True inside the editor: a block hidden by screen size is dimmed there, not removed, so it can still be selected. */
  editing?: boolean;
  children?: ReactNode;
}) {
  const s = cleanStyle(settings);
  if (!s) return <>{children}</>;
  const { style, attrs, id, className } = styleToCss(s);
  return (
    <div
      id={id}
      className={className ? `blk-st ${className}` : "blk-st"}
      style={style as CSSProperties}
      {...attrs}
      {...(editing ? { "data-editing": "" } : {})}
    >
      {children}
      {/* React 19 hoists this to <head> once per document; the iframe canvas included. */}
      <style href="blk-style" precedence="default">
        {STYLE_SHEET}
      </style>
    </div>
  );
}
