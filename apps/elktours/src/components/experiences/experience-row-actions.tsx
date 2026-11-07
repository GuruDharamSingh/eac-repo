"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setExperienceStatusAction } from "@/lib/experience-actions";

/** Per-row links and status changes on /manage/experiences. */
export function ExperienceRowActions({ id, slug, status }: { id: string; slug: string; status: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function change(next: "draft" | "published" | "archived") {
    if (next === "archived" && !window.confirm("Archive this experience? It leaves the site; the record stays.")) return;
    start(async () => {
      try {
        const r = await setExperienceStatusAction(id, next);
        if (r.ok === false) return void toast.error(r.error);
        toast.success(next === "published" ? "Published" : next === "archived" ? "Archived" : "Restored as a draft");
        router.refresh();
      } catch (x) {
        toast.error(x instanceof Error ? x.message : "Could not change the status.");
      }
    });
  }

  const btn = "underline-offset-4 hover:underline disabled:opacity-50";
  return (
    <span className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1 text-sm">
      <Link href={`/experiences/${slug}`} className={btn}>{status === "published" ? "View" : "Preview"}</Link>
      <Link href={`/manage/experiences/${id}`} className={btn}>Edit</Link>
      <Link href={`/studio/experience/${id}`} className={btn}>Layout</Link>
      {/* Draft / members only / public is chosen in the row's "Who sees it" selector. */}
      {status === "archived" && (
        <button type="button" disabled={pending} onClick={() => change("draft")} className={btn}>Restore as draft</button>
      )}
      {status !== "archived" && (
        <button type="button" disabled={pending} onClick={() => change("archived")} className={`${btn} text-muted-foreground`}>Archive</button>
      )}
    </span>
  );
}
