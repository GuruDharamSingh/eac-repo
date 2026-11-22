"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PageDoc } from "@/lib/sites-door";
import { discardSiteDraft, publishSiteDraft, type SiteBasis } from "@/lib/sites-actions";
import "./draft-review.css";

// ============================================================================
// Review of one waiting draft (lane ASSIST, 2026-11-20). A person looks at what was proposed, by whom, why, the
// steps in plain words and the page before and after, then publishes it or throws it away. It changes nothing
// itself: "Publish" and "Discard" call the gated actions in lib/sites-actions (publishSiteDraft, discardSiteDraft),
// which check the admin, the page's blocks and the stale guard on the server.
//
// Everything shown here that a machine or a person wrote (the label, the note, the steps, the words on the page) is
// drawn as plain text by React, never as markup, and cut to a sensible length.
//
// MOUNTING (lane DEV owns the page): on /sites/[org]/[...slug], where the waiting draft is loaded,
//   {draft ? <DraftReview orgId={orgId} slug={slug} live={live} draft={reviewDraft} canPublish={canPublish}
//       publishBlockedBecause={why} renderPage={drawDocument} /> : null}
// `reviewDraft` is { data, savedAt, base, author, note, steps } straight from loadDraft (note null when none).
// `renderPage` is optional: pass the page's own drawing (the registry's) and each side is drawn; leave it out and
// the two sides are lists of blocks with the words that change.
// ============================================================================

type Step = Record<string, unknown>;

export interface ReviewDraft {
  data: PageDoc;
  /** The draft's save time: handed back to the publish and discard actions as `draftSavedAt`. */
  savedAt: string;
  /** The published page's version when the draft began (null: the page was not published yet). */
  base: string | null;
  author: { id: string; kind: "person" | "assistant"; label: string };
  note: string | null;
  steps: unknown[];
}

export interface DraftReviewProps {
  orgId: string;
  slug: string;
  /** The published page now (null: not published yet). */
  live: { data: PageDoc; version: string } | null;
  draft: ReviewDraft;
  /** Whether Publish is offered. The page decides (every block checkable, no old layout); this says why not, in `publishBlockedBecause`. */
  canPublish: boolean;
  publishBlockedBecause?: string;
  /** Draws a whole page. Without it each side lists its blocks. */
  renderPage?: (doc: PageDoc) => ReactNode;
  /** Plain names for block types ("hero-banner" to "Hero banner"). Optional. */
  labels?: Readonly<Record<string, string>>;
}

const cut = (v: unknown, n = 90): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  const one = (s ?? "").replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

const whenWords = (s: Step): string =>
  s.state === "hover" ? " when hovered" : s.state === "focus" ? " when focused" : s.state === "active" ? " when pressed" : s.at === "sm" ? " on phones" : s.at === "md" ? " on tablets and below" : "";

interface Flat {
  id: string;
  type: string;
  props: Record<string, unknown>;
  depth: number;
}

/** Every block of a page, nested ones too, in page order. */
function flatten(doc: PageDoc | null | undefined): Flat[] {
  const out: Flat[] = [];
  const go = (list: unknown, depth: number) => {
    if (!Array.isArray(list) || depth > 20) return;
    for (const n of list) {
      if (!n || typeof n !== "object") continue;
      const node = n as { type?: unknown; props?: unknown };
      if (typeof node.type !== "string" || !node.props || typeof node.props !== "object") continue;
      const props = node.props as Record<string, unknown>;
      out.push({ id: typeof props.id === "string" ? props.id : "", type: node.type, props, depth });
      for (const v of Object.values(props)) if (Array.isArray(v) && v.length) go(v, depth + 1);
    }
  };
  go(doc?.content, 0);
  return out;
}

const SLOT = (v: unknown) => Array.isArray(v) && v.some((x) => x && typeof x === "object" && typeof (x as { type?: unknown }).type === "string");
const isLook = (k: string) => k === "morph" || k === "look" || k === "blkStyle";

