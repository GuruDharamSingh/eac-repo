"use client";

import { Component, memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Render, type Config } from "@puckeditor/core";
import { ThemeScope } from "./theme-scope";
import { tileData, type Item } from "./model";
import { MockPreview } from "./MockPreview";

// ============================================================================
// One block on the canvas. It mounts its preview only while it is near the
// visible part of the canvas (IntersectionObserver against the scroller), and
// unmounts it again when it is far away, keeping its height so the layout does
// not jump. Hundreds of tiles exist; a handful are drawn.
// ============================================================================

const CARD_W = 400;
const INNER_W = 1200; // blocks are designed full width: draw at 1200 and scale down
const SCALE = CARD_W / INNER_W;
const MAX_H = 300;

function useNear(ref: React.RefObject<HTMLElement | null>, root: HTMLElement | null) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !root) return;
    const io = new IntersectionObserver((es) => setNear(es.some((e) => e.isIntersecting)), { root, rootMargin: "900px 900px 900px 900px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, root]);
  return near;
}

class Boundary extends Component<{ fallback: (message: string) => ReactNode; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error !== null ? this.props.fallback(this.state.error) : this.props.children;
  }
}

function NeedsData({ title, reason, source, unblock }: { title: string; reason: string; source?: string; unblock?: string[] }) {
  return (
    <div className="dev-needs">
      <strong>{title}</strong>
      <p>{reason}</p>
      {source ? <code>{source}</code> : null}
      {unblock && unblock.length ? (
        <ul>
          {unblock.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const APP_ONLY_UNBLOCK = [
  "Export the app's blocks from a workspace package, with no @/ imports",
  "Give each block a sample() so it draws without a database",
  "Ship its stylesheet as a scoped sheet (a wrapper class), not global rules",
];

function Preview({ item, config, edits }: { item: Item; config: Config; edits?: Record<string, unknown> }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(160);
  const data = useMemo(() => (item.block ? tileData(item.block, edits) : null), [item.block, edits]);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(Math.min(MAX_H, Math.max(60, el.offsetHeight * SCALE))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!data) return null;
  return (
    <div className="dev-frame" style={{ height: h }}>
      <div ref={inner} className="dev-inner" style={{ width: INNER_W, transform: `scale(${SCALE})` }}>
        <ThemeScope app={item.entry.app}>
          <Boundary
            key={JSON.stringify(edits ?? null)}
            fallback={(message) => <NeedsData title="Needs data" reason={`It did not draw on its own: ${message}`} source={item.entry.source} unblock={["Feed it rows through a resolver, or give it a sample()"]} />}
          >
            <Render config={config} data={data as never} />
          </Boundary>
        </ThemeScope>
      </div>
    </div>
  );
}

function MockFrame({ item }: { item: Item }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(200);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(Math.min(MAX_H, Math.max(60, el.offsetHeight * SCALE))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!item.mock) return null;
  return (
    <div className="dev-frame dev-frame-mock" style={{ height: h }}>
      <div ref={inner} className="dev-inner" style={{ width: INNER_W, transform: `scale(${SCALE})` }}>
        <Boundary fallback={(message) => <NeedsData title="Mock failed" reason={message} source={item.entry.source} />}>
          <MockPreview itemKey={item.entry.key} app={item.entry.app} entry={item.mock} />
        </Boundary>
      </div>
    </div>
  );
}

function PropsTable({ props }: { props: NonNullable<Item["entry"]["props"]> }) {
  if (props.length === 0) return <p className="dev-props-empty">This block has no props.</p>;
  return (
    <table className="dev-props">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Kind</th>
          <th>Default</th>
        </tr>
      </thead>
      <tbody>
        {props.map((p) => (
          <tr key={p.name}>
            <td title={p.label}>{p.name}</td>
            <td>{p.kind ?? ""}</td>
            <td>{p.default === undefined ? "" : typeof p.default === "string" ? p.default || '""' : JSON.stringify(p.default)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const Tile = memo(function Tile({ item, config, root, edits, versions, selected, onOpen }: { item: Item; config: Config | null; root: HTMLElement | null; edits?: Record<string, unknown>; versions?: number; selected: boolean; onOpen(key: string): void }) {
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref, root);
  const e = item.entry;
  const live = Boolean(item.block && config);
  const mock = !live ? item.mock : undefined;
  const [showProps, setShowProps] = useState(false);
  return (
    <article
      ref={ref}
      className={`dev-tile${selected ? " is-selected" : ""}${live || mock ? "" : " is-off"}`}
      style={{ width: CARD_W }}
      data-block={e.key}
    >
      <header>
        <span className="dev-tile-name">{e.label}</span>
        <span className="dev-tile-id">{e.id}</span>
        {edits ? <span className="dev-chip dev-chip-edit">edited</span> : null}
        {versions ? (
          <span className="dev-chip" style={{ borderColor: "#0f766e", color: "#5eead4" }} title="Saved versions of this block: open the sandbox and press History.">
            {versions} saved version{versions === 1 ? "" : "s"}
          </span>
        ) : null}
        {mock ? (
          <span className="dev-chip dev-chip-mock" title={mock.note ?? "Not the live block: invented sample content."}>
            {mock.kind === "real" ? "Mock: real component" : "Mock: static copy"}
          </span>
        ) : null}
        {e.dataDriven && !mock ? <span className="dev-chip">sample data</span> : null}
        {e.parts && e.parts.length ? <span className="dev-chip">{e.parts.length} parts</span> : null}
      </header>
      <div className="dev-tile-body">
        {live ? (
          near ? (
            <Preview item={item} config={config as Config} edits={edits} />
          ) : (
            <div className="dev-frame dev-frame-idle" style={{ height: 160 }} />
          )
        ) : mock ? (
          near ? (
            <MockFrame item={item} />
          ) : (
            <div className="dev-frame dev-frame-idle" style={{ height: 160 }} />
          )
        ) : (
          <NeedsData title={item.block ? "Loading" : "App-only / needs data"} reason={item.why ?? "Not loaded yet."} source={e.source} unblock={item.block ? undefined : APP_ONLY_UNBLOCK} />
        )}
      </div>
      {e.description ? <p className="dev-tile-desc">{e.description}</p> : null}
      {mock?.note ? <p className="dev-mock-note">{mock.note}</p> : null}
      <footer>
        {mock ? (
          <button type="button" onClick={() => setShowProps((v) => !v)}>
            {showProps ? "Hide props" : `Props (read-only${e.props ? `, ${e.props.length}` : ""})`}
          </button>
        ) : (
          <button type="button" disabled={!live} onClick={() => onOpen(e.key)}>
            {live ? "Edit in sandbox" : "Cannot edit here"}
          </button>
        )}
        {mock && showProps ? <PropsTable props={e.props ?? []} /> : null}
      </footer>
    </article>
  );
});
