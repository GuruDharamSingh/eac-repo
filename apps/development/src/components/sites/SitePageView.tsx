"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Render, type Config } from "@puckeditor/core";
import { LOCAL_APPS } from "@/registry/local";
import { renderConfigFor } from "@/components/blocks/configs";
import { ThemeScope } from "@/components/blocks/theme-scope";
import { applySteps, type BlockContractLike, type PageDoc, type Step } from "@/lib/sites-door";
import { discardSiteDraft, publishSiteDraft, saveSiteDraft, type SiteBasis } from "@/lib/sites-actions";
import { forDrawing, listBlocks, publishProblems } from "@/lib/sites-doc";
import { Boundary, Missing, sampleRowsOf, useRegistry } from "./draw";
import { DraftReview } from "./DraftReview";
import { SiteHands } from "./SiteHands";
import "./sites.css";

// ============================================================================
// One page of one organisation, drawn from its stored document with every block this app can load
// (shared blocks, the editing boxes, and each site's own blocks from registry/local). A block it cannot
// load is drawn as a labelled placeholder and stays in the document. Below: the blocks as a list, the
// document itself, and the four hands (words, look, blocks, assistant) that change it as steps and keep the
// result as a draft. A step is checked against the manifest's contract for EVERY block (the server holds the same
// contracts and checks again), so any block on any site's page can be changed. Nothing here writes the live page
// except "Publish", which only ever publishes a draft a person has looked at.
// ============================================================================

export interface DraftView {
  data: PageDoc;
  savedAt: string;
  authorLabel: string;
  authorKind: "person" | "assistant";
  /** The published page's version when the draft began (null: the page was not published yet). */
  base: string | null;
  note: string | null;
  stepCount: number;
  /** The steps that made the draft, as stored (an assistant sends them with its note). */
  steps: unknown[];
}

export interface SitePageViewProps {
  orgId: string;
  orgName: string;
  slug: string;
  live: { data: PageDoc; version: string } | null;
  draft: DraftView | null;
  /** The contract of every block in the manifest: what the door checks a step against (plain data from the server). */
  contracts: Record<string, BlockContractLike>;
  /** The small Puck config the structure steps run on (plain data from the server). */
  config: unknown;
}

const formatWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "unknown");

