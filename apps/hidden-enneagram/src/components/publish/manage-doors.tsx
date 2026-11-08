"use client";

import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { studioHref, useOpenStudio } from "./studio-surface";

// /manage's doors into the Studio popup (round 4): "New ▾" and each row's Edit.
// /manage/content/new and /manage/content/<id> stay as the plain-form fallback.

export function ManageNewMenu({ feeds }: { feeds: Array<{ slug: string; name: string }> }) {
  const open = useOpenStudio();
  const postFeeds = feeds.filter((f) => f.slug !== "writing" && f.slug !== "services");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          New
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {feeds.some((f) => f.slug === "writing") ? (
          <DropdownMenuItem onSelect={() => open({ kind: "writing", feed: "writing" })}>Writing</DropdownMenuItem>
        ) : null}
        {postFeeds.map((f) => (
          <DropdownMenuItem key={f.slug} onSelect={() => open({ kind: "writing", feed: f.slug })}>
            Post on {f.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => open({ kind: "service" })}>Service (a reading or session)</DropdownMenuItem>
        <DropdownMenuItem disabled>Event · soon</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/manage/content/new">The plain form</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Edit" on a row: the Studio popup with that item; a link to /publish without script. */
export function EditInStudio({ id, kind }: { id: string; kind: string }) {
  const open = useOpenStudio();
  const k = kind === "service" ? "service" : "writing";
  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={studioHref({ kind: k, id })}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          open({ kind: k, id }, e.currentTarget);
        }}
      >
        Edit
      </a>
    </Button>
  );
}
