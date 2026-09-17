import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingThreads } from "@/lib/data";
import { threadHref } from "@/components/thread-card";
import { siteConfig } from "@/config/site";
import type { Thread } from "@/lib/types";

export const metadata: Metadata = { title: "Calendar" };

/**
 * An agenda, grouped by month — not a grid. A reading circle has a handful of
 * dates a month; a 7×5 grid of mostly empty cells would say less in more room.
 * Recurring circles appear once, at their next occurrence.
 */
export default async function CalendarPage() {
  const threads = (await getUpcomingThreads(60))
    .filter((t) => t.nextOccurrenceAt)
    .sort((a, b) => a.nextOccurrenceAt!.getTime() - b.nextOccurrenceAt!.getTime());

  const month = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: siteConfig.timeZone });
  const day = new Intl.DateTimeFormat("en-CA", { weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: siteConfig.timeZone });
  const groups = new Map<string, Thread[]>();
  for (const t of threads) {
    const k = month.format(t.nextOccurrenceAt!);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <div className="column band">
      <p className="eyebrow">Calendar</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>What&rsquo;s coming</h1>
      {groups.size === 0 && <div className="empty" style={{ marginTop: 20 }}>Nothing on the calendar yet.</div>}
      {[...groups].map(([label, items]) => (
        <section className="band" key={label}>
          <div className="band__head"><h2 className="band__title">{label}</h2></div>
          <ul className="booklist">
            {items.map((t) => (
              <li key={t.id}>
                <Link href={threadHref(t)}>
                  <span className="booklist__author" style={{ minWidth: 150 }}>{day.format(t.nextOccurrenceAt!)}</span>
                  <span className="booklist__title">{t.title}</span>
                  {t.recurrencePattern && t.recurrencePattern !== "NONE" && <span className="booklist__author">repeats</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
