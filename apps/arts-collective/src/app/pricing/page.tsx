import { SiteShell } from "@/components/site-shell";
import { JoinTiers } from "@/components/hub/JoinTiers";
import { getCurrentUser } from "@/lib/session";

/** Reads the session cookie (the tier buttons differ when signed in). */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing · Elkdonis Arts Collective",
};

/**
 * The join tiers on a page of their own, so the landing's Hub button has
 * somewhere to send a visitor who is not yet an owner or guide of an org.
 * The same component renders on /hub/organization for signed-out visitors.
 */
export default async function PricingPage() {
  const user = await getCurrentUser();
  return (
    <SiteShell wide>
      <div className="mx-auto w-full max-w-6xl px-6">
        <JoinTiers signedIn={Boolean(user)} />
      </div>
    </SiteShell>
  );
}
