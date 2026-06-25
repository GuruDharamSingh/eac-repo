"use client";

import { useEffect, useState } from "react";
import { Calendar, MapPin, Pin, Repeat, Video } from "lucide-react";

interface FeedItem {
  id: string;
  kind: string;
  title: string;
  excerpt: string | null;
  scheduledAt: string | null;
  recurrencePattern: string | null;
  recurrenceCustomRule: string | null;
  location: string | null;
  isOnline: boolean;
  pinned: boolean;
  href: string;
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatWhen(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Public mini-feed shown in the right-hand slot of the "Current Offerings"
 * (Featured Initiative) section. Lists recurring meetings and, when there are
 * two or fewer, a single pinned non-private post or meeting.
 *
 * Renders nothing until data resolves; if the feed is empty it falls back to
 * the supplied static panel so the section never looks broken.
 */
export function MarketingMiniFeed({ fallback }: { fallback: React.ReactNode }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/marketing-feed")
      .then((r) => r.json())
      .then((d) => {
        if (active) setItems(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // While loading, keep the original panel in place to avoid layout shift.
  if (items === null) return <>{fallback}</>;
  if (items.length === 0) return <>{fallback}</>;

  return (
    <div className="initiative-feed-panel">
      <div className="initiative-feed-inner">
        <p className="initiative-feed-eyebrow">From the Gathering</p>
        <ul className="initiative-feed-list">
          {items.map((item) => {
            const when = formatWhen(item.scheduledAt);
            const recurrence =
              item.recurrencePattern && item.recurrencePattern !== "NONE"
                ? item.recurrenceCustomRule || RECURRENCE_LABELS[item.recurrencePattern] || "Recurring"
                : null;
            const blurb = item.excerpt ? stripHtml(item.excerpt) : "";
            return (
              <li key={item.id}>
                <a className="initiative-feed-card" href={item.href}>
                  <span className="initiative-feed-tags">
                    {recurrence && (
                      <span className="initiative-feed-tag">
                        <Repeat size={11} aria-hidden="true" />
                        {recurrence}
                      </span>
                    )}
                    {item.pinned && !recurrence && (
                      <span className="initiative-feed-tag">
                        <Pin size={11} aria-hidden="true" />
                        Pinned
                      </span>
                    )}
                    {item.isOnline && (
                      <span className="initiative-feed-tag">
                        <Video size={11} aria-hidden="true" />
                        Online
                      </span>
                    )}
                  </span>
                  <span className="initiative-feed-title">{item.title}</span>
                  {blurb && <span className="initiative-feed-blurb">{blurb}</span>}
                  <span className="initiative-feed-meta">
                    {when && (
                      <span>
                        <Calendar size={11} aria-hidden="true" /> {when}
                      </span>
                    )}
                    {item.location && (
                      <span>
                        <MapPin size={11} aria-hidden="true" /> {item.location}
                      </span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <a className="initiative-feed-all" href="/feed">
          See the full feed →
        </a>
      </div>
    </div>
  );
}
