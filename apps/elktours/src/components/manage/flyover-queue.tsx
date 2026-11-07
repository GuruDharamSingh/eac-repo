"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Checkbox } from "@elkdonis/primitives";
import type { RenderRequest, Result } from "@/lib/catalogue-types";
import {
  acceptFlyoverAction,
  cancelFlyoverAction,
  rejectFlyoverAction,
  requeueFlyoverAction,
} from "@/lib/render-request-actions";
import { FlyoverTimeline, STATUS_LABEL, fmtWhen } from "@/components/manage/flyover-status";

const OPEN: RenderRequest["status"][] = ["requested", "accepted", "claimed", "rendering"];

/**
 * /manage/flyovers: every tour's fly-over requests. Owners accept (which
 * freezes the route and stops into the render payload) or reject, cancel,
 * and put a failed one back in the queue. Editors see the queue read-only
 * apart from cancelling. Delivered films are hidden until switched on in
 * the tour's Assets tab (auto-publish defaults to off).
 */
export function FlyoverQueue({ requests, canAccept }: { requests: RenderRequest[]; canAccept: boolean }) {
  const router = useRouter();
  const [show, setShow] = React.useState<"open" | "all">("open");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [autoPublish, setAutoPublish] = React.useState<Record<string, boolean>>({});

  const anyMoving = requests.some((r) => OPEN.includes(r.status));
  React.useEffect(() => {
    if (!anyMoving) return;
    const t = window.setInterval(() => router.refresh(), 20000);
    return () => window.clearInterval(t);
  }, [anyMoving, router]);

  const list = show === "open" ? requests.filter((r) => OPEN.includes(r.status) || r.status === "failed") : requests;

  async function run(id: string, label: string, fn: () => Promise<Result<{ request: RenderRequest }>>) {
    setBusy(id);
    const res = await fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(label);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Requests for aerial fly-over films. {canAccept ? "Accepting one freezes the tour's route and stops for the render PC." : "Only owners accept or reject."}
        </p>
        <div className="flex gap-1 text-sm">
          {(["open", "all"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setShow(k)}
              className={`px-3 py-1.5 ${show === k ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {k === "open" ? "Open and failed" : "All"}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="mt-8 border border-dashed border-border p-10 text-center text-muted-foreground">
          {show === "open" ? "Nothing waiting. Request a fly-over from a tour's Fly-over tab." : "No fly-over requests yet."}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map((r) => (
            <li key={r.id} className="border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <Link href={`/manage/tours/${r.threadId}/flyover`} className="font-serif text-lg underline-offset-4 hover:underline">
                    {r.tourTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {STATUS_LABEL[r.status]} · asked by {r.requestedByName ?? "an editor"} {fmtWhen(r.createdAt)}
                    {r.acceptedByName ? ` · accepted by ${r.acceptedByName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canAccept && r.status === "requested" && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={Boolean(autoPublish[r.id])}
                          onCheckedChange={(v) => setAutoPublish((m) => ({ ...m, [r.id]: Boolean(v) }))}
                        />
                        Show on delivery
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() => run(r.id, "Accepted. The render PC will pick it up.", () => acceptFlyoverAction(r.id, { autoPublish: Boolean(autoPublish[r.id]) }))}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy === r.id}
                        onClick={() => {
                          const reason = prompt("Why not? (the requester sees this)");
                          if (reason === null) return;
                          void run(r.id, "Rejected.", () => rejectFlyoverAction(r.id, reason.trim() || "Not now"));
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {canAccept && r.status === "failed" && (
                    <Button type="button" size="sm" disabled={busy === r.id} onClick={() => run(r.id, "Back in the queue.", () => requeueFlyoverAction(r.id))}>
                      Re-queue
                    </Button>
                  )}
                  {(r.status === "requested" || r.status === "accepted") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy === r.id}
                      onClick={() => confirm("Cancel this request?") && void run(r.id, "Cancelled.", () => cancelFlyoverAction(r.id))}
                    >
                      Cancel
                    </Button>
                  )}
                  {r.status === "delivered" && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/manage/tours/${r.threadId}/assets`}>Review film</Link>
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <FlyoverTimeline request={r} />
              </div>
              {(r.style.notes || r.note) && <p className="mt-3 text-sm italic text-muted-foreground">“{r.style.notes ?? r.note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
