import Link from "next/link";

/**
 * The three pages every org subdomain has, whatever its tier: the offering it
 * is promoting now, who the org is, and the wider scene around it. Rendered on
 * each so the set is always visible — the site is small on purpose.
 */
export function SiteNav({
  orgName,
  current,
  mainSiteUrl,
}: {
  orgName: string;
  current: "offering" | "profile" | "community";
  mainSiteUrl?: string | null;
}) {
  const tabs = [
    { key: "offering", href: "/offering", label: "Offering" },
    { key: "profile", href: "/profile", label: "Profile" },
    { key: "community", href: "/community", label: "Community" },
  ] as const;

  return (
    <header className="border-b border-border">
      {mainSiteUrl && (
        <div className="border-b border-border bg-accent/30">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-2 text-sm">
            <span className="text-muted-foreground">
              This is a summary of {orgName} on the collective.
            </span>
            <a
              href={mainSiteUrl}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Visit {mainSiteUrl.replace(/^https?:\/\//, "")} →
            </a>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/offering" className="font-serif text-xl text-foreground">
          {orgName}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.key === current ? "page" : undefined}
              className={
                t.key === current
                  ? "rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground"
                  : "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
