import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-serif text-lg">{siteConfig.name}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {siteConfig.description}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/artworks" className="underline-offset-4 hover:underline">
            Browse artworks
          </Link>
          <Link href="/lots" className="underline-offset-4 hover:underline">
            Live auctions
          </Link>
          <Link href="/artists" className="underline-offset-4 hover:underline">
            Artists
          </Link>
        </nav>
      </div>
    </footer>
  );
}