/** One step as a sentence a person can read. */
export function stepWords(step: unknown, blocks: Flat[], labels: Readonly<Record<string, string>> = {}): string {
  if (!step || typeof step !== "object" || Array.isArray(step)) return "A change this page cannot describe.";
  const s = step as Step;
  const b = typeof s.block === "string" ? blocks.find((x) => x.id === s.block) : undefined;
  const what = b ? `${labels[b.type] ?? b.type} (${cut(b.id, 30)})` : typeof s.block === "string" ? `the block ${cut(s.block, 30)}` : "a block";
  switch (s.op) {
    case "set_prop":
      return `Change "${cut(s.prop, 40)}" of ${what} to "${cut(s.value)}".`;
    case "set_look":
      return s.look === null
        ? `Clear the look of "${cut(s.part, 40)}" on ${what}${whenWords(s)}.`
        : `Change the look of "${cut(s.part, 40)}" on ${what}${whenWords(s)}.`;
    case "set_token":
      return s.value === null ? `Put "${cut(s.name, 40)}" on ${what} back to the site's own.` : `Set "${cut(s.name, 40)}" on ${what} to ${cut(s.value, 30)}.`;
    case "insert":
      return `Add a ${labels[String(s.type)] ?? cut(s.type, 40)} block.`;
    case "move":
      return `Move ${what}.`;
    case "duplicate":
      return `Copy ${what}.`;
    case "remove":
      return `Remove ${what}.`;
    default:
      return "A change this page cannot describe.";
  }
}

interface Change {
  id: string;
  label: string;
  lines: Array<{ name: string; before: string; after: string }>;
}

/** What differs between the published page and the draft, block by block (by id): words that changed, look changed, blocks added or gone. */
function compare(before: PageDoc | null, after: PageDoc, labels: Readonly<Record<string, string>>): { changes: Change[]; added: string[]; removed: string[] } {
  const a = flatten(before);
  const b = flatten(after);
  const byId = new Map(a.filter((x) => x.id).map((x) => [x.id, x]));
  const seen = new Set<string>();
  const changes: Change[] = [];
  const added: string[] = [];
  for (const n of b) {
    const label = `${labels[n.type] ?? n.type}${n.id ? ` (${cut(n.id, 30)})` : ""}`;
    const was = n.id ? byId.get(n.id) : undefined;
    if (n.id) seen.add(n.id);
    if (!was) {
      added.push(label);
      continue;
    }
    const lines: Change["lines"] = [];
    const names = new Set([...Object.keys(was.props), ...Object.keys(n.props)]);
    for (const k of names) {
      if (k === "id" || SLOT(was.props[k]) || SLOT(n.props[k])) continue;
      const x = JSON.stringify(was.props[k]) ?? "";
      const y = JSON.stringify(n.props[k]) ?? "";
      if (x === y) continue;
      lines.push(isLook(k) ? { name: "Look", before: was.props[k] === undefined ? "none" : "its look", after: n.props[k] === undefined ? "none" : "changed" } : { name: k, before: cut(was.props[k], 120) || "empty", after: cut(n.props[k], 120) || "empty" });
    }
    if (lines.length) changes.push({ id: n.id, label, lines });
  }
  const removed = a.filter((x) => x.id && !seen.has(x.id)).map((x) => `${labels[x.type] ?? x.type} (${cut(x.id, 30)})`);
  return { changes, added, removed };
}

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "an unknown time" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

function BlockList({ doc, labels }: { doc: PageDoc | null; labels: Readonly<Record<string, string>> }) {
  const rows = flatten(doc);
  if (!doc) return <p className="dr-empty">Not published yet.</p>;
  if (!rows.length) return <p className="dr-empty">No blocks.</p>;
  return (
    <ol className="dr-blocks">
      {rows.map((r, i) => (
        <li key={`${r.id}-${i}`} style={{ marginLeft: r.depth * 14 }}>
          {labels[r.type] ?? r.type}
          {r.id ? <code> {cut(r.id, 30)}</code> : null}
        </li>
      ))}
    </ol>
  );
}

