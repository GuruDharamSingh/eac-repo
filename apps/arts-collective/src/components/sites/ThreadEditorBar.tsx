"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PinToggle } from "@/components/cms/pin-toggle";

/**
 * The thin band an owner or guide sees above one of their org's published
 * threads on the site: whether it leads the site, and the pin that decides.
 * Visitors never see it (the route checks `canEditOrgSite` first).
 */
export function ThreadEditorBar({ threadId, pinned: initial }: { threadId: string; pinned: boolean }) {
  const router = useRouter();
  const [pinned, setPinned] = React.useState(initial);
  return (
    <div className="border-b border-border bg-card" data-editor-bar>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm">
        <span className="text-muted-foreground">
          {pinned ? "This leads your site." : "Pin this to lead your site with it."}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{pinned ? "Unpin" : "Pin"}</span>
          <PinToggle
            threadId={threadId}
            pinned={pinned}
            onToggled={(next) => {
              setPinned(next);
              router.refresh();
            }}
          />
        </span>
      </div>
    </div>
  );
}
