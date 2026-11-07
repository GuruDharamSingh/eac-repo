import type { Metadata } from "next";
import Link from "next/link";
import "@elkdonis/cms-ui/data-policy.css";
import { Terms } from "@elkdonis/cms-ui/data-policy";
import { getNetworkTerms } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Terms and Acceptable Use" };
export const dynamic = "force-dynamic";

export const TERMS_UPDATED = "2026-11-01";

/** The network's Terms and Acceptable Use (migration 223), in this site's frame. */
export default async function TermsPage() {
  const terms = await getNetworkTerms();
  return (
    <div className="ig-page">
      <p className="ig-kicker">Terms</p>
      <h1>Terms and Acceptable Use</h1>
      <p className="ig-lead" style={{ marginTop: "1.5rem" }}>
        Short, and written to be read. Accepted when an account is created on the network.
      </p>
      <hr className="saffron-divider" />
      <div className="ig-prose" style={{ ["--policy-heading-face" as string]: '"Venture", Georgia, serif' }}>
        <Terms orgName={siteConfig.orgName} host="elkdonis-arts.org" contactEmail="info@elkdonis-arts.org" updated={TERMS_UPDATED} version={terms?.version ?? 1} dataHref="/data" />
        <p style={{ marginTop: "2.5rem" }}>
          <Link className="ig-edit-link" href="/data">Your data →</Link>
        </p>
      </div>
    </div>
  );
}
