import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@elkdonis/db";
import { listOrgMembers, occurrencesOf } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { READING_GROUP_KIND } from "@/lib/types";
import { formatDay, formatRecurrence, formatWhen } from "@/lib/format";
import { getFeaturedGroupId } from "@/lib/featured";
import { setFeaturedGroup } from "@/lib/circle-actions";

export const metadata: Metadata = { title: "Reading groups · Manage" };
export const dynamic = "force-dynamic";

const ORG = siteConfig.orgId;

/**
 * Every reading group at a glance: who is in it, how far it has got, when it
 * next sits and who hosts. Each row opens the group's page, where the manage
 * section at the bottom stages its sessions. The layout gates this to editors.
 */
export default async function ManageGroupsPage() {
  const [groups, members, featuredId] = await Promise.all([
    db<Array<{
      id: string; slug: string | null; title: string; status: string;
      scheduled_at: Date | null; recurrence_pattern: string | null; recurrence_until: Date | null;
      readers: number; units: number; done: number; held: number; last_held: Date | null;
      topics: number; comments: number;
    }>>`
      SELECT t.id, t.slug, t.title, t.status, t.scheduled_at, t.recurrence_pattern, t.recurrence_until,
        (SELECT COUNT(*)::int FROM thread_rsvps r WHERE r.thread_id = t.id AND r.status = 'yes') AS readers,
        (SELECT COUNT(*)::int FROM circle_units u WHERE u.thread_id = t.id) AS units,
        (SELECT COUNT(*)::int FROM circle_units u WHERE u.thread_id = t.id AND u.status IN ('done','skipped')) AS done,
        (SELECT COUNT(*)::int FROM meeting_occurrence_notes n WHERE n.thread_id = t.id AND (n.stop_unit_id IS NOT NULL OR n.note IS NOT NULL)) AS held,
        (SELECT MAX(n.occurrence_at) FROM meeting_occurrence_notes n WHERE n.thread_id = t.id AND n.stop_unit_id IS NOT NULL) AS last_held,
        (SELECT COUNT(*)::int FROM threads s WHERE s.org_id = t.org_id AND s.metadata->'circleSession'->>'circleId' = t.id AND s.status <> 'archived') AS topics,
        (SELECT COUNT(*)::int FROM replies rp JOIN threads s ON s.id = rp.thread_id
           WHERE s.org_id = t.org_id AND s.metadata->'circleSession'->>'circleId' = t.id) AS comments
      FROM threads t
      WHERE t.org_id = ${ORG} AND t.kind = ${READING_GROUP_KIND} AND t.status <> 'archived'
      ORDER BY t.created_at DESC
    `.catch((err) => { console.error("[fourthway] manage groups:", err); return []; }),
    listOrgMembers(ORG).catch(() => []),
    getFeaturedGroupId(),
  ]);
  const byRole: Record<string, number> = {};
  for (const m of members) byRole[m.role] = (byRole[m.role] ?? 0) + 1;

  return (
    <>
      <div className="band__head">
        <h1 className="band__title" style={{ fontSize: "1.6rem" }}>Reading groups</h1>
        <Link href="/manage/groups/new" className="band__more">New reading group →</Link>
      </div>
      <p style={{ color: "var(--ink-muted)", margin: "0 0 18px" }}>
        Org members: {["owner", "guide", "member", "viewer"].map((r) => `${byRole[r] ?? 0} ${r === "viewer" ? "followers" : `${r}s`}`).join(" · ")}.
        Members see every circle&rsquo;s workspace; followers see the public part.
      </p>

      {groups.length === 0 ? (
        <div className="empty">No reading groups yet.</div>
      ) : (
        <table className="circle-manage__table">
          <thead>
            <tr><th>Group</th><th>Readers</th><th>Progress</th><th>Sessions</th><th>Next</th><th>Home page</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const [next] = g.scheduled_at
                ? occurrencesOf(
                    { scheduledAt: g.scheduled_at, recurrencePattern: g.recurrence_pattern, recurrenceUntil: g.recurrence_until },
                    { from: new Date(Date.now() - 3 * 3_600_000), count: 1 }
                  )
                : [];
              const pct = g.units ? Math.round((g.done / g.units) * 100) : 0;
              return (
                <tr key={g.id}>
                  <td>
                    <Link href={`/groups/${g.slug ?? g.id}#manage`}><strong>{g.title}</strong></Link>
                    <br />
                    <span className="circle-manage__muted">
                      {g.status !== "published" ? `${g.status} · ` : ""}{formatRecurrence(g.recurrence_pattern) ?? "no schedule"}
                    </span>
                  </td>
                  <td>{g.readers}</td>
                  <td>
                    {g.units ? `${g.done} / ${g.units} (${pct}%)` : "no plan"}
                  </td>
                  <td>
                    {g.held} held · {g.topics} staged
                    <br />
                    <span className="circle-manage__muted">
                      {g.comments} comment{g.comments === 1 ? "" : "s"}{g.last_held ? ` · last ${formatDay(g.last_held)}` : ""}
                    </span>
                  </td>
                  <td>{next ? formatWhen(next) : <span className="circle-manage__muted">—</span>}</td>
                  <td>
                    <form action={setFeaturedGroup}>
                      <input type="hidden" name="groupId" value={featuredId === g.id ? "" : g.id} />
                      {featuredId === g.id ? (
                        <><strong>Featured</strong> <button className="btn btn--small">Stop featuring</button></>
                      ) : (
                        <button className="btn btn--small" disabled={g.status !== "published"}>Feature</button>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
