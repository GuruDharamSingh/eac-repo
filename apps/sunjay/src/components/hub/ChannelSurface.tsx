"use client";

import * as React from "react";
import type { ActionResult } from "@elkdonis/actions";
import { SurfaceFrame } from "@elkdonis/cms-ui/surface";
import { ChannelHubPanel, type ChannelHubData } from "@elkdonis/channel/hub";
import { runChannelAction } from "@/lib/channel-door";

/**
 * The Channel pop-up (2026-11-15): reads /api/hub/channel when it opens, draws @elkdonis/channel/hub's panel, and
 * runs every write through the site's Channel door (runChannelAction, plans only). After a write that went, it reads
 * the data again so the chart and the list show it.
 */
export function ChannelSurface() {
  const [data, setData] = React.useState<ChannelHubData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/hub/channel", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as ChannelHubData);
      setError(null);
    } catch {
      setError("Channel could not be loaded. Close this and try again.");
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const run = React.useCallback(
    async (id: string, input: unknown): Promise<ActionResult> => {
      const r = await runChannelAction(id, input);
      if (r.ok) void load();
      return r;
    },
    [load],
  );

  return (
    <SurfaceFrame kind="board" title="Channel" kicker="Out, planned and waiting" flush>
      {data ? <ChannelHubPanel data={data} run={run} channelHref="/channel" /> : <p style={{ padding: "1rem" }}>{error ?? "Loading Channel…"}</p>}
    </SurfaceFrame>
  );
}
