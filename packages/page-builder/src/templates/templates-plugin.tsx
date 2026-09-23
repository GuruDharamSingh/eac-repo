"use client";

import { useState } from "react";
import { useGetPuck, type Data, type Plugin } from "@puckeditor/core";
import type { PageTemplate, TemplateNode } from "@elkdonis/blocks";

// ============================================================================
// A "Templates" tab for the editor's left rail.
//
// Picking one puts the template's blocks on the canvas — ordinary blocks,
// every one editable, movable and deletable afterwards. It replaces what is
// there (after asking, if anything is), and Puck's undo brings the old page
// back. Nothing is saved until Publish, as with any other edit.
//
// Every node gets a fresh id: a template is applied more than once across
// pages and people, and two nodes sharing an id break Puck's selection and
// drag. Data-driven blocks are then asked to fetch, so a store shelf shows the
// person's real pieces straight away instead of waiting for a field change.
// ============================================================================

function freshId(type: string): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${type}-${rand}`;
}

/** Copy a template's nodes with new ids, collecting every id on the way. */
function instantiate(nodes: TemplateNode[], ids: string[]): Data["content"] {
  return nodes.map((node) => {
    const id = freshId(node.type);
    ids.push(id);
    const props: Record<string, unknown> = { ...node.props, id };
    // Slots hold arrays of nodes inside a block's props.
    for (const [key, value] of Object.entries(props)) {
      if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && "type" in v && "props" in v)) {
        props[key] = instantiate(value as TemplateNode[], ids);
      }
    }
    return { type: node.type, props } as Data["content"][number];
  });
}

function Thumb({ t }: { t: PageTemplate }) {
  const { ground, ink, accent } = t.swatch;
  return (
    <svg viewBox="0 0 120 64" width="100%" aria-hidden="true" style={{ display: "block", borderRadius: 6 }}>
      <rect width="120" height="64" fill={ground} />
      <rect x="10" y="9" width="46" height="6" rx="1.5" fill={ink} />
      <rect x="10" y="18" width="28" height="3" rx="1.5" fill={accent} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={10 + i * 35} y="28" width="30" height="28" rx="2" fill={ink} opacity={0.22 + i * 0.12} />
      ))}
    </svg>
  );
}

function TemplatesPanel({ templates }: { templates: PageTemplate[] }) {
  const getPuck = useGetPuck();
  const [applied, setApplied] = useState<string | null>(null);

  const apply = (t: PageTemplate) => {
    const puck = getPuck();
    const current = puck.appState.data;
    if (
      current.content.length > 0 &&
      !window.confirm(`Replace what is on the canvas with “${t.name}”? Undo brings it back.`)
    ) {
      return;
    }
    const ids: string[] = [];
    const content = instantiate(t.content, ids);
    puck.dispatch({
      type: "setData",
      data: { ...current, content, zones: {} } as Data,
    });
    // Let the new nodes land in the store before asking them to fetch.
    window.setTimeout(() => {
      for (const id of ids) getPuck().resolveDataById(id, "force");
    }, 0);
    setApplied(t.id);
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, fontFamily: "var(--puck-font-family, system-ui)" }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--puck-color-text-secondary, #404040)" }}>
        Start from a design. Every part stays editable — change colours, words and cards, or drag blocks in and
        out.
      </p>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => apply(t)}
          style={{
            display: "grid",
            gap: 6,
            padding: 10,
            textAlign: "left",
            cursor: "pointer",
            border: `1px solid ${applied === t.id ? "var(--puck-color-azure-04, #0158ad)" : "var(--puck-color-grey-09, #dcdcdc)"}`,
            borderRadius: 8,
            background: "var(--puck-color-white, #fff)",
            color: "var(--puck-color-black, #000)",
            font: "inherit",
          }}
        >
          <Thumb t={t} />
          <strong style={{ fontSize: 14 }}>{t.name}</strong>
          <span style={{ fontSize: 12, lineHeight: 1.4, color: "#404040" }}>{t.description}</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5a5a5a" }}>
            Cards: {t.cards}
          </span>
        </button>
      ))}
    </div>
  );
}

const ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z" />
  </svg>
);

/** The Templates tab, for `PuckEditor`'s `plugins`. */
export function templatesPlugin(templates: PageTemplate[], label = "Templates"): Plugin {
  return {
    name: "eac-templates",
    label,
    icon: ICON,
    render: () => <TemplatesPanel templates={templates} />,
  };
}
