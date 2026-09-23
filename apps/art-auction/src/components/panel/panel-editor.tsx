"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Data, Plugin, Viewports } from "@puckeditor/core";
import { PuckEditor, templatesPlugin } from "@elkdonis/page-builder";
import { STORE_TEMPLATES } from "@elkdonis/blocks";
import { storePanelConfig } from "@/lib/store-panel/config.client";
import { saveStorePanel, submitStorePanel } from "@/lib/store-panel/actions";

// ============================================================================
// The store panel editor's chrome: the fixed square viewport, a Pages tab
// (switch between store:1, store:2, …) and a Submit tab (the org's own
// moderation, separate from Puck's own "Publish" button — which here only
// SAVES a draft; see the tab's own note for why the two are not the same
// action).
// ============================================================================

/**
 * The real box this panel renders inside, on an org's page. Puck's default
 * phone/tablet/desktop switcher would let someone design at 1200px wide and
 * discover only later that the host squeezes it into a fraction of that —
 * this makes the editor's canvas BE the space, from the first drop.
 */
const PANEL_VIEWPORTS: Viewports = [{ width: 720, height: 720, label: "Store panel" }];

export interface PanelEditorProps {
  orgId: string;
  orgName: string;
  orgHostsPanels: boolean;
  pageKey: string;
  pageNum: number;
  initial: Data;
  status: string;
  pages: Array<{ key: string; status: string; updatedAt: string }>;
}

function PagesTab({ orgId, pageNum, pages }: { orgId: string; pageNum: number; pages: PanelEditorProps["pages"] }) {
  const router = useRouter();
  // "store:N" -> N, defaulting anything unparseable to the end of the list —
  // a page never disappears from the tab for having an odd key.
  const nums = pages
    .map((p) => Number(p.key.split(":")[1]))
    .filter((n) => Number.isFinite(n));
  const maxKnown = nums.length ? Math.max(...nums) : 0;
  const nextNew = Math.max(pageNum, maxKnown) + 1;

  return (
    <div style={{ padding: "1rem", display: "grid", gap: ".5rem" }}>
      <p style={{ fontSize: ".85rem", opacity: 0.8, margin: 0 }}>Pages of your panel on {orgId}.</p>
      {pages.length === 0 ? <p style={{ fontStyle: "italic", fontSize: ".85rem" }}>No pages yet.</p> : null}
      {pages.map((p) => {
        const n = Number(p.key.split(":")[1]) || 1;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => router.push(`?page=${n}`)}
            style={{
              textAlign: "left",
              padding: ".5rem .75rem",
              border: "1px solid var(--border, #ddd)",
              borderRadius: 6,
              background: n === pageNum ? "var(--muted, #f2f2f2)" : "transparent",
              fontWeight: n === pageNum ? 600 : 400,
            }}
          >
            Page {n} <span style={{ opacity: 0.6, fontSize: ".75rem" }}>— {p.status}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => router.push(`?page=${nextNew}`)}
        style={{ padding: ".5rem .75rem", borderRadius: 6, border: "1px dashed var(--border, #ccc)" }}
      >
        + New page
      </button>
    </div>
  );
}

function SubmitTab({ orgId, orgName, orgHostsPanels, pageKey, status }: PanelEditorProps) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!orgHostsPanels) {
    return (
      <div style={{ padding: "1rem", fontSize: ".85rem" }}>
        <p>
          {orgName} does not currently host designed store panels. You can still design and save one here —
          it stays private to you until they turn this on.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", display: "grid", gap: ".6rem", fontSize: ".85rem" }}>
      <p style={{ margin: 0 }}>
        Status: <strong>{status}</strong>
      </p>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Saving (the header's Publish button) never goes live on its own — every panel is reviewed by{" "}
        {orgName} before it appears there. Submit it here when you are ready for them to look.
      </p>
      <button
        type="button"
        disabled={pending || status === "pending"}
        onClick={() =>
          start(async () => {
            const res = await submitStorePanel(orgId, pageKey);
            setMsg(res.ok ? "Submitted for review." : res.error ?? "Could not submit.");
          })
        }
        style={{ padding: ".5rem .75rem", borderRadius: 6 }}
      >
        {status === "pending" ? "Already submitted" : "Submit for review"}
      </button>
      {msg ? <p style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}

export function PanelEditor(props: PanelEditorProps) {
  const { orgId, pageKey, pageNum, initial, pages } = props;

  const onPublish = useCallback(
    (slug: string, data: Data) => saveStorePanel(orgId, slug, data),
    [orgId]
  );

  const plugins = useMemo<Plugin[]>(
    () => [
      // Four starting designs — see packages/blocks/src/templates/store.ts.
      templatesPlugin(STORE_TEMPLATES),
      {
        name: "panel-pages",
        label: "Pages",
        render: () => <PagesTab orgId={orgId} pageNum={pageNum} pages={pages} />,
      },
      {
        name: "panel-submit",
        label: "Submit",
        render: () => <SubmitTab {...props} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, pageNum, pages, props.status, props.orgHostsPanels]
  );

  return (
    <PuckEditor
      slug={pageKey}
      initial={initial}
      config={storePanelConfig}
      orgId={orgId}
      onPublish={onPublish}
      plugins={plugins}
      viewports={PANEL_VIEWPORTS}
      title={`Store panel — page ${pageNum}`}
    />
  );
}
