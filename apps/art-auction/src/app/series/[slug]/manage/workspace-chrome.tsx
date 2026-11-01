"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { setStatusAction } from "./actions";

const GROUPS: Array<{ label: string; items: Array<{ path: string; label: string; count?: "lots" }> }> = [
  { label: "Run", items: [
    { path: "", label: "Overview" },
    { path: "/lots", label: "Lots & artworks", count: "lots" },
    { path: "/artists", label: "Artists" },
    { path: "/orgs", label: "Organisations" },
    { path: "/weeks", label: "Weeks & content" },
    { path: "/orders", label: "Orders & fulfilment" },
    { path: "/money", label: "Money" },
  ] },
  { label: "Present", items: [
    { path: "/page", label: "Page & look" },
    { path: "/features", label: "Features" },
    { path: "/live", label: "Live close" },
    { path: "/visitors", label: "Visitors" },
  ] },
  { label: "Set up", items: [
    { path: "/team", label: "Team" },
    { path: "/rules", label: "Dates & bidding" },
    { path: "/help", label: "Help" },
  ] },
];

export function WorkspaceNav({ slug, lotCount }: { slug: string; lotCount: number }) {
  const pathname = usePathname() ?? "";
  const base = `/series/${slug}/manage`;
  return (
    <nav aria-label="Workspace" className="sw-nav">
      {GROUPS.map((g) => (
        <React.Fragment key={g.label}>
          <p className="sw-nav-group">{g.label}</p>
          {g.items.map((it) => {
            const href = base + it.path;
            const active = it.path === "" ? pathname === base : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={it.path} href={href} aria-current={active ? "page" : undefined}>
                <span>{it.label}</span>
                {it.count === "lots" && <span className="sw-nav-count">{lotCount}</span>}
              </Link>
            );
          })}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function StatusControl({ seriesId, slug, status }: { seriesId: string; slug: string; status: "draft" | "published" | "closed" }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function go(next: "draft" | "published" | "closed", confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const r = await setStatusAction(seriesId, slug, next);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not change the status.");
    router.refresh();
  }
  if (status === "draft") {
    return (
      <button type="button" className="sw-btn" disabled={busy} onClick={() => go("published", "Publish the series? The page goes public at the announce date (now, if none is set).")}>
        Publish series…
      </button>
    );
  }
  if (status === "published") {
    return (
      <>
        <button type="button" className="sw-btn is-quiet" disabled={busy} onClick={() => go("draft", "Back to draft? The public page and presenter view go offline.")}>Unpublish</button>
        <button type="button" className="sw-btn is-outline" disabled={busy} onClick={() => go("closed", "Mark the series closed? Its page says the auction has closed. The workspace stays open for settling.")}>Close series</button>
      </>
    );
  }
  return <button type="button" className="sw-btn is-quiet" disabled={busy} onClick={() => go("published", "Reopen the series?")}>Reopen</button>;
}
