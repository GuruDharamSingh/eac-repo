import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

/** Which nav item the page belongs to. */
export type NavKey = "all" | "person" | "organization" | "new" | "login";

const NAV: Array<{ key: NavKey; href: string; label: string }> = [
  { key: "all", href: "/", label: "Directory" },
  { key: "person", href: "/?entity=person", label: "Artists" },
  { key: "organization", href: "/?entity=organization", label: "Organizations" },
];

/**
 * The directory's masthead: wordmark, the three ways into the listing, and
 * the account. The dossier pages keep their own template nav (it is part of
 * the file's look), so this sits on the directory, form and sign-in pages.
 */
export async function SiteHeader({ current }: { current?: NavKey }) {
  const user = await getCurrentUser();
  return <SiteHeaderView current={current} signedIn={Boolean(user)} />;
}

/** The markup, apart from the session read, so it can be previewed without one. */
export function SiteHeaderView({ current, signedIn }: { current?: NavKey; signedIn: boolean }) {
  const networkUrl = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL;

  return (
    <header className="ad-header">
      {networkUrl && (
        <div className="ad-network-bar">
          <a href={networkUrl}>Elkdonis Arts Collective</a>
          <span aria-hidden="true">/</span>
          <span>ArtDirect</span>
        </div>
      )}
      <div className="ad-header-inner">
        <Link href="/" className="ad-wordmark" aria-label="ArtDirect — directory home">
          ArtDirect
        </Link>
        <nav className="ad-nav" aria-label="Directory">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="ad-nav-link"
              aria-current={current === item.key ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <span className="ad-nav-gap" aria-hidden="true" />
          <Link href="/new" className="ad-nav-link" data-variant="stamp" aria-current={current === "new" ? "page" : undefined}>
            Open a file
          </Link>
          {signedIn ? (
            <SignOutButton />
          ) : (
            <Link href="/login" className="ad-nav-link" aria-current={current === "login" ? "page" : undefined}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
