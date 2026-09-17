"use client";

import { useEffect, useState } from "react";

/**
 * Side drawer for account-level actions. Off-canvas rather than a dropdown so
 * it works the same on a phone, where the hub grid becomes one column and the
 * header nav is already crowded.
 */
export function HubDrawer({
  displayName,
  profileHref,
}: {
  displayName: string;
  profileHref: string | null;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="hub-drawer-toggle"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <span aria-hidden>☰</span> Menu
      </button>

      {open && (
        <div
          className="hub-drawer-scrim"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`hub-drawer${open ? " is-open" : ""}`}
        aria-label="Member menu"
        aria-hidden={!open}
      >
        <div className="hub-drawer-head">
          <p className="kicker">Signed in</p>
          <p className="hub-drawer-name">{displayName}</p>
          <button
            type="button"
            className="hub-dialog-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        <nav className="hub-drawer-nav">
          <a href={profileHref ?? "/hub"}>
            My profile
            {!profileHref && <em> — not set up yet</em>}
          </a>
          {/* These were `/hub#compose` and `/hub#questionnaires` — anchors to
              ids that have never existed on the page, so both landed at the
              top of the hub having done nothing. Compose is a real route;
              the questionnaires panel is a surface, and a surface is reached
              from its face, not from a link. */}
          <a href="/hub/compose">
            Compose
            <em> — the long form, on its own page</em>
          </a>
          <a href="/forum">The forum</a>
          <a href="/">Public site</a>
          <a className="hub-drawer-signout" href="/api/auth/logout">
            Log out
          </a>
        </nav>
      </aside>
    </>
  );
}
