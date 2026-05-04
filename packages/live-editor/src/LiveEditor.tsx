"use client";

import { useState } from "react";
import { EditOverlay } from "./EditOverlay";
import { CssPanel } from "./CssPanel";
import type { FieldDef, CssVarDef, SaveFieldPayload, SaveResult } from "./types";

export interface LiveEditorProps {
  fields: FieldDef[];
  cssVars?: CssVarDef[];
  cssOverrides?: Record<string, string>;
  onSaveField: (payload: SaveFieldPayload) => Promise<SaveResult>;
  onSaveCss?: (overrides: Record<string, string>) => Promise<SaveResult>;
  /** Link to the full (non-live) editor for this content */
  fullEditorUrl?: string;
  /** Role badge shown in the control bar, e.g. "Owner" or "Admin" */
  role?: string;
}

/**
 * Template-agnostic live field editor.
 *
 * Renders a fixed control bar, an edit-pin overlay (when active) that scans
 * the DOM for [data-trait] elements and matches them against the provided
 * FieldDef list, and an optional CSS custom property panel.
 *
 * No knowledge of any specific template, data model, or database table.
 * The host app supplies field definitions (with initial values) and async
 * save callbacks.
 */
export function LiveEditor({
  fields,
  cssVars = [],
  cssOverrides = {},
  onSaveField,
  onSaveCss,
  fullEditorUrl,
  role = "Owner",
}: LiveEditorProps) {
  const [editMode, setEditMode] = useState(false);
  const [cssPanel, setCssPanel] = useState(false);

  const hasCssVars = cssVars.length > 0 && !!onSaveCss;

  function toggleEdit() {
    setEditMode((m) => {
      if (m) setCssPanel(false); // close CSS panel when exiting edit mode
      return !m;
    });
  }

  return (
    <>
      {/* ── Control bar ── */}
      <div style={barStyle}>
        <span style={roleChipStyle}>{role}</span>

        <div style={dividerStyle} />

        <button type="button" onClick={toggleEdit} style={editBtnStyle(editMode)}>
          {editMode ? "✏ Editing" : "✏ Live Edit"}
        </button>

        {editMode && hasCssVars && (
          <button type="button" onClick={() => setCssPanel((p) => !p)} style={stylesBtnStyle(cssPanel)}>
            Styles
          </button>
        )}

        {fullEditorUrl && (
          <>
            <div style={dividerStyle} />
            <ExternalLink href={fullEditorUrl}>Full editor →</ExternalLink>
          </>
        )}
      </div>

      {/* ── Edit-pin overlay ── */}
      {editMode && (
        <EditOverlay fields={fields} onSaveField={onSaveField} />
      )}

      {/* ── CSS panel ── */}
      {cssPanel && onSaveCss && (
        <CssPanel
          cssVars={cssVars}
          initialOverrides={cssOverrides}
          onSave={onSaveCss}
          onClose={() => setCssPanel(false)}
        />
      )}
    </>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        color: "rgba(255,255,255,0.55)",
        textDecoration: "none",
        fontSize: 11,
        padding: "4px 6px",
        borderRadius: 5,
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.9)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)"; }}
    >
      {children}
    </a>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  zIndex: 9998,
  display: "flex",
  gap: 4,
  alignItems: "center",
  background: "rgba(15,23,42,0.92)",
  backdropFilter: "blur(10px)",
  borderRadius: 8,
  padding: "6px 10px",
  border: "0.5px solid rgba(255,255,255,0.14)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  color: "rgba(255,255,255,0.8)",
  userSelect: "none",
};

const roleChipStyle: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(255,255,255,0.4)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "0 4px",
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 14,
  background: "rgba(255,255,255,0.2)",
  margin: "0 2px",
};

function editBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(99,102,241,0.85)" : "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 5,
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.02em",
    transition: "background 0.15s",
  };
}

function stylesBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 5,
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  };
}
