"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { deleteContentAction, setContentStatusAction } from "@/lib/cms/actions";

interface ContentRowActionsProps {
  threadId: string;
  kind: string;
  status: string;
  feedSlug: string | null;
  slug: string;
}

export function ContentRowActions({
  threadId,
  kind,
  status,
  feedSlug,
  slug,
}: ContentRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Services keep their own marketplace route; posts live under their feed.
  const publicHref = kind === "service" ? `/services/${slug}` : `/${feedSlug}/${slug}`;

  function toggleStatus() {
    startTransition(async () => {
      const next = status === "published" ? "draft" : "published";
      const res = await setContentStatusAction(threadId, next);
      if (res.ok) {
        toast.success(next === "published" ? "Published." : "Moved back to draft.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update.");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this permanently?")) return;
    startTransition(async () => {
      const res = await deleteContentAction(threadId);
      if (res.ok) {
        toast.success("Deleted.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not delete.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} aria-label="Actions">
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/manage/content/${threadId}`}>Edit</Link>
        </DropdownMenuItem>
        {feedSlug && status === "published" && (
          <DropdownMenuItem asChild>
            <Link href={publicHref}>View on the site</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={toggleStatus}>
          {status === "published" ? "Move to draft" : "Publish"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={remove} variant="destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
