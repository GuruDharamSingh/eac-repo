import Link from "next/link";
import type { Metadata } from "next";
import { getThreadsForFeed } from "@/lib/data";
import type { Thread } from "@/lib/types";
import { listWritingShelf } from "@/lib/landing";
import { toPlainText } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { SiteShell } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Publications",
  description: `Writing from ${siteConfig.orgName}.`,
};

/** Publications (2026-11-02): the writing feed, newest first, as IFAC's page lists its own. */
export default async function PublicationsPage() {
  const [shelf, feed] = await Promise.all([listWritingShelf(24), getThreadsForFeed("writing", 24).catch((): Thread[] => [])]);
  const excerpts = new Map<string, string | null>(
    feed.map((t): [string, string | null] => [t.slug, t.excerpt ?? (t.description ? toPlainText(t.description, 180) : null)])
  );

  return (
    <SiteShell>
      <section className="pts-panel" data-edit-section="publications" data-edit-name="Publications">
        <div className="pts-wrap pts-stack">
          <header className="pts-head">
            <div>
              <p className="ifs-eyebrow">Publications</p>
              <h1 className="pts-h1">Writing</h1>
            </div>
          </header>
          {shelf.length === 0 ? (
            <p className="ifs-muted">Nothing published yet.</p>
          ) : (
            <div className="ifs-pubs">
              {shelf.map((w) => (
                <Link key={w.id} className="ifs-pub" href={`/writing/${w.slug}`}>
                  {w.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ifs-pub__img" src={w.coverImageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="ifs-pub__blank">{siteConfig.orgName}</span>
                  )}
                  <span className="ifs-pub__body">
                    <span className="ifs-pub__t">{w.title}</span>
                    {(w.lede ?? excerpts.get(w.slug)) && <span className="ifs-pub__s">{w.lede ?? excerpts.get(w.slug)}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
