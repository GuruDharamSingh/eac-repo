import type { Metadata } from "next";
import Link from "next/link";
import "@elkdonis/cms-ui/data-policy.css";
import { DataPolicy } from "@elkdonis/cms-ui/data-policy";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Your data",
  description: "What the Elkdonis Arts Collective keeps about you, why, and how to have it removed.",
};

export const POLICY_UPDATED = "2026-10-29";
export const CONTACT_EMAIL = "info@elkdonis-arts.org";

/**
 * The data policy (shared text in @elkdonis/cms-ui/data-policy), in this
 * site's page frame. Registered with Meta as the app's privacy policy URL.
 */
export default function DataPage() {
  return (
    <div className="ig-page">
      <p className="ig-kicker">Policy</p>
      <h1>Your data</h1>
      <p className="ig-lead" style={{ marginTop: "1.5rem" }}>
        We value your data. We do not hold you captive, and you are always free to leave.
      </p>
      <hr className="saffron-divider" />
      <div className="ig-prose" style={{ ["--policy-heading-face" as string]: '"Venture", Georgia, serif' }}>
        <DataPolicy
          orgName={siteConfig.orgName}
          host="elkdonis-arts.org"
          contactEmail={CONTACT_EMAIL}
          updated={POLICY_UPDATED}
        />
        <p style={{ marginTop: "2.5rem" }}>
          <Link className="ig-edit-link" href="/data/delete">Deleting your data →</Link>
        </p>
      </div>
    </div>
  );
}