export function DraftReview({ orgId, slug, live, draft, canPublish, publishBlockedBecause, renderPage, labels = {} }: DraftReviewProps) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const stale = (live?.version ?? null) !== draft.base;
  const blocks = useMemo(() => flatten(draft.data), [draft.data]);
  const diff = useMemo(() => compare(live?.data ?? null, draft.data, labels), [live, draft.data, labels]);
  const basis: SiteBasis = { liveVersion: live?.version ?? null, draftSavedAt: draft.savedAt };
  const byAssistant = draft.author.kind === "assistant";

  const act = (fn: () => Promise<{ ok: boolean; say: string }>) =>
    startBusy(async () => {
      try {
        const r = await fn();
        setMessage({ ok: r.ok, text: r.say });
        if (r.ok) router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "That did not work." });
      }
    });

  return (
    <section className="dr" aria-label="Review of a waiting draft">
      <h2 className="dr-title">Review the waiting draft</h2>
      <p className="dr-who">
        <span className={byAssistant ? "dr-badge dr-assistant" : "dr-badge dr-person"}>{byAssistant ? "Proposed by an assistant" : "Proposed by a person"}</span>{" "}
        <strong>{cut(draft.author.label, 80)}</strong>, {formatWhen(draft.savedAt)}.
      </p>
      {byAssistant ? <p className="dr-help">An assistant wrote this. It has not gone live and will not until you publish it.</p> : null}
      {draft.note ? (
        <blockquote className="dr-note">
          <span className="dr-label">Note</span>
          {cut(draft.note, 500)}
        </blockquote>
      ) : (
        <p className="dr-help">No note was left.</p>
      )}
      {stale ? (
        <p className="dr-warn" role="alert">
          The published page changed after this draft began, so publishing it would be refused. Throw it away and ask for the change again, or make it by hand.
        </p>
      ) : null}

      <h3 className="dr-sub">What it does ({draft.steps.length} step{draft.steps.length === 1 ? "" : "s"})</h3>
      {draft.steps.length ? (
        <ol className="dr-steps">
          {draft.steps.slice(0, 60).map((s, i) => (
            <li key={i}>{stepWords(s, blocks, labels)}</li>
          ))}
          {draft.steps.length > 60 ? <li className="dr-more">and {draft.steps.length - 60} more.</li> : null}
        </ol>
      ) : (
        <p className="dr-help">No steps were kept with this draft. The comparison below shows what differs.</p>
      )}

      <h3 className="dr-sub">What differs from the published page</h3>
      {diff.changes.length === 0 && diff.added.length === 0 && diff.removed.length === 0 ? <p className="dr-help">Nothing differs.</p> : null}
      {diff.changes.map((c, i) => (
        <div className="dr-change" key={`${c.id}-${i}`}>
          <strong>{c.label}</strong>
          {c.lines.map((l) => (
            <div className="dr-line" key={l.name}>
              <span className="dr-label">{l.name}</span>
              <span className="dr-before">{l.before}</span>
              <span className="dr-arrow" aria-hidden="true">
                →
              </span>
              <span className="dr-after">{l.after}</span>
            </div>
          ))}
        </div>
      ))}
      {diff.added.length ? <p className="dr-help">Added: {diff.added.join(", ")}.</p> : null}
      {diff.removed.length ? <p className="dr-help">Removed: {diff.removed.join(", ")}.</p> : null}

      <h3 className="dr-sub">Before and after</h3>
      <div className="dr-sides">
        <div className="dr-side">
          <div className="dr-side-head">Published now</div>
          <div className="dr-stage">{live ? (renderPage ? renderPage(live.data) : <BlockList doc={live.data} labels={labels} />) : <p className="dr-empty">Not published yet.</p>}</div>
        </div>
        <div className="dr-side">
          <div className="dr-side-head">With the draft</div>
          <div className="dr-stage">{renderPage ? renderPage(draft.data) : <BlockList doc={draft.data} labels={labels} />}</div>
        </div>
      </div>

      <div className="dr-actions">
        {canPublish && !stale ? (
          <button type="button" className="dr-publish" disabled={busy} onClick={() => act(() => publishSiteDraft(orgId, slug, basis))}>
            Publish this draft
          </button>
        ) : (
          <p className="dr-help">{stale ? "Publish is not offered: the page changed since the draft began." : (publishBlockedBecause ?? "Publish is not offered for this page from here.")}</p>
        )}
        <button type="button" disabled={busy} onClick={() => act(() => discardSiteDraft(orgId, slug))}>
          Throw the draft away
        </button>
      </div>
      {message ? (
        <p className={message.ok ? "dr-say dr-ok" : "dr-say dr-bad"} role="status">
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
