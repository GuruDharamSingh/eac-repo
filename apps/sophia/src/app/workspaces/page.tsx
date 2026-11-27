import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listWorkspaceCreatorOrgs, listWorkspaces, type WorkspaceListItem } from "@elkdonis/lms";
import { connectors } from "@/lib/connectors";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Workspaces", robots: { index: false, follow: false } };

const MODE_WORDS = { open: "At your own pace", drip: "At your own pace", cohort: "Together, with a guide", circle: "A study circle" } as const;
const STATUS_WORDS: Record<string, string> = { draft: "Not open yet", open: "Open", closed: "Closed" };
const fmt = (d: Date) => d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" });

function Cards({ items, empty, labelId }: { items: WorkspaceListItem[]; empty: string; labelId: string }) {
  if (items.length === 0) return <p className="so-empty">{empty}</p>;
  return (
    <ul className="so-cards" aria-labelledby={labelId}>
      {items.map((w) => (
        <li key={w.runId} className="so-card">
          <span className="so-kicker">{w.orgName} · {MODE_WORDS[w.mode]} · {STATUS_WORDS[w.status] ?? w.status}</span>
          <h3><a href={`/workspaces/${w.courseSlug}`}>{w.courseTitle}</a></h3>
          {w.courseSummary && <p>{w.courseSummary}</p>}
          <p className="so-meta">
            {w.enrolled} {w.enrolled === 1 ? "person" : "people"}
            {w.startsAt ? ` · starts ${fmt(w.startsAt)}` : ""}
          </p>
          <a className="so-btn" href={`/workspaces/${w.courseSlug}`}>Open</a>
        </li>
      ))}
    </ul>
  );
}

export default async function Page() {
  const viewer = await getViewer();
  if (!viewer.userId) redirect(connectors.hrefs.signIn("/workspaces"));
  const [{ member, guiding }, creatorOrgs] = await Promise.all([listWorkspaces(viewer), listWorkspaceCreatorOrgs(viewer)]);
  return (
    <main className="so-page">
      <header className="so-hero">
        <span className="so-kicker">Workspaces</span>
        <h1>Your workspaces</h1>
        <p>The groups you are in, and the ones you guide.</p>
        {creatorOrgs.length > 0 && <p className="so-hero__act"><a className="so-btn" href="/workspaces/new">New workspace</a></p>}
      </header>
      <section aria-labelledby="in-h">
        <h2 id="in-h" className="so-h2">You are in</h2>
        <Cards items={member} labelId="in-h" empty="You are not in a workspace yet. When a guide adds you to one, it will show up here." />
      </section>
      <section aria-labelledby="guide-h">
        <h2 id="guide-h" className="so-h2">You guide</h2>
        <Cards items={guiding} labelId="guide-h" empty="You do not guide a workspace yet." />
      </section>
    </main>
  );
}
