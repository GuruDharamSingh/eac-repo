import type { Metadata } from "next";
import Link from "next/link";
import "@elkdonis/cms-ui/data-policy.css";
import { Terms } from "@elkdonis/cms-ui/data-policy";
import { getNetworkTerms } from "@elkdonis/services";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = { title: "Terms and Acceptable Use" };
export const dynamic = "force-dynamic";

export const TERMS_UPDATED = "2026-11-01";

/** The network's Terms and Acceptable Use (migration 223), on arts-collective.com. */
export default async function TermsPage() {
  const terms = await getNetworkTerms();
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl py-14">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">The Elkdonis Arts Collective</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground">Terms and Acceptable Use</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Short, and written to be read. Accepted when an account is created on the network.
        </p>
        <div className="mt-10 text-sm text-foreground" style={{ ["--policy-heading-face" as string]: "var(--font-serif, Georgia, serif)" }}>
          <Terms orgName="The Elkdonis Arts Collective" host="arts-collective.com" contactEmail="info@elkdonis-arts.org" updated={TERMS_UPDATED} version={terms?.version ?? 1} dataHref="/data" />
        </div>
        <p className="mt-12 text-sm">
          <Link href="/data" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Data policy</Link>
          {" · "}
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to arts-collective.com</Link>
        </p>
      </article>
    </SiteShell>
  );
}
