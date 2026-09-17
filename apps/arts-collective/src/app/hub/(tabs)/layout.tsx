import { SiteShell } from "@/components/site-shell";
import { HubTabNav } from "@/components/hub/HubTabNav";

/**
 * No auth gate here on purpose. Each tab enforces its own: elkdonis and network
 * still require a user, while organization renders the join tiers to signed-out
 * visitors. Gating the shared layout would make that impossible.
 */
export default async function HubTabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SiteShell wide>
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <HubTabNav />
        {children}
      </div>
    </SiteShell>
  );
}
