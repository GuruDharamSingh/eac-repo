import Link from "next/link";
import { SetupForm } from "@/app/signup/setup/setup-form";

/**
 * The three ways to join the collective, shown on the Organization tab to
 * anyone who does not yet have an org — signed out or signed in.
 *
 * Copy here makes commitments (price, the studio agreement, what a partnership
 * involves), so it is kept in one place rather than scattered through JSX, and
 * is meant to be edited by the collective rather than treated as final.
 */

type Tier = {
  id: "free" | "supported" | "partner";
  name: string;
  price: string;
  priceNote: string | null;
  pitch: string;
  includes: string[];
  featured: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "No cost",
    priceNote: null,
    pitch:
      "Your own corner of the collective — a subdomain and a three-page site, plus both hubs.",
    includes: [
      "Your site at yourname.arts-collective.com",
      "An offerings page for what you're running now",
      "A profile page archiving previous offerings",
      "An about page for you or your group",
      "Your organisation hub — members, publishing, media",
      "The community hub — the wider scene around you",
    ],
    featured: true,
  },
  {
    id: "supported",
    name: "Supported",
    price: "$1–2 / month",
    priceNote: "payable through commission",
    pitch:
      "Everything in Free, plus hands-on help making the site genuinely yours.",
    includes: [
      "Everything in the free tier",
      "A site-building agreement with Guru Dharam's studio",
      "Direct assistance personalising your site",
      "Design and layout work beyond the standard template",
    ],
    featured: false,
  },
  {
    id: "partner",
    name: "Partner",
    price: "By arrangement",
    priceNote: null,
    pitch:
      "For established organisations building something with us, not just hosted by us.",
    includes: [
      "Partnership serving both the collective and your organisation",
      "Original work rooted in the communities you serve",
      "Deeper collaboration with our open-source codebase",
      "Built and maintained together",
    ],
    featured: false,
  },
];

export function JoinTiers({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="w-full py-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Organisation
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground">
          Claim your corner of the collective.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Three ways to join. Each one starts with a short conversation with the
          collective — we like to know who we&apos;re building alongside.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} signedIn={signedIn} />
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        Every tier includes an intake interview. Your site is set up right away
        and goes public once we&apos;ve spoken — it stays visible to you in the
        meantime.
      </p>
    </div>
  );
}

function TierCard({ tier, signedIn }: { tier: Tier; signedIn: boolean }) {
  return (
    <div
      className={`flex flex-col rounded-md border bg-card p-6 ${
        tier.featured ? "border-foreground/40 shadow-sm" : "border-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-foreground">{tier.name}</h2>
        {tier.featured && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Start here
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-lg font-semibold text-foreground">{tier.price}</p>
        {tier.priceNote && (
          <p className="text-xs text-muted-foreground">{tier.priceNote}</p>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {tier.pitch}
      </p>

      <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
        {tier.includes.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-foreground/40">
              &rarr;
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {/* Signed in: every tier sets the org up right here, tagged with the
            tier asked for — /login would only bounce a signed-in person back
            to /hub. Signed out: the account comes first. */}
        {signedIn ? (
          <SetupForm tier={tier.id} />
        ) : tier.id === "free" ? (
          <Link
            href="/login?mode=signup"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create your account
          </Link>
        ) : (
          <Link
            href={`/login?mode=signup&tier=${tier.id}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Start a conversation
          </Link>
        )}
      </div>
    </div>
  );
}
