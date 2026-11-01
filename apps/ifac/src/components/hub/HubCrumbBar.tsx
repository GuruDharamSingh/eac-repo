import "@elkdonis/cms-ui/hubsite.css";
import "./hub-crumb-bar.css";
import { Home, Info, MessagesSquare } from "lucide-react";
import { HubCrumbs, type HubCrumb } from "@elkdonis/cms-ui/hubsite";
import { listDirectory } from "@/lib/directory";
import { DirectoryNavModal } from "@/components/directory-nav-modal";

/**
 * The header of a hub subpage (owner, 2026-10-10): a breadcrumb in place of
 * the site's button nav. The crumbs are cms-ui's shared `HubCrumbs`
 * (hubsite.css `.eac-hp-crumbs`, the same row innergathering's card pages
 * use). The old site links (Home, About, Artists, Dealers, Forum) sit in a
 * small menu at the start of the row; Artists and Dealers keep their
 * directory popup. `/hub` itself keeps `SiteHeader`.
 *
 * Render it as the first child of `<main className="hub">`, so it sits on
 * the hub's light ground and takes `.ifac-hub-scope`'s tokens.
 */
export async function HubCrumbBar({ items }: { items: HubCrumb[] }) {
  const [artists, dealers] = await Promise.all([listDirectory("artist"), listDirectory("dealer")]);

  return (
    <div className="ifac-crumbbar">
      <details className="ifac-crumbbar__menu">
        <summary aria-label="IFAC site menu" title="IFAC site">
          <span className="ifac-crumbbar__seal">IFAC</span>
          <svg className="ifac-crumbbar__chev" viewBox="0 0 12 12" aria-hidden>
            <path d="M2.5 4.5 6 8l3.5-3.5" />
          </svg>
        </summary>
        <nav className="ifac-crumbbar__sheet" aria-label="Site">
          <a href="/">
            <Home aria-hidden />
            <span>Home</span>
          </a>
          <a href="/about">
            <Info aria-hidden />
            <span>About</span>
          </a>
          <DirectoryNavModal artists={artists} dealers={dealers} />
          <a href="/forum">
            <MessagesSquare aria-hidden />
            <span>Forum</span>
          </a>
        </nav>
      </details>
      <HubCrumbs items={items} />
    </div>
  );
}
