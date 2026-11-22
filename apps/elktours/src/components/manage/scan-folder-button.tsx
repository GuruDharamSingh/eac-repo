"use client";
// "Scan folder" (2026-11-20): registers pictures dropped into the tour's or place's Nextcloud folder as hidden
// assets, then lists what it skipped and why. lib/media-folders.ts scanFolder.

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@elkdonis/primitives";
import { scanFolderAction } from "@/lib/media-folder-actions";
import type { ScanResult } from "@/lib/media-folders";

export function ScanFolderButton({ scope, folder }: { scope: { threadId: string } | { placeId: string }; folder: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [last, setLast] = React.useState<ScanResult | null>(null);

  async function scan() {
    setBusy(true);
    const res = await scanFolderAction(scope).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setLast(res.scan);
    toast.success(res.scan.added ? `${res.scan.added} picture${res.scan.added === 1 ? "" : "s"} added, hidden until you switch them on.` : "No new pictures in the folder.");
    if (res.scan.added) router.refresh();
  }

  const shown = last?.folder ?? folder;
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">Folder in Files <a href="/manage/media-folders" className="ml-2 font-normal text-muted-foreground underline-offset-4 hover:underline">all folders</a></div>
          <div className="text-muted-foreground break-all">{shown ? shown.replace(/^EAC_Network\//, "") : "Made on the first scan."}</div>
        </div>
        <Button size="sm" variant="outline" onClick={scan} disabled={busy}>
          {busy ? "Scanning…" : "Scan folder"}
        </Button>
      </div>
      {last && last.skipped.length > 0 && (
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {last.skipped.map((s) => (
            <li key={s.file}>
              <span className="text-foreground">{s.file}</span>: {s.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
