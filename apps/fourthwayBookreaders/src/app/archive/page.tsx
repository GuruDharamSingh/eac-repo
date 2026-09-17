import type { Metadata } from "next";
import Link from "next/link";
import { getArchive, getMeetingRecordings } from "@/lib/data";
import { threadHref } from "@/components/thread-card";
import { withBase } from "@/lib/base-path";
import { Theatre } from "@/components/home/theatre";
import { formatDay, textOf } from "@/lib/format";

export const metadata: Metadata = { title: "Archive" };

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 120) || null;
  const [threads, recordings] = await Promise.all([getArchive(q), getMeetingRecordings(24)]);

  return (
    <div className="column band">
      <p className="eyebrow">Archive</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>Past sessions</h1>

      <form action={withBase("/archive")} className="card" style={{ marginTop: 20, display: "flex", gap: 10, maxWidth: 520 }}>
        <input name="q" type="search" defaultValue={q ?? ""} placeholder="a passage, a night" className="field" aria-label="Search the archive" />
        <button className="btn btn--primary">Search</button>
      </form>

      <section className="band">
        <div className="band__head">
          <h2 className="band__title">{q ? `Matching “${q}”` : "Sessions and notes"}</h2>
          {q && <Link href="/archive" className="band__more">Clear →</Link>}
        </div>
        {threads.length === 0 ? (
          <div className="empty">{q ? "Nothing matches that." : "Nothing in the archive yet."}</div>
        ) : (
          <ul className="booklist">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={threadHref(t)}>
                  <span className="booklist__title">{t.title}</span>
                  <span className="booklist__author">{formatDay(t.scheduledAt ?? t.publishedAt ?? t.createdAt)}</span>
                  <span className="booklist__note">{t.excerpt ?? textOf(t.description, 160)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="band">
        <div className="band__head"><h2 className="band__title">Recordings</h2></div>
        <Theatre recordings={recordings} />
      </section>
    </div>
  );
}
