import Link from "next/link";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";

export default async function OnboardingPage() {
  await requireUser();

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-6 py-20">
        <header className="mb-12 space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Welcome to Arts Collective
          </p>
          <h1 className="font-serif text-4xl leading-tight text-foreground">
            What brings you here?
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
            You&apos;re already part of the network. Now choose how you&apos;d
            like to be present on Arts Collective.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* ── Start an org ── */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-7">
            <div className="space-y-2">
              <h2 className="font-serif text-xl leading-snug text-foreground">
                Start an organization
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Claim a subdomain, publish your site, list workshops, and manage
                your own corner of the collective. You become the owner and can
                invite collaborators.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>→ Your own site at <code className="font-mono text-foreground">yourname.artscollective.org</code></li>
                <li>→ Silex visual editor + workshop publishing</li>
                <li>→ Nextcloud media storage</li>
              </ul>
            </div>
            <div className="mt-auto pt-2">
              <Button asChild className="w-full">
                <Link href="/signup/setup">Set up my organization</Link>
              </Button>
            </div>
          </div>

          {/* ── Org-agnostic member ── */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-7">
            <div className="space-y-2">
              <h2 className="font-serif text-xl leading-snug text-foreground">
                Browse as a member
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Access the community feed, attend workshops, explore artist
                pages, and participate across the network without running your
                own site.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>→ Community feed and events</li>
                <li>→ Artist directory</li>
                <li>→ Cross-network participation</li>
              </ul>
            </div>
            <div className="mt-auto pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/community">Enter as member</Link>
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          You can always start an organization later from your account settings.
        </p>
      </div>
    </SiteShell>
  );
}
