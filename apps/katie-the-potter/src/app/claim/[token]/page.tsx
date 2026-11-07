import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { peekClaim } from "@/lib/manage-claim";
import { ClaimConfirm } from "@/components/claim-confirm";
import { SignOutButton } from "@/components/sign-out-button";
import "../../manage/manage.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Claim the shop", robots: { index: false, follow: false } };

const WHY: Record<string, string> = {
  used: "This link has already been used.",
  expired: "This link has expired. Ask for a new one.",
  revoked: "This link was replaced by a newer one. Ask for the latest link.",
  unknown: "This link isn't valid. Check that it was copied whole.",
};

/**
 * /claim/<token>: the receiving end of the hand-over. Signed out, the person
 * signs in (or creates an account; signing up here joins as a follower) and
 * comes back. Signed in, they see what will change and confirm. The token is
 * checked again when they confirm (lib/manage-claim.ts redeemClaim), in the
 * same transaction that moves the shop.
 */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await peekClaim(token);

  if (claim.state !== "valid") {
    return (
      <div className="ktp-m ktp-m--narrow">
        <h1 className="ktp-m-title">Claim the shop</h1>
        <section className="ktp-m-card">
          <p>{WHY[claim.state]}</p>
          <p className="ktp-m-actions">
            <Link className="ktp-btn ktp-btn--ghost" href="/">
              Go to the site
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const viewer = await getViewer().catch(() => null);
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/claim/${token}`)}&mode=signup`);

  return (
    <div className="ktp-m ktp-m--narrow">
      <h1 className="ktp-m-title">Claim {siteConfig.orgName}</h1>
      <section className="ktp-m-card">
        {viewer.role === "owner" ? (
          <>
            <p>
              You are signed in as <b>{viewer.email}</b>, which already owns this site. This link is for the person the shop is being handed to: sign out
              and open it again as them.
            </p>
            <p className="ktp-m-actions">
              <SignOutButton />
            </p>
          </>
        ) : (
          <>
            <p>
              You are signed in as <b>{viewer.email}</b>. Confirming makes this account the owner of {siteConfig.orgName}:
            </p>
            <ul className="ktp-m-bullets">
              <li>you can manage the site, its pieces, orders and payouts at /manage;</li>
              <li>the shop&rsquo;s store on Collect Art becomes yours, and its pieces are credited to you;</li>
              <li>card sales are paid to you once you set up payouts.</li>
            </ul>
            <p className="ktp-m-fine">The link works once. It is open until {new Date(claim.expiresAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })}.</p>
            <ClaimConfirm token={token} />
          </>
        )}
      </section>
    </div>
  );
}
