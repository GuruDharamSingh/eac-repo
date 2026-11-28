"use client";

import "@elkdonis/content/content.css";
import * as React from "react";
import { ContentLibrary, type PieceLightboxAction } from "@elkdonis/content/ui";
import type { ContentListItem, ContentView } from "@elkdonis/content/model";

/**
 * /center, "My work": the viewer's own library. A client file because the lead action is a function.
 * The library's folder browser only runs outside remote mode; in remote mode its Files view reads the index (no
 * files are indexed until Step 5). So the Files view drops `source` and browses folders; Published and All are remote.
 */
export function MyWork({ timeZone, sources }: { timeZone: string; sources: Array<{ key: string; label: string }> }) {
  const [view, setView] = React.useState<ContentView>("published");
  const folders = sources.length ? { endpoint: "/api/content/folders", sources } : undefined;
  const filesWithFolders = view === "files" && Boolean(folders);

  const primaryAction = React.useCallback((item: ContentListItem): PieceLightboxAction | null => {
    if (item.type === "artwork" && item.can?.edit && item.links.studio) return { label: "Edit", href: item.links.studio };
    const open = item.links.public ?? item.links.manage ?? null;
    return open ? { label: "Open", href: open } : null;
  }, []);

  return (
    <div className="eac-c">
      <ContentLibrary
        source={filesWithFolders ? undefined : { endpoint: "/api/content/search" }}
        scope={{ kind: "mine" }}
        view={view}
        onViewChange={setView}
        folders={folders}
        timeZone={timeZone}
        primaryAction={primaryAction}
        groupBy="none"
        rememberAs="market-center"
        searchPlaceholder="Search your work"
      />
    </div>
  );
}
