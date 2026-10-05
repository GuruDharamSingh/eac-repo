import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getEditableOrgsForUser } from "@/lib/org";
import { forumBase } from "@/lib/elkdonis-hub";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";

/** Reads the session cookie: the buttons differ by who is signed in. */
export const dynamic = "force-dynamic";

/**
 * The arts-collective.com landing since 2026-10-03: one promotional page for
 * starting a collective. The network newsroom that was here moved to the
 * hub's Community tab (/hub/network, components/hub/NewsroomSection.tsx).
 */

const OFFERINGS = [
  {
    title: "Stripe checkout",
    body: "Sell work, tickets and workshops, paid straight to your collective.",
  },
  {
    title: "Email services",
    body: "Reach your members and the people who follow your work.",
  },
  {
    title: "Subdomain hosting",
    body: "A site of your own on arts-collective.com, or on your own domain.",
  },
  {
    title: "Workshop creation",
    body: "Set up workshops and take bookings online.",
  },
] as const;

export default async function LandingPage() {
  const user = await getCurrentUser();
  const editableOrgs = user ? await getEditableOrgsForUser(user.id) : [];

  // The hub is for people running an org. Anyone else is sent to the tiers,
  // which is where running one starts.
  const hubHref = editableOrgs.length > 0 ? "/hub" : "/pricing";

  const network = [
    {
      name: "The Grand Forum",
      href: forumBase(),
      body: "Discussion across every collective, with the network wiki and dictionary.",
    },
    {
      name: "ArtDirect",
      href: process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? null,
      body: "The directory of the network's artists and their pages.",
    },
    {
      name: "Art Auction",
      href: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? null,
      body: "The collective's market for members' work.",
    },
  ].filter((n): n is typeof n & { href: string } => Boolean(n.href));

  return (
    <SiteShell wide>
      {/* Hero */}
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Elkdonis Arts Collective · a not-for-profit
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] text-foreground sm:text-7xl">
            Create a Collective
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Elkdonis seeks to provide the online tools and server to help
            community leaders emerge. We keep track of the efforts of our
            members, and of their members, because simply showing up is half
            the battle when it comes to keeping communities going.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={hubHref}>Start your own collective</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={user ? "/hub/network" : "/login?mode=signup"}>
                Participate in Elkdonis
              </Link>
            </Button>
            {!user && (
              <Link
                href="/login"
                className="ml-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-b border-border/60 bg-card">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 md:grid-cols-[1fr_1.4fr]">
          <h2 className="font-serif text-3xl leading-tight text-foreground">
            We stand together.
          </h2>
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              As an arts collective and a not-for-profit, our main mission is
              to encourage one another to share our work, and to bring
              attention to what is happening in the objective world of art.
            </p>
            <p>
              Most of all we stand together, to share risk and trust, and we
              reach out to artists who are less online, to be sure the market
              sees them too.
            </p>
          </div>
        </div>
      </section>

      {/* What we provide */}
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            To this end we provide
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERINGS.map((o) => (
              <li key={o.title} className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-serif text-lg text-foreground">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The network */}
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Across the network
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {network.map((n) => (
              <li key={n.name}>
                <a
                  href={n.href}
                  className="flex h-full flex-col rounded-lg border border-border p-5 transition-colors hover:border-primary hover:bg-card"
                >
                  <span className="font-serif text-xl text-foreground">{n.name} →</span>
                  <span className="mt-1 font-mono text-xs text-muted-foreground">
                    {n.href.replace(/^https?:\/\//, "")}
                  </span>
                  <span className="mt-3 text-sm leading-relaxed text-muted-foreground">{n.body}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/hub/network">Community</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={hubHref}>Hub</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Data notice */}
      <section>
        <div className="mx-auto w-full max-w-5xl px-6 py-10 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">We value your data.</span>{" "}
            We do not hold you captive, and you are always free to leave.{" "}
            <Link href="/data" className="underline underline-offset-4 hover:text-foreground">
              Read the policy
            </Link>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
