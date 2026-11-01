"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { attachPublicationAction, detachPublicationAction } from "./actions";

const inputCls = "rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AttachForm({
  seriesId,
  weekCount,
  writing,
}: {
  seriesId: string;
  weekCount: number;
  writing: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [threadId, setThreadId] = React.useState("");
  const [week, setWeek] = React.useState("1");
  const [busy, setBusy] = React.useState(false);
  if (writing.length === 0) return null;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!threadId) return;
        setBusy(true);
        const r = await attachPublicationAction(seriesId, threadId, Number(week));
        setBusy(false);
        if (!r.ok) return toast.error(r.error ?? "Could not attach.");
        toast.success("Attached.");
        setThreadId("");
        router.refresh();
      }}
    >
      <select className={`${inputCls} min-w-[16rem] flex-1`} value={threadId} onChange={(e) => setThreadId(e.target.value)}>
        <option value="">Attach one of your published pieces…</option>
        {writing.map((w) => (
          <option key={w.id} value={w.id}>{w.title}</option>
        ))}
      </select>
      <select className={inputCls} value={week} onChange={(e) => setWeek(e.target.value)} aria-label="Week">
        {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => (
          <option key={w} value={w}>Week {w}</option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={busy || !threadId}>Attach</Button>
    </form>
  );
}

export function DetachButton({ seriesId, slotId }: { seriesId: string; slotId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      className="text-xs text-destructive underline-offset-4 hover:underline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await detachPublicationAction(seriesId, slotId);
        setBusy(false);
        if (!r.ok) return toast.error(r.error ?? "Could not remove.");
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
