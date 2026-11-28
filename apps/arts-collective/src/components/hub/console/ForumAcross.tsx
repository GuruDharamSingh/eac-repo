"use client";

import * as React from "react";
import { ForumThreadRows, SurfaceFrame, SurfaceSection, SurfaceSkeleton, useSurface } from "@elkdonis/cms-ui/surface";
import type { SurfaceForumThread } from "@elkdonis/cms-ui/surface";
import type { HubAcrossItem } from "@/lib/hub-forum";
import "./forum-card.css";

/**
 * "Across your organisations": the board the page used to carry at its foot (CrossOrgForum), now a layer of the
 * forum card. The forum card itself is about the ONE org the dropdown selected; this is the opposite on purpose,
 * the latest threads in every organisation the viewer is in, grouped by organisation. A row opens the thread
 * frame (with its replies), so nothing here sends you off to another site.
 */
export function ForumAcross() {
  const { push } = useSurface();
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = React.useState<HubAcrossItem[]>([]);
  const [orgCount, setOrgCount] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    fetch("/api/hub/forum/across", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as { items: HubAcrossItem[]; orgCount: number };
      })
      .then((d) => {
        if (!live) return;
        setItems(d.items);
        setOrgCount(d.orgCount);
        setState("ready");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, []);

  // Grouped by organisation, in the order the newest thread of each appears.
  const groups = React.useMemo(() => {
    const map = new Map<string, { name: string; rows: SurfaceForumThread[] }>();
    for (const i of items) {
      const g = map.get(i.orgId) ?? { name: i.orgName, rows: [] };
      g.rows.push({
        id: i.threadId,
        title: i.title,
        kind: i.kind,
        feedName: null,
        authorName: i.authorName,
        replyCount: i.replyCount,
        at: i.lastAt ?? new Date(0).toISOString(),
        unread: null,
        href: "",
      });
      map.set(i.orgId, g);
    }
    return [...map.values()];
  }, [items]);

  return (
    <SurfaceFrame
      kind="forum"
      title="Across your organisations"
      kicker="Forum"
      status={state === "ready" ? (orgCount === 1 ? "Everything in your organisation" : `Everything in all ${orgCount} of your organisations`) : null}
    >
      {state === "loading" && <SurfaceSkeleton block />}
      {state === "error" && <p className="eac-surface-empty">Could not load this. Try again in a moment.</p>}
      {state === "ready" && groups.length === 0 && <p className="eac-surface-empty">Nothing posted yet in any of your organisations.</p>}
      {state === "ready" &&
        groups.map((g) => (
          <SurfaceSection key={g.name}>
            <h3 className="afc-org">{g.name}</h3>
            <ForumThreadRows
              threads={g.rows}
              onOpen={(t) => push({ type: "thread", id: t.id, preview: { title: t.title, kind: t.kind, feedName: null } })}
            />
          </SurfaceSection>
        ))}
    </SurfaceFrame>
  );
}
