"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Render, type Config } from "@puckeditor/core";
import { contractOf } from "@elkdonis/blocks/contract";
import { BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildPuckConfig } from "@elkdonis/page-builder";
import { FieldsLens } from "../../../../../packages/house-editor/src/fields/index";
import { fieldMapOf, type BlockMapSource } from "../../../../../packages/house-editor/src/fields/blockmap";
import { defineFields } from "../../../../../packages/house-editor/src/fields/registry";
import { ThemeScope } from "@/components/blocks/theme-scope";
import { pagesFieldsLoad, pagesFieldsSave } from "@/lib/sites-pages-actions";
import type { PageDoc } from "@/lib/sites-door";
import { forDrawing } from "@/lib/sites-doc";
import { Boundary, Missing, sampleRowsOf, useRegistry } from "./draw";
import "./sites.css";

// ============================================================================
// /pages/<slug>: the development organisation's PUBLISHED page, drawn with the registry's blocks, with the live
// editor on (the Fields lens, as on Para Theater): "Edit page" marks every word a block lets you type, and a word
// typed here is saved as one change to the published page, checked by the one door, with the stale-save guard.
// This is the page as published, never a draft. Blocks, order and looks are changed in the Sites tab (they wait as a
// draft there until published).
// ============================================================================

const NO_FIELDS = defineFields({});

export function PagesView({ slug, title, doc, version }: { slug: string; title: string; doc: PageDoc; version: string }) {
  const router = useRouter();
  const { loaded, loadErrors, done } = useRegistry();

  // The published shape of the config, plus an inert marker before each block so the lens can find what it draws.
  const config = useMemo<Config | null>(() => {
    if (loaded.size === 0) return null;
    const base = buildPuckConfig({ blocks: [...loaded.values()], root: BOX_ROOT, morph: MorphMark, marks: true }) as Config;
    return { ...base, components: { ...base.components, "st-missing": { fields: {}, render: (p: { was?: string }) => <Missing was={String(p.was ?? "")} /> } } } as Config;
  }, [loaded]);

  // Which part of which block may be typed into: from the real declarations of the blocks this app loaded.
  const map = useMemo(() => (loaded.size ? fieldMapOf(contractOf([...loaded.values()]) as unknown as Record<string, BlockMapSource>) : {}), [loaded]);

  const drawn = useMemo(() => {
    if (!config) return null;
    const comps = config.components as Record<string, unknown>;
    return forDrawing(doc, (t) => t === "st-missing" || Object.prototype.hasOwnProperty.call(comps, t), (t) => sampleRowsOf(loaded.get(t)));
  }, [config, doc, loaded]);

  return (
    <div className="st-page">
      <Link className="dev-back" href="/sites">
        All sites
      </Link>
      <h1 className="st-title">
        {title} <span className="st-slug">/pages/{slug}</span>
      </h1>
      <p className="dev-lede">
        This is the published page of the development organisation. Press <strong>Edit page</strong> (bottom of the screen), then click a word to type into it: it is saved to the published page when you press Enter or click away. A word typed here goes straight to the published page; a draft waiting for this page then shows as out of date. To add, move or restyle blocks,{" "}
        <Link href={`/sites/development/${slug.split("/").map(encodeURIComponent).join("/")}`}>change the page in the Sites tab</Link>: those changes wait as a draft until you publish them.
      </p>
      <div className="st-stage" data-st-stage>
        {!done && !drawn ? <p className="dev-loading">Loading the blocks this app can draw...</p> : null}
        {drawn ? (
          <ThemeScope>
            {drawn.content.length === 0 ? <p className="st-empty">This page has no blocks yet. Add some in the Sites tab, then publish.</p> : null}
            {drawn.content.map((node, i) => (
              <Boundary key={`${String(node.props.id ?? i)}-${i}`} was={node.type === "st-missing" ? String(node.props.was) : node.type}>
                <Render config={config!} data={{ root: drawn.root, content: [node] } as never} />
              </Boundary>
            ))}
          </ThemeScope>
        ) : null}
      </div>
      {loadErrors.length ? <p className="st-note">Some block sets did not load, so their blocks show as placeholders: {loadErrors.join(" ")}</p> : null}
      <p className="st-note">
        Published page version <code>{version.slice(0, 19)}</code>.
      </p>
      <FieldsLens
        registry={NO_FIELDS}
        blocks={{ map, slug }}
        load={pagesFieldsLoad}
        save={pagesFieldsSave}
        labels={{ edit: "Edit page", done: "Done" }}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
