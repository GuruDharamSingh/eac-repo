import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/", label: "Sky" },
  { href: "/calculate", label: "Calculate" },
  { href: "/charts", label: "Your charts" },
  { href: "/services", label: "Readings" },
  { href: "/people", label: "People" },
];

export function SiteHeader({ signedIn, isMember }: { signedIn: boolean; isMember: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span aria-hidden className="glyph text-xl text-primary">
            {"☉︎"}
          </span>
          <span className="font-display text-lg font-semibold tracking-wider">{siteConfig.orgName}</span>
        </Link>

        <nav className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap text-sm [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3"
            >
              {item.label}
            </Link>
          ))}
          {isMember && (
            <Link
              href="/hub"
              className="rounded-md px-3 py-2 font-medium text-primary transition-colors hover:bg-accent"
            >
              Hub
            </Link>
          )}
          <span className="ml-1 shrink-0 sm:ml-2">
            {signedIn ? (
              <SignOutButton />
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </span>
        </nav>
      </div>
    </header>
  );
}
