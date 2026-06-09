"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CornerUpLeft, Trash2 } from "lucide-react";
import { RichText } from "@elkdonis/ui";
import type { Reply } from "@/lib/forum";
import { ReplyForm } from "./reply-form";
import styles from "../forum.module.css";

interface RepliesThreadProps {
  replies: Reply[];
  threadSlug: string;
  canModerate?: boolean;
}

interface ReplyNode extends Reply {
  children: ReplyNode[];
}

const MAX_VISUAL_DEPTH = 3;
const BODY_CLAMP_CHARS = 480; // ~12 short lines

function buildReplyTree(replies: Reply[]): ReplyNode[] {
  const map = new Map<string, ReplyNode>();
  const roots: ReplyNode[] = [];
  for (const r of replies) {
    map.set(r.id, { ...r, children: [] });
  }
  for (const r of replies) {
    const node = map.get(r.id)!;
    if (r.parentId && map.has(r.parentId)) {
      map.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function formatTime(date: Date): string {
  const d = new Date(date);
  const ms = Date.now() - d.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < minute) return "just now";
  if (ms < hour) return `${Math.floor(ms / minute)}m ago`;
  if (ms < day) return `${Math.floor(ms / hour)}h ago`;
  if (ms < 30 * day) return `${Math.floor(ms / day)}d ago`;
  return d.toLocaleDateString();
}

function countDescendants(node: ReplyNode): number {
  let n = 0;
  for (const c of node.children) {
    n += 1 + countDescendants(c);
  }
  return n;
}

/** Read-more clamp for long single replies. */
function ReplyBody({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const plainLength = useMemo(
    () => content.replace(/<[^>]*>/g, "").length,
    [content]
  );
  const needsClamp = plainLength > BODY_CLAMP_CHARS;

  return (
    <>
      <RichText
        html={content}
        className={`${styles.replyBody} ${styles.richText} ${
          needsClamp && !expanded ? styles.replyBodyClamped : ""
        }`}
      />
      {needsClamp && (
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}

function ReplyItem({
  node,
  depth,
  ancestorMap,
  threadSlug,
  isAuthed,
  canModerate,
  onDelete,
  highlightedId,
}: {
  node: ReplyNode;
  depth: number;
  ancestorMap: Map<string, ReplyNode>;
  threadSlug: string;
  canModerate: boolean;
  onDelete: (id: string) => void;
  highlightedId: string | null;
}) {
  const [replying, setReplying] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (highlightedId === node.id && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedId, node.id]);

  // Once depth would exceed MAX_VISUAL_DEPTH, render flat at the cap and show a
  // backlink to the direct ancestor — keeps text-width readable on mobile.
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);
  const isFlattened = depth > MAX_VISUAL_DEPTH;
  const directParent = node.parentId ? ancestorMap.get(node.parentId) : null;
  const isHighlighted = highlightedId === node.id;

  return (
    <li
      ref={itemRef}
      id={`reply-${node.id}`}
      className={`${styles.replyItem} ${visualDepth > 0 ? styles.nested : ""} ${
        isHighlighted ? styles.replyHighlight : ""
      }`}
      data-depth={visualDepth}
    >
      {isFlattened && directParent && (
        <a
          href={`#reply-${directParent.id}`}
          className={styles.replyBacklink}
        >
          <CornerUpLeft size={12} aria-hidden="true" />
          <span>replying to {directParent.userName}</span>
        </a>
      )}
      <div className={styles.replyHeader}>
        <span
          className={styles.replyAuthor}
          style={node.commentColor ? { color: node.commentColor } : undefined}
        >
          {node.userName}
        </span>
        <a
          href={`#reply-${node.id}`}
          className={styles.replyTime}
          title="Permalink to this reply"
        >
          {formatTime(node.createdAt)}
        </a>
      </div>
      <ReplyBody content={node.content} />
      <div className={styles.replyActions}>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setReplying((s) => !s)}
        >
          {replying ? "Cancel" : "Reply"}
        </button>
        {canModerate && (
          <button
            type="button"
            className={styles.moderateDeleteLink}
            onClick={() => onDelete(node.id)}
          >
            <Trash2 size={12} aria-hidden="true" /> Delete
          </button>
        )}
      </div>
      {replying && (
        <div style={{ marginTop: "0.75rem" }}>
          <ReplyForm
            threadSlug={threadSlug}
            parentReplyId={node.id}
            placeholder={`Replying to ${node.userName}…`}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
      {node.children.length > 0 && (
        <ul className={styles.repliesList} style={{ marginTop: "0.85rem" }}>
          {node.children.map((c) => (
            <ReplyItem
              key={c.id}
              node={c}
              depth={depth + 1}
              ancestorMap={ancestorMap}
              threadSlug={threadSlug}
              canModerate={canModerate}
              onDelete={onDelete}
              highlightedId={highlightedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Top-level reply with a collapse/expand toggle for its descendant subtree. */
function TopLevelReply({
  node,
  ancestorMap,
  threadSlug,
  isAuthed,
  canModerate,
  onDelete,
  highlightedId,
}: {
  node: ReplyNode;
  ancestorMap: Map<string, ReplyNode>;
  threadSlug: string;
  canModerate: boolean;
  onDelete: (id: string) => void;
  highlightedId: string | null;
}) {
  const descendantCount = countDescendants(node);
  const initiallyExpanded = descendantCount <= 4; // small subtrees stay open
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [replying, setReplying] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);
  const isHighlighted = highlightedId === node.id;

  // If a descendant is targeted by the anchor, force-expand to reveal it.
  useEffect(() => {
    if (!highlightedId) return;
    if (highlightedId === node.id) {
      itemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    function contains(n: ReplyNode, id: string): boolean {
      if (n.id === id) return true;
      return n.children.some((c) => contains(c, id));
    }
    if (node.children.some((c) => contains(c, highlightedId))) {
      setExpanded(true);
    }
  }, [highlightedId, node]);

  return (
    <li
      ref={itemRef}
      id={`reply-${node.id}`}
      className={`${styles.replyItem} ${isHighlighted ? styles.replyHighlight : ""}`}
      data-depth={0}
    >
      <div className={styles.replyHeader}>
        {descendantCount > 0 && (
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse replies" : "Expand replies"}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <span
          className={styles.replyAuthor}
          style={node.commentColor ? { color: node.commentColor } : undefined}
        >
          {node.userName}
        </span>
        <a
          href={`#reply-${node.id}`}
          className={styles.replyTime}
          title="Permalink to this reply"
        >
          {formatTime(node.createdAt)}
        </a>
      </div>
      <ReplyBody content={node.content} />
      <div className={styles.replyActions}>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setReplying((s) => !s)}
        >
          {replying ? "Cancel" : "Reply"}
        </button>
        {canModerate && (
          <button
            type="button"
            className={styles.moderateDeleteLink}
            onClick={() => onDelete(node.id)}
          >
            <Trash2 size={12} aria-hidden="true" /> Delete
          </button>
        )}
        {descendantCount > 0 && !expanded && (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setExpanded(true)}
          >
            Show {descendantCount} {descendantCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>
      {replying && (
        <div style={{ marginTop: "0.75rem" }}>
          <ReplyForm
            threadSlug={threadSlug}
            parentReplyId={node.id}
            placeholder={`Replying to ${node.userName}…`}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
      {expanded && node.children.length > 0 && (
        <ul className={styles.repliesList} style={{ marginTop: "0.85rem" }}>
          {node.children.map((c) => (
            <ReplyItem
              key={c.id}
              node={c}
              depth={1}
              ancestorMap={ancestorMap}
              threadSlug={threadSlug}
              canModerate={canModerate}
              onDelete={onDelete}
              highlightedId={highlightedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function flattenAncestorMap(roots: ReplyNode[]): Map<string, ReplyNode> {
  const map = new Map<string, ReplyNode>();
  function walk(n: ReplyNode) {
    map.set(n.id, n);
    n.children.forEach(walk);
  }
  roots.forEach(walk);
  return map;
}

export function RepliesThread({ replies, threadSlug, canModerate = false }: RepliesThreadProps) {
  const router = useRouter();
  const tree = buildReplyTree(replies);
  const ancestorMap = flattenAncestorMap(tree);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm("Delete this reply and any replies under it?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/forum/replies/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      window.alert("Could not delete the reply.");
    } finally {
      setDeletingId(null);
    }
  }

  // Sync highlight to URL hash on mount + hashchange.
  useEffect(() => {
    function fromHash() {
      const m = window.location.hash.match(/^#reply-(.+)$/);
      setHighlightedId(m ? m[1] : null);
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  return (
    <section>
      <h3 className={styles.repliesHeading}>
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h3>
      {tree.length > 0 && (
        <ul className={styles.repliesList}>
          {tree.map((r) => (
            <TopLevelReply
              key={r.id}
              node={r}
              ancestorMap={ancestorMap}
              threadSlug={threadSlug}
              canModerate={canModerate}
              onDelete={handleDelete}
              highlightedId={highlightedId}
            />
          ))}
        </ul>
      )}

      <ReplyForm threadSlug={threadSlug} />
    </section>
  );
}
