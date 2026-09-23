"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * The digest itself, and the one control a guide gets over it.
 *
 * Card size is a PROPERTY OF THE PAGE, not of the person looking: a guide sets
 * it here, signed in, and every visitor then sees that. Same posture as the
 * artist image grid — the people who run the site arrange it from the site,
 * rather than from a settings screen somewhere else. Everyone else never sees
 * the control at all.
 *
 * The three sizes are widths, not layouts: the same markup reflows through one
 * CSS grid (showcase.css), so nothing about a card's contents changes with it.
 */

export type ShowcaseSize = "small" | "medium" | "large";

export interface ShowcaseCard {
  id: string;
  title: string;
  kind: string;
  href: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  sectionName: string | null;
  at: string | null;
  authorName: string | null;
  authorHref: string | null;
}

const KIND_LABEL: Record<string, string> = {
  post: "Writing",
  event: "Gathering",
  meeting: "Meeting",
  workshop: "Workshop",
  product: "For sale",
  artwork: "Work",
  idea: "Idea",
  question: "Question",
  reading_group: "Reading",
};

const SIZES: Array<{ id: ShowcaseSize; label: string }> = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function ShowcaseFeed({
  items,
  size: initialSize,
  canArrange,
}: {
  items: ShowcaseCard[];
  size: ShowcaseSize;
  /** Owner or guide, signed in: the size control is theirs alone. */
  canArrange: boolean;
}) {
  const [size, setSize] = useState<ShowcaseSize>(initialSize);
  const [saving, setSaving] = useState(false);

  async function choose(next: ShowcaseSize) {
    if (next === size) return;
    const previous = size;
    setSize(next); // the page rearranges at once; the save is the slow part
    setSaving(true);
    try {
      const res = await fetch("/api/showcase/size", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ size: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSize(previous);
        toast.error(data.error ?? "Couldn't save that.");
      }
    } catch {
      setSize(previous);
      toast.error("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {canArrange && (
        <div className="ifac-sc-arrange" role="group" aria-label="Card size">
          <span className="ifac-sc-arrange__label">Cards</span>
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === size ? "is-on" : undefined}
              aria-pressed={s.id === size}
              disabled={saving}
              onClick={() => void choose(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="ifac-sc-feed" data-size={size}>
        {items.map((item) => (
          <article key={item.id} className="ifac-sc-card">
            <a className="ifac-sc-card__link" href={item.href}>
              {item.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ifac-sc-card__cover" src={item.coverImageUrl} alt="" loading="lazy" />
              )}
              <p className="ifac-sc-card__meta">
                {KIND_LABEL[item.kind] ?? item.kind}
                {item.sectionName ? ` · ${item.sectionName}` : ""}
                {item.at ? ` · ${when(item.at)}` : ""}
              </p>
              <h2 className="ifac-sc-card__title">{item.title}</h2>
              {item.excerpt && <p className="ifac-sc-card__excerpt">{item.excerpt}</p>}
            </a>
            {item.authorName && (
              <p className="ifac-sc-card__by">
                by{" "}
                {item.authorHref ? <a href={item.authorHref}>{item.authorName}</a> : item.authorName}
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
