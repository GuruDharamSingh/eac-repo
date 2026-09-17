import type { Metadata } from "next";
import Link from "next/link";
import { listOrgIdeas } from "@elkdonis/services";
import { getAllThreadsForOrg } from "@/lib/data";
import { threadHref } from "@/components/thread-card";
import { siteConfig } from "@/config/site";
import { formatWhen } from "@/lib/format";

export const metadata: Metadata = { title: "Manage" };

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const [threads, ideas] = await Promise.all([
    getAllThreadsForOrg(60).then((all) => all.filter((t) => t.kind !== "idea")),
    listOrgIdeas(siteConfig.orgId, { limit: 30 }).catch(() => []),
  ]);

  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>Overview</h1>
      {saved && <p className="eyebrow" style={{ marginTop: 8 }}>Saved.</p>}

      <div className="split" style={{ marginTop: 22 }}>
        <div>
          <div className="band__head">
            <h2 className="band__title">Reading groups &amp; posts</h2>
            <Link href="/manage/groups/new" className="band__more">New →</Link>
          </div>
          {threads.length === 0 ? (
            <div className="empty">Nothing yet. <Link href="/manage/groups/new">Start the first reading group.</Link></div>
          ) : (
            <ul className="booklist">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={threadHref(t)}>
                    <span className="booklist__title">{t.title}</span>
                    <span className="booklist__author">{t.kind === "reading_group" ? "group" : t.kind} · {t.status}{t.nextOccurrenceAt ? ` · ${formatWhen(t.nextOccurrenceAt)}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="band__head"><h2 className="band__title">Suggestions &amp; hosting offers</h2></div>
          {ideas.length === 0 ? (
            <div className="empty">None yet.</div>
          ) : (
            <ul className="booklist">
              {ideas.map((i) => (
                <li key={i.id}>
                  <span className="booklist__dead">
                    <span className="booklist__title">{i.title}</span>
                    <span className="booklist__author">{i.authorName ?? "a reader"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
