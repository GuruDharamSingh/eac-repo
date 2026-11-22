"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { cx } from "./cx";
import { OfficeCreateSheet } from "./office-create-sheet";
import "./board.css";

type On = "board" | "new" | "schedule";

function onFor(pathname: string | null): On | null {
  if (!pathname) return null;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (p === "/manage") return "board";
  if (p === "/manage/schedule") return "schedule";
  if (p === "/manage/schedule/new") return "new";
  return null;
}

/**
 * Bottom bar of the Office (screen 40; "Board" was renamed Office, 2026-11-15): Office with its count badge, a brass
 * diamond "+" that opens the Create sheet (New tour, New experience, New dates, Share a post, Add a place), and
 * Schedule. Shown on /manage, /manage/schedule and /manage/schedule/new only. `count` is the number of slots waiting
 * for the guide's call (boardCounts().belowMinimum). Same bar chrome as the guest bar (.m-nav).
 */
export function BoardTabBar({ count = 0 }: { count?: number }) {
  const on = onFor(usePathname());
  const [creating, setCreating] = React.useState(false);
  if (!on) return null;
  return (
    <>
      <nav data-chrome="nav" className="m-nav" aria-label="Office">
        <div data-part="bar" className="m-nav-bar b-nav-bar">
          {/* The office moved to the hub (2026-11-19): this tab opens it; the badge (calls to make) stays. */}
          <Link href="/hub" data-part="item" className="m-nav-item">
            Hub
            {count > 0 ? <span data-part="badge" className="b-badge">{count}</span> : null}
          </Link>
          <button type="button" aria-label="Create" aria-haspopup="dialog" aria-expanded={creating} onClick={() => setCreating(true)} className={cx("b-plus", on === "new" && "is-active")}>
            <span className="b-diamond"><span>+</span></span>
          </button>
          <Link href="/manage/schedule" data-part={on === "schedule" ? "active" : "item"} aria-current={on === "schedule" ? "page" : undefined} className={cx("m-nav-item", on === "schedule" && "is-active")}>
            Schedule
          </Link>
        </div>
      </nav>
      <OfficeCreateSheet open={creating} onOpenChange={setCreating} />
    </>
  );
}

/**
 * The artist's bottom bar (screen 40, artist variant): My page | brass diamond "+" (a new experience) | Invitations.
 * Artists are members, not editors, so they never see the office board; their home is /artist.
 */
export function ArtistTabBar({ waiting = 0 }: { waiting?: number }) {
  const raw = usePathname() ?? "";
  const p = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  const on = p === "/artist" ? "home" : p === "/artist/experiences/new" ? "new" : p === "/artist/invitations" ? "inv" : null;
  if (!on) return null;
  return (
    <nav data-chrome="nav" className="m-nav" aria-label="My page">
      <div data-part="bar" className="m-nav-bar b-nav-bar">
        <Link href="/artist" data-part={on === "home" ? "active" : "item"} aria-current={on === "home" ? "page" : undefined} className={cx("m-nav-item", on === "home" && "is-active")}>
          My page
        </Link>
        <Link href="/artist/experiences/new" aria-label="New experience" aria-current={on === "new" ? "page" : undefined} className={cx("b-plus", on === "new" && "is-active")}>
          <span className="b-diamond"><span>+</span></span>
        </Link>
        <Link href="/artist/invitations" data-part={on === "inv" ? "active" : "item"} aria-current={on === "inv" ? "page" : undefined} className={cx("m-nav-item", on === "inv" && "is-active")}>
          Invitations
          {waiting > 0 ? <span data-part="badge" className="b-badge">{waiting}</span> : null}
        </Link>
      </div>
    </nav>
  );
}
