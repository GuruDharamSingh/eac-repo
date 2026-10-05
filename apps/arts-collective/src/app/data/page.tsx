import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export const metadata = {
  title: "Your data · Elkdonis Arts Collective",
};

/**
 * The data notice linked from the landing footer. Each statement here is
 * either a fact about the platform (cookieless analytics: packages/analytics)
 * or a commitment the collective has made; keep it to those.
 */
export default function DataPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl py-14">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Policy
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground">
          We value your data.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          We do not hold you captive, and you are always free to leave.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="font-serif text-xl">What is yours stays yours</h2>
            <p className="text-muted-foreground">
              The work, writing and files you put on the network belong to you
              and to the collective you publish them with. The Elkdonis Arts
              Collective is a not-for-profit; we do not sell your data or
              hand it to advertisers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl">What we count</h2>
            <p className="text-muted-foreground">
              We keep track of who shows up — attendance, membership and
              what members publish — because that record is how communities
              see their own effort and keep going. Visits to the sites are
              counted without cookies, and your IP address is not stored.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl">Leaving</h2>
            <p className="text-muted-foreground">
              If you want to go, ask an organiser of your collective or the
              network administrators. We will give you a copy of your files
              and what you have published, and remove your account.
            </p>
          </section>
        </div>

        <p className="mt-12 text-sm">
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            ← Back to arts-collective.com
          </Link>
        </p>
      </article>
    </SiteShell>
  );
}
