import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ShellUserMenu } from "@/components/shell-user-menu";

/**
 * The network's own chrome. The other two centralising sites — ArtDirect (the
 * people directory) and the market — are separate apps on their own hosts, so
 * they are plain links, shown only when their URL is configured.
 */
export async function SiteShell({
  children,
  /**
   * Let the page own its own width and gutters.
   *
   * The shell's `max-w-5xl px-6` is right for a reading page, but a page that
   * set its own `max-w-6xl px-6` inside it got neither: the 6xl was clamped to
   * 5xl and the two `px-6` stacked into a 48px gutter on each side. Every hub
   * tab was doing exactly that. Rather than silently shrink such a page, this
   * hands the column over — the page is then responsible for centring itself.
   */
  wide = false,
}: Readonly<{
  children: React.ReactNode;
  wide?: boolean;
}>) {
  const user = await getCurrentUser();
  const directoryUrl = process.env.NEXT_PUBLIC_ARTDIRECT_URL;
  const marketUrl = process.env.NEXT_PUBLIC_ART_AUCTION_URL;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link
            href={user ? "/hub" : "/"}
            className="font-serif text-lg tracking-wide text-foreground"
          >
            Elkdonis Arts Collective
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            {directoryUrl && (
              <a href={directoryUrl} className="hover:text-foreground">
                Directory
              </a>
            )}
            {marketUrl && (
              <a href={marketUrl} className="hover:text-foreground">
                Market
              </a>
            )}
            {user && <ShellUserMenu email={user.email} />}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {wide ? children : <div className="mx-auto max-w-5xl px-6">{children}</div>}
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Elkdonis Arts Collective
        </div>
      </footer>
    </div>
  );
}
