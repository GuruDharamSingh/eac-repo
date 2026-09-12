"use client";

import * as React from "react";
import type {
  SurfaceAction,
  SurfaceCenterLayout,
  SurfaceCenterLayoutShape,
  SurfaceDescriptor,
} from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";

// ============================================================================
// Arrange the center.
//
// An org's owner or guide decides which sections its center shows, in what
// order, and with which knobs. What they save is the org's row over the
// network default; a platform admin can save the network default itself
// (the row under `elkdonis`) from the same surface. Two lists, a few
// selects, Save. No drag-and-drop: up/down/hide reads fine on a phone and
// needs no library.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "centerLayout" }>;

const SELECT =
  "rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] px-2 py-1 text-[0.9rem] text-[color:var(--sf-fg)]";
const LABEL =
  "block font-[family-name:var(--sf-font-record)] text-[0.64rem] uppercase tracking-[0.14em] text-[color:var(--sf-muted)] mb-1";
const SMALL = "eac-btn eac-btn--quiet !px-2 !py-0.5 text-xs";

export function CenterLayoutSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors } = useSurface();
  const layer = useLayer();

  const [data, setData] = React.useState<SurfaceCenterLayout | null>(null);
  const [draft, setDraft] = React.useState<SurfaceCenterLayoutShape | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [target, setTarget] = React.useState<"org" | "network">("org");
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");

  const load = React.useCallback(async () => {
    if (!connectors.centerLayout) {
      setState("missing");
      return;
    }
    setState("loading");
    try {
      const d = await connectors.centerLayout.load(descriptor.orgId);
      if (!d) {
        setState("missing");
        return;
      }
      setData(d);
      setDraft(structuredClone(d.resolved));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [connectors, descriptor.orgId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    layer.setMeta({ title: data ? `Arrange ${data.orgName}'s center` : "Arrange the center", kind: "neutral", size: "wide" });
  }, [layer, data]);

  if (state !== "ready" || !data || !draft) {
    return (
      <SurfaceFrame kind="neutral" title="Arrange the center" kicker="Center · definition">
        {state === "loading" && <SurfaceSkeleton block />}
        {state === "missing" && (
          <p className="eac-surface-empty">
            {connectors.centerLayout ? "Nothing to arrange here." : "This site cannot arrange centers yet."}
          </p>
        )}
        {state === "error" && (
          <p className="eac-surface-empty">
            Could not load it.{" "}
            <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
      </SurfaceFrame>
    );
  }

  const label = (id: string) => data.sections.find((s) => s.id === id)?.label ?? id;
  const placed = new Set([...draft.columns.left, ...draft.columns.right]);
  const unplaced = data.sections.map((s) => s.id).filter((id) => !placed.has(id));

  const setCol = (side: "left" | "right", ids: string[]) =>
    setDraft((d) => (d ? { ...d, columns: { ...d.columns, [side]: ids } } : d));
  const move = (side: "left" | "right", i: number, dir: -1 | 1) => {
    const ids = [...draft.columns[side]];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    setCol(side, ids);
  };
  const remove = (side: "left" | "right", i: number) =>
    setCol(side, draft.columns[side].filter((_, k) => k !== i));
  const add = (side: "left" | "right", id: string) => setCol(side, [...draft.columns[side], id]);
  const toggleHidden = (id: string) =>
    setDraft((d) =>
      d ? { ...d, hidden: d.hidden.includes(id) ? d.hidden.filter((x) => x !== id) : [...d.hidden, id] } : d
    );
  const setLimit = (key: "feed" | "network" | "pinned", v: string) =>
    setDraft((d) => (d ? { ...d, options: { ...d.options, [key]: { limit: Math.max(1, Math.min(50, Number(v) || 1)) } } } : d));

  async function save() {
    if (!connectors.centerLayout || !draft) return;
    const orgId = target === "network" && data!.networkOrgId ? data!.networkOrgId : data!.orgId;
    setSaving(true);
    setNotice(null);
    const r = await connectors.centerLayout.save(orgId, draft);
    setSaving(false);
    if (r.ok === false) {
      setTone("error");
      setNotice(r.error);
      return;
    }
    setTone("normal");
    setNotice(target === "network" ? "Saved as the network default" : `Saved for ${data!.orgName}`);
    connectors.onMutated?.();
  }

  const actions: SurfaceAction[] = data.canEdit
    ? [{ label: saving ? "Saving…" : "Save", primary: true, disabled: saving, onClick: save }]
    : [];

  const column = (side: "left" | "right", title: string) => (
    <div className="grid gap-2">
      <span className={LABEL}>{title}</span>
      <ol className="grid gap-1.5">
        {draft.columns[side].map((id, i) => {
          const hidden = draft.hidden.includes(id);
          return (
            <li
              key={id}
              className={`flex items-center gap-2 rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)] px-2 py-1.5 ${hidden ? "opacity-50" : ""}`}
            >
              <span className="flex-1 text-[0.92rem]">{label(id)}</span>
              {data.canEdit && (
                <>
                  <button type="button" className={SMALL} aria-label="Move up" onClick={() => move(side, i, -1)}>↑</button>
                  <button type="button" className={SMALL} aria-label="Move down" onClick={() => move(side, i, 1)}>↓</button>
                  <button type="button" className={SMALL} onClick={() => toggleHidden(id)}>{hidden ? "Show" : "Hide"}</button>
                  <button type="button" className={SMALL} aria-label="Remove" onClick={() => remove(side, i)}>×</button>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {data.canEdit && unplaced.length > 0 && (
        <select
          className={SELECT}
          value=""
          onChange={(e) => e.target.value && add(side, e.target.value)}
          aria-label={`Add a section to the ${title}`}
        >
          <option value="">+ Add a section…</option>
          {unplaced.map((id) => (
            <option key={id} value={id}>{label(id)}</option>
          ))}
        </select>
      )}
    </div>
  );

  const rail = (
    <div className="grid gap-3 text-[0.9rem]">
      <p className="m-0 text-[color:var(--sf-muted)]">
        This is what {data.orgName}&rsquo;s center shows, over the network&rsquo;s default. Sections you
        remove or hide are simply not drawn.
      </p>
      {data.networkOrgId && (
        <label className="flex items-center gap-2">
          <input type="radio" name="target" checked={target === "org"} onChange={() => setTarget("org")} />
          Save for {data.orgName}
        </label>
      )}
      {data.networkOrgId && (
        <label className="flex items-center gap-2">
          <input type="radio" name="target" checked={target === "network"} onChange={() => setTarget("network")} />
          Save as the network default
        </label>
      )}
    </div>
  );

  return (
    <SurfaceFrame
      kind="neutral"
      title={`Arrange ${data.orgName}'s center`}
      kicker="Center · definition"
      rail={rail}
      actions={actions}
      status={notice}
      statusTone={tone}
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {column("left", "Your column")}
          {column("right", "The org's column")}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className={LABEL}>Site view</span>
            <select
              className={SELECT}
              value={draft.options.site?.ratio ?? "5:3"}
              disabled={!data.canEdit}
              onChange={(e) => setDraft((d) => (d ? { ...d, options: { ...d.options, site: { ratio: e.target.value as "5:3" | "4:3" } } } : d))}
            >
              <option value="5:3">Wide (5:3)</option>
              <option value="4:3">Taller (4:3)</option>
            </select>
          </label>
          <label>
            <span className={LABEL}>Voice</span>
            <select
              className={SELECT}
              value={draft.voice}
              disabled={!data.canEdit}
              onChange={(e) => setDraft((d) => (d ? { ...d, voice: e.target.value as SurfaceCenterLayoutShape["voice"] } : d))}
            >
              <option value="journal">Journal</option>
              <option value="gazette">Gazette</option>
              <option value="quiet">Quiet</option>
            </select>
          </label>
          <label>
            <span className={LABEL}>Feed rows</span>
            <input type="number" min={1} max={50} className={SELECT} disabled={!data.canEdit} value={draft.options.feed?.limit ?? 12} onChange={(e) => setLimit("feed", e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>Network items</span>
            <input type="number" min={1} max={50} className={SELECT} disabled={!data.canEdit} value={draft.options.network?.limit ?? 12} onChange={(e) => setLimit("network", e.target.value)} />
          </label>
        </div>
      </div>
    </SurfaceFrame>
  );
}
