"use client";

import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Render, type Config } from "@puckeditor/core";
import type { Block } from "@elkdonis/blocks";
import { nodeProps } from "@/components/blocks/model";
import { mockFor, type MockEntry } from "@/registry/mocks";
import type { SiteBlockRef, SitePage, ThemeSite } from "@/themes/types";

// ============================================================================
// The right side of /themes: a mock of one site page.
//
//   frame   the site's header and footer markup (copied from its
//           components/site-header.tsx / site-footer.tsx, class names and
//           data-chrome / data-part kept), with an empty slot for the page;
//   css     the site's own stylesheets, scoped under [data-mock-app="theme-<id>"]
//           (scripts/scope-site-css.py), media queries turned into container
//           queries so the phone / desktop width toggle really restyles them;
//   blocks  the blocks the site really uses on this page, in order:
//             shared / box blocks   the real block through Puck's Render, with its own sample rows;
//             app-local blocks      the mock tiles M1 / M2 wrote (real component or static copy);
//             code-drawn sections   a markup snippet kept in site-pages.json;
//             anything else         a labelled placeholder.
// The draft's values go on the wrapper (and on each mock's own wrapper, which
// re-declares its tokens) as inline custom properties, so they win.
// ============================================================================

export interface BlocksCtx {
  loaded: Map<string, { block: Block<never>; app: string }>;
  config: Config | null;
  catalog: Map<string, { label: string; app: string; description?: string }>;
}

class Boundary extends Component<{ fallback: (m: string) => ReactNode; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error !== null ? this.props.fallback(this.state.error) : this.props.children;
  }
}

function Placeholder({ title, why }: { title: string; why: string }) {
  return (
    <div className="tp-placeholder">
      <strong>{title}</strong>
      <span>{why}</span>
    </div>
  );
}

const mockCache = new Map<string, ComponentType>();
function MockBox({ itemKey, app, entry, style }: { itemKey: string; app: string; entry: MockEntry; style: CSSProperties }) {
  const Mock = useMemo(() => {
    let c = mockCache.get(itemKey);
    if (!c) {
      c = lazy(entry.load);
      mockCache.set(itemKey, c);
    }
    return c;
  }, [itemKey, entry]);
  return (
    <div data-mock-app={entry.scope ?? app} data-mock-kind={entry.kind} className="dev-mock-scope" style={style}>
      <Suspense fallback={<div className="tp-loading">Loading mock...</div>}>
        <Mock />
      </Suspense>
    </div>
  );
}

function BlockView({ blockRef, index, site, ctx, style }: { blockRef: SiteBlockRef; index: number; site: ThemeSite; ctx: BlocksCtx; style: CSSProperties }) {
  const id = blockRef.id;
  if (blockRef.kind === "html") return <div className="tp-snippet" data-tp-block={id} dangerouslySetInnerHTML={{ __html: blockRef.html ?? "" }} />;
  const hit = ctx.loaded.get(id);
  if (hit && ctx.config) {
    const data = { root: { props: {} }, content: [{ type: id, props: { ...nodeProps(hit.block), id: `tp-${index}-${id}` } }] };
    return (
      <div data-tp-block={id}>
        <Boundary fallback={(m) => <Placeholder title={id} why={`Needs data it does not have in the sandbox: ${m}`} />}>
          <Render config={ctx.config} data={data as never} />
        </Boundary>
      </div>
    );
  }
  const mock = mockFor(site.id, id);
  if (mock) {
    return (
      <div data-tp-block={id}>
        <Boundary fallback={(m) => <Placeholder title={id} why={`The mock failed: ${m}`} />}>
          <MockBox itemKey={`${site.id}:${id}`} app={site.id} entry={mock} style={style} />
        </Boundary>
      </div>
    );
  }
  const info = ctx.catalog.get(`${site.id}:${id}`) ?? ctx.catalog.get(`shared:${id}`);
  return <Placeholder title={info?.label ?? id} why={ctx.loaded.size ? `Block "${id}" is not drawn in this app yet (no live import, no mock).` : "Loading blocks..."} />;
}

export function SitePreview({ site, page, overrides, width, zoom, ctx, caption }: { site: ThemeSite; page: SitePage; overrides: Record<string, string>; width: number; zoom: number; ctx: BlocksCtx; caption?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(frameRef.current?.querySelector<HTMLElement>("[data-tp-slot]") ?? null);
  }, [site.id, site.frame]);
  const style = overrides as CSSProperties;
  const cssText = useMemo(() => site.css, [site.css]);
  const outer: CSSProperties = { width, zoom };
  return (
    <figure className="tp-device" data-narrow={width < 600 ? "true" : "false"}>
      {caption ? <figcaption>{caption}</figcaption> : null}
      <div className="tp-frame" style={outer}>
        <style>{cssText}</style>
        <div
          className="tp-site"
          data-mock-app={`theme-${site.id}`}
          style={style}
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a,button,summary")) e.preventDefault();
          }}
        >
          <div ref={frameRef} className="tp-chrome" dangerouslySetInnerHTML={{ __html: site.frame }} />
          {slot
            ? createPortal(
                page.blocks.length ? page.blocks.map((b, i) => <BlockView key={`${i}-${b.id}`} blockRef={b} index={i} site={site} ctx={ctx} style={style} />) : <Placeholder title="No blocks recorded" why="This page has no stored block list." />,
                slot,
              )
            : null}
        </div>
      </div>
    </figure>
  );
}