export function SitePageView({ orgId, orgName, slug, live, draft, contracts, config: stepConfig }: SitePageViewProps) {
  const router = useRouter();
  const { loaded, loadErrors, done } = useRegistry();
  const [tab, setTab] = useState<"published" | "draft">(draft ? "draft" : "published");
  const [pending, setPending] = useState<Step[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startBusy] = useTransition();

  const config = useMemo<Config | null>(() => {
    if (loaded.size === 0) return null;
    const base = renderConfigFor([...loaded.values()]);
    return { ...base, components: { ...base.components, "st-missing": { fields: {}, render: (p: { was?: string }) => <Missing was={String(p.was ?? "")} /> } } } as Config;
  }, [loaded]);

  const known = useMemo(() => (t: string) => Object.prototype.hasOwnProperty.call(contracts, t), [contracts]);

  // The page being worked on: the waiting draft if there is one, else the published page; your unsaved steps on top.
  const start = (draft?.data ?? live?.data) as PageDoc;
  const working = useMemo(() => {
    if (pending.length === 0) return start;
    const out = applySteps(start, pending, { contracts, config: stepConfig, allowUnknownTypes: true });
    return out.ok ? out.doc : start;
  }, [start, pending, contracts, stepConfig]);

  const shown = tab === "published" && live ? live.data : working;
  const blocks = useMemo(() => listBlocks(shown), [shown]);
  const basis: SiteBasis = { liveVersion: live?.version ?? null, draftSavedAt: draft?.savedAt ?? null };
  // Why this page cannot be published from here, in plain words (empty: nothing in the way).
  const problems = useMemo(() => publishProblems(working, known), [working, known]);
  const noZones = !(working.zones && Object.keys(working.zones).length);

  const drawOf = useMemo(() => {
    if (!config) return null;
    const comps = config.components as Record<string, unknown>;
    return (doc: PageDoc) => forDrawing(doc, (t) => t === "st-missing" || Object.prototype.hasOwnProperty.call(comps, t), (t) => sampleRowsOf(loaded.get(t)));
  }, [config, loaded]);
  const drawn = useMemo(() => (drawOf ? drawOf(shown) : null), [drawOf, shown]);
  /** A whole page drawn with the registry's blocks (the review's before and after sides). */
  const drawDocument = (doc: PageDoc) => {
    const d = drawOf?.(doc);
    if (!d || !config) return null;
    return (
      <ThemeScope app={LOCAL_APPS.has(orgId) ? orgId : undefined}>
        {d.content.map((node, i) => (
          <Boundary key={`${String(node.props.id ?? i)}-${i}`} was={node.type === "st-missing" ? String(node.props.was) : node.type}>
            <Render config={config} data={{ root: d.root, content: [node] } as never} />
          </Boundary>
        ))}
      </ThemeScope>
    );
  };

  const act = (fn: () => Promise<{ ok: boolean; say: string }>, after?: () => void) =>
    startBusy(async () => {
      try {
        const r = await fn();
        setMessage({ ok: r.ok, text: r.say });
        if (r.ok) {
          after?.();
          router.refresh();
        }
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "That did not work." });
      }
    });

  // A page can be changed here when it is in Puck's current layout; the old zone layout is read only.
  const canEdit = noZones;
  const canPublish = Boolean(draft) && pending.length === 0 && problems.length === 0;
  const devPage = orgId === "development";

  return (
    <div className="st-page">
      <Link className="dev-back" href="/sites">
        All sites
      </Link>
      <h1 className="st-title">
        {orgName} <span className="st-slug">/{slug === "home" ? "" : slug}</span>
      </h1>
      <p className="dev-lede">
        {live ? <>Published page last changed with version <code>{live.version.slice(0, 19)}</code>. </> : <>This page is not published yet; only a draft exists. </>}
        {draft ? <>A draft is waiting ({draft.stepCount} change{draft.stepCount === 1 ? "" : "s"}, kept {formatWhen(draft.savedAt)}).</> : "No draft is waiting."}
        {devPage && live ? (
          <>
            {" "}
            <Link href={`/pages/${slug.split("/").map(encodeURIComponent).join("/")}`}>Open the published page to type into it</Link>.
          </>
        ) : null}
      </p>

      {draft && live ? (
        <div className="st-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "published"} onClick={() => setTab("published")}>
            Published page
          </button>
          <button type="button" role="tab" aria-selected={tab === "draft"} onClick={() => setTab("draft")}>
            Waiting draft{pending.length ? " and your changes" : ""}
          </button>
        </div>
      ) : pending.length ? (
        <p className="st-note">Showing the page with your unsaved changes.</p>
      ) : null}

      <div className="st-stage" data-st-stage>
        {!done && !drawn ? <p className="dev-loading">Loading the blocks this app can draw...</p> : null}
        {drawn ? (
          <ThemeScope app={LOCAL_APPS.has(orgId) ? orgId : undefined}>
            {drawn.content.length === 0 ? <p className="st-empty">This page has no blocks. Use &ldquo;Blocks&rdquo; below to add the first one.</p> : null}
            {drawn.content.map((node, i) => (
              <Boundary key={`${String(node.props.id ?? i)}-${i}`} was={node.type === "st-missing" ? String(node.props.was) : node.type}>
                <Render config={config!} data={{ root: drawn.root, content: [node] } as never} />
              </Boundary>
            ))}
          </ThemeScope>
        ) : null}
      </div>
      {loadErrors.length ? (
        <p className="st-note">
          Some block sets did not load, so their blocks show as placeholders: {loadErrors.join(" ")}
        </p>
      ) : null}

      {canEdit ? (
        <section className="st-section">
          <h2>Change this page</h2>
          <p className="st-help">
            Pick a block, then change its words or its look, add, move, copy or remove blocks, or paste steps the way an assistant would send them. Nothing here changes the published page: your changes are kept as a draft, and a person publishes it when they are ready.
          </p>
          {problems.length ? <p className="st-note">You can change this page here, but it cannot be published from here: {problems.join(" ")}</p> : null}
          <SiteHands doc={working} contracts={contracts} config={stepConfig} pending={pending} onPending={setPending} />
          <div className="st-actions">
            <button type="button" className="st-primary" disabled={busy || pending.length === 0} onClick={() => act(() => saveSiteDraft(orgId, slug, pending, basis), () => setPending([]))}>
              Save as a draft ({pending.length} change{pending.length === 1 ? "" : "s"})
            </button>
            <button type="button" disabled={busy || pending.length === 0} onClick={() => setPending([])}>
              Forget unsaved changes
            </button>
          </div>
        </section>
      ) : (
        <p className="st-note">This page uses an older layout that this app can read but not change.</p>
      )}

      {draft ? (
        <>
          {pending.length ? <p className="st-note">You have changes that are not saved yet: save them as a draft first, then look the draft over and publish it.</p> : null}
          <DraftReview
            orgId={orgId}
            slug={slug}
            live={live}
            draft={{ data: draft.data, savedAt: draft.savedAt, base: draft.base, author: { id: "", kind: draft.authorKind, label: draft.authorLabel }, note: draft.note, steps: draft.steps }}
            canPublish={canPublish}
            publishBlockedBecause={problems.length ? `Publish is not offered here: ${problems.join(" ")}` : pending.length ? "Save your changes first, then publish." : undefined}
            renderPage={drawDocument}
            labels={Object.fromEntries(Object.entries(contracts).map(([id, c]) => [id, c.label]))}
          />
        </>
      ) : null}

      {message ? (
        <p className={message.ok ? "st-say st-ok" : "st-say st-bad"} role="status">
          {message.text}
        </p>
      ) : null}

      <section className="st-section">
        <h2>Blocks on this page ({blocks.length})</h2>
        <table className="st-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Id</th>
              <th>Where</th>
              <th>Here</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => {
              const block = loaded.get(b.type);
              return (
                <tr key={b.path}>
                  <td style={{ paddingLeft: 8 + b.depth * 14 }}>{block?.def.label ?? contracts[b.type]?.label ?? b.type}</td>
                  <td>
                    <code>{b.id}</code>
                  </td>
                  <td>
                    <code>{b.path}</code>
                  </td>
                  <td>
                    {!block ? "Placeholder: this app cannot draw it" : block.def.dataDriven ? "Drawn with example data" : "Drawn"}
                    {known(b.type) ? ", can be changed here" : ", cannot be changed here (in no block list)"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="st-section">
        <h2>The document</h2>
        <details>
          <summary>Show the stored page as data</summary>
          <pre className="st-json">{JSON.stringify(shown, null, 1).slice(0, 200000)}</pre>
        </details>
      </section>
    </div>
  );
}
