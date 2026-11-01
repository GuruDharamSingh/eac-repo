import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { db } from "@elkdonis/db";
import { HubCardGrid, HubLinkCard, HubPageFrame } from "@elkdonis/cms-ui/hubsite";
import { getViewerCloud } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { NEXTCLOUD_SIGN_IN } from "@/lib/hub-links";

export const metadata: Metadata = { title: "Organization · Hub" };
export const dynamic = "force-dynamic";

/**
 * Organization (owner, 2026-10-08): the setup a member does once, and the
 * site's own errands.
 *
 *   Nextcloud  per person: linked or not, the sign-in that creates the
 *              account, and the two folders.
 *   Payments   per person, not per org (users.stripe_account_id): the
 *              Payouts tab of the profile popup, opened by `?surface=` — the
 *              SurfaceProvider in the root layout reads it on any page.
 *   The site   Manage, email, analytics — editors (analytics: owners).
 */
export default async function HubOrganizationPage() {
  const viewer = await requireOrgMember("/hub/organization");
  const [cloud, [payouts]] = await Promise.all([
    getViewerCloud(viewer.userId, siteConfig.orgId).catch(() => null),
    db<Array<{ stripe_account_id: string | null; stripe_onboarded_at: Date | null }>>`
      SELECT stripe_account_id, stripe_onboarded_at FROM users WHERE id = ${viewer.userId}
    `.catch(() => [] as Array<{ stripe_account_id: string | null; stripe_onboarded_at: Date | null }>),
  ]);
  const payoutState = payouts?.stripe_onboarded_at
    ? "Set up — you can be paid."
    : payouts?.stripe_account_id
      ? "Started, not finished."
      : "Not set up.";

  return (
    <HubPageFrame
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Organization" }]}
      title="Organization"
      intro={<p>Your Nextcloud and payments, and running {siteConfig.orgName}.</p>}
    >
      <section className="eac-hp-panel" aria-labelledby="org-nc">
        <h2 id="org-nc">Nextcloud</h2>
        <p>
          <span className="eac-hp-status">{cloud?.linked ? "Connected." : "Not set up yet."}</span>{" "}
          {cloud?.linked
            ? "Your Nextcloud account is linked. The group folder and your own folder are below."
            : `Sign in to Nextcloud with your ${siteConfig.orgName} account; the first sign-in creates your Nextcloud account.`}
        </p>
        <div className="eac-nc-actions">
          {NEXTCLOUD_SIGN_IN ? (
            <a className="eac-nc-btn eac-nc-btn--primary" href={NEXTCLOUD_SIGN_IN} target="_blank" rel="noopener">
              Sign in to Nextcloud
            </a>
          ) : null}
          {cloud?.linked ? (
            <>
              <a className="eac-nc-btn" href={cloud.teamFolderUrl} target="_blank" rel="noopener">
                Group folder ↗
              </a>
              {cloud.personalFolderUrl ? (
                <a className="eac-nc-btn" href={cloud.personalFolderUrl} target="_blank" rel="noopener">
                  My folder ↗
                </a>
              ) : null}
            </>
          ) : null}
          <a className="eac-nc-btn" href="/hub/files">
            Files in the hub
          </a>
        </div>
      </section>

      <section className="eac-hp-panel" aria-labelledby="org-pay">
        <h2 id="org-pay">Payments</h2>
        <p>
          <span className="eac-hp-status">{payoutState}</span> Payouts go through Stripe to your own account, for
          workshops, services and anything you sell on the network.
        </p>
        <div className="eac-nc-actions">
          <a className="eac-nc-btn eac-nc-btn--primary" href="/hub/organization?surface=profile:payouts">
            {payouts?.stripe_onboarded_at ? "Manage payouts" : "Set up payouts"}
          </a>
        </div>
      </section>

      {viewer.canEdit ? (
        <section className="eac-hp-section" aria-labelledby="org-site">
          <h2 id="org-site" className="eac-hp-section-title">
            Running the site
          </h2>
          <HubCardGrid label="Running the site">
            <HubLinkCard href="/manage" glyph="◈" title="Manage the site" blurb="People and access, content, site copy." />
            <HubLinkCard href="/hub/email" glyph="✉" title="Email & newsletter" blurb="Letters, addresses and what has been sent." />
            {viewer.role === "owner" ? (
              <HubLinkCard href="/manage/analytics" glyph="▥" title="Analytics" blurb="Who visits, and what they read." />
            ) : null}
          </HubCardGrid>
        </section>
      ) : null}
    </HubPageFrame>
  );
}
