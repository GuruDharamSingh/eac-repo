"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moderateCard, resolveReport } from "@/lib/manage/actions";
import type { OpenReport } from "@/lib/manage/data";

const REASON_LABELS: Record<string, string> = {
  not_a_pigeon: "Not a pigeon",
  duplicate: "Duplicate",
  identifiable_person: "Identifiable person",
  wrong_place: "Wrong location",
  offensive: "Offensive",
  copyright: "Not their photo",
  other: "Other",
};

export function ReportRow({ report }: { report: OpenReport }) {
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(success);
      else toast.error(res.error ?? "That didn't work.");
    });
  }

  return (
    <li className="flex flex-wrap items-start gap-4 p-4">
      <Link href={`/cards/${report.slug}`} target="_blank" className="shrink-0">
        <div className="size-20 overflow-hidden rounded-md bg-muted">
          {report.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.thumbUrl} alt="" className="size-full object-cover" />
          )}
        </div>
      </Link>

      <div className="min-w-[14rem] flex-1">
        <p className="font-medium">{report.cardTitle}</p>
        <p className="mt-0.5 text-sm text-destructive">
          {REASON_LABELS[report.reason] ?? report.reason}
        </p>
        {report.detail && (
          <p className="mt-1 text-sm text-muted-foreground">{report.detail}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(report.createdAt).toLocaleString()}
          {report.moderationState !== "live" && ` · already ${report.moderationState}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            act(
              () => resolveReport({ reportId: report.id, status: "dismissed" }),
              "Dismissed."
            )
          }
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || report.moderationState === "hidden"}
          onClick={() =>
            act(async () => {
              const m = await moderateCard({ threadId: report.threadId, state: "hidden" });
              if (!m.ok) return m;
              return resolveReport({ reportId: report.id, status: "actioned" });
            }, "Hidden.")
          }
        >
          Hide
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            // Destroys the stored photos. Worth one confirmation.
            if (
              !confirm(
                "Remove this card and permanently delete its photos from storage? This can't be undone."
              )
            ) {
              return;
            }
            act(async () => {
              const m = await moderateCard({
                threadId: report.threadId,
                state: "removed",
                note: REASON_LABELS[report.reason],
              });
              if (!m.ok) return m;
              return resolveReport({ reportId: report.id, status: "actioned" });
            }, "Removed and files deleted.");
          }}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
