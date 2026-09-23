"use client";

import * as React from "react";
import { Palette, Store } from "lucide-react";
import type { IFACProfile } from "@/lib/directory";

/**
 * What the header nav's "Artists"/"Dealers" links open: a popup like the
 * site's other lightboxes (dark overlay, Escape/backdrop to close), but
 * showing every profile as a card in a grid rather than one at a time — each
 * card's bio is cut off after a few lines and the whole card is a link
 * through to that person's own IFAC page, same as the "See more" affordance
 * implies. The main-page Artists/Dealers panels are untouched; this only
 * changes what the header nav's links do.
 */
export function DirectoryNavModal({
  artists,
  dealers,
}: {
  artists: IFACProfile[];
  dealers: IFACProfile[];
}) {
  const [kind, setKind] = React.useState<"artist" | "dealer" | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const restoreFocusRef = React.useRef<Element | null>(null);

  const profiles = kind === "artist" ? artists : kind === "dealer" ? dealers : [];
  const open = kind !== null;

  React.useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement;
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setKind(null);
      }
    }

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const restore = restoreFocusRef.current;
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, [open]);

  return (
    <>
      <a
        href="/#artists"
        onClick={(e) => {
          e.preventDefault();
          setKind("artist");
        }}
      >
        <Palette className="nav-icon" aria-hidden />
        <span>Artists</span>
      </a>
      <a
        href="/#dealers"
        onClick={(e) => {
          e.preventDefault();
          setKind("dealer");
        }}
      >
        <Store className="nav-icon" aria-hidden />
        <span>Dealers</span>
      </a>

      {open && (
        <div
          className="ifac-dir-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={kind === "artist" ? "Artists" : "Dealers"}
          onClick={() => setKind(null)}
        >
          <div className="ifac-dir-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ifac-dir-modal-head">
              <h2>{kind === "artist" ? "Artists" : "Dealers"}</h2>
              <button
                ref={closeRef}
                type="button"
                className="ifac-dir-modal-close"
                aria-label="Close"
                onClick={() => setKind(null)}
              >
                &#10005;
              </button>
            </div>

            <div className="ifac-dir-modal-grid">
              {profiles.map((p) => (
                <a key={p.slug} className="ifac-dir-card" href={`/${kind}s/${p.slug}`}>
                  {p.portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ifac-dir-card-portrait" src={p.portrait} alt="" loading="lazy" />
                  ) : (
                    <span className="ifac-dir-card-portrait ifac-dir-card-portrait--empty" aria-hidden>
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="ifac-dir-card-body">
                    <span className="ifac-dir-card-name">{p.name}</span>
                    {p.role && <span className="ifac-dir-card-role">{p.role}</span>}
                    {p.bio[0] && <span className="ifac-dir-card-bio">{p.bio[0]}</span>}
                    <span className="ifac-dir-card-more">See more &rarr;</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
