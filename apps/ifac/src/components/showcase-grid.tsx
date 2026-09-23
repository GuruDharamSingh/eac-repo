"use client";

import * as React from "react";
import { setThreadPinnedAction } from "@/lib/showcase-actions";
import type { ShowcaseItem } from "@/lib/showcase";

/**
 * The showcase feed.
 *
 * A client component only because of the pin control — an editor toggling a
 * card should see it move without a full reload. For everyone else this is a
 * list of links and nothing more.
 */
export function ShowcaseGrid({
  items,
  canEdit,
}: {
  items: ShowcaseItem[];
  canEdit: boolean;
}) {
  const [pins, setPins] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.pinned]))
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  // Pinned first, then as the server ordered them. Sorted here rather than
  // re-fetching so a toggle moves the card immediately.
  const ordered = React.useMemo(() => {
    const rank = new Map(items.map((i, n) => [i.id, n]));
    return [...items].sort((a, b) => {
      const pa = pins[a.id] ? 0 : 1;
      const pb = pins[b.id] ? 0 : 1;
      return pa - pb || (rank.get(a.id)! - rank.get(b.id)!);
    });
  }, [items, pins]);

  async function togglePin(id: string) {
    const next = !pins[id];
    setBusy(id);
    setProblem(null);
    const result = await setThreadPinnedAction(id, next).catch(() => ({
      ok: false as const,
      error: "Could not reach the server.",
    }));
    setBusy(null);
    if (!result.ok) {
      setProblem(("error" in result && result.error) || "Could not save that.");
      return;
    }
    setPins((p) => ({ ...p, [id]: next }));
  }

  if (items.length === 0) {
    return <p className="showcase-empty">Nothing published yet.</p>;
  }

  return (
    <>
      {problem && <p className="showcase-problem" role="alert">{problem}</p>}
      <ul className="showcase-grid">
        {ordered.map((item) => (
          <li
            key={item.id}
            className={"showcase-card" + (pins[item.id] ? " is-pinned" : "")}
            data-kind={item.kind}
          >
            <a className="showcase-card__hit" href={item.href}>
              {item.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="showcase-card__cover"
                  src={`${item.coverImageUrl}${item.coverImageUrl.includes("?") ? "&" : "?"}w=512`}
                  alt=""
                  loading="lazy"
                />
              )}
              <span className="showcase-card__meta">
                <span className="showcase-card__kind">{KIND_LABEL[item.kind] ?? item.kind}</span>
                {pins[item.id] && <span className="showcase-card__pin" aria-label="Pinned">Pinned</span>}
              </span>
              <h2 className="showcase-card__title">{item.title}</h2>
              {item.excerpt && <p className="showcase-card__lede">{item.excerpt}</p>}
              <span className="showcase-card__foot">
                {[item.authorName, formatWhen(item)].filter(Boolean).join(" · ")}
              </span>
            </a>

            {canEdit && (
              // Outside the link, deliberately: a control nested in an anchor
              // is a click the browser has to guess about.
              <button
                type="button"
                className="showcase-card__pinbtn"
                onClick={() => void togglePin(item.id)}
                disabled={busy === item.id}
                aria-pressed={Boolean(pins[item.id])}
              >
                {busy === item.id ? "…" : pins[item.id] ? "Unpin" : "Pin"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const KIND_LABEL: Record<string, string> = {
  // "Post", not "Writing": `writing` is a real and DIFFERENT kind (a member's
  // own blog) which this feed deliberately excludes, and labelling a post
  // with that word would say the showcase carries something it does not.
  post: "Post",
  meeting: "Gathering",
  event: "Event",
  workshop: "Workshop",
  idea: "Idea",
  service: "Service",
  questionnaire: "Questions",
  poll: "Poll",
};

/** A dated thing says when it happens; everything else says when it appeared. */
function formatWhen(item: ShowcaseItem): string | null {
  const raw = item.scheduledAt ?? item.publishedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
