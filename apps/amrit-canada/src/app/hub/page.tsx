import type { Metadata } from "next";
import { getProfile } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HubCard } from "@/components/hub/HubCard";
import { HUB_CARDS, type CardStatus, type HubCard as HubCardData } from "@/lib/hub-cards";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013";

export default async function HubPage() {
  const viewer = await requireOrgMember("/hub");
  const profile = await getProfile(viewer.userId);

  function statusFor(card: HubCardData): CardStatus {
    if (card.id === "my_profile") return profile?.slug ? "complete" : "not_started";
    return card.available ? "not_started" : "locked";
  }

  function hrefFor(card: HubCardData): string | null {
    if (card.id === "my_profile") {
      // Bootstrap path for someone who hasn't chosen a slug yet — /account is
      // where ProfileEditForm actually lets them set one.
      return profile?.slug ? `${ARTDIRECT_URL}/${profile.slug}` : "/account";
    }
    return card.href;
  }

  const visibleCards = HUB_CARDS.filter((c) => !c.adminOnly || viewer.canEdit);
  const mainCards = visibleCards.filter((c) => !c.wide);
  const wideCards = visibleCards.filter((c) => c.wide);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.orgName}</p>
      <h1 className="mt-1 font-serif text-3xl">Hub</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Manage your profile and files, and help shape what the community works on next.
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        {mainCards.map((card) => (
          <HubCard key={card.id} card={{ ...card, href: hrefFor(card) }} status={statusFor(card)} />
        ))}
      </div>

      {wideCards.length > 0 && (
        <div className="mt-6 space-y-4">
          {wideCards.map((card) => (
            <HubCard key={card.id} card={{ ...card, href: hrefFor(card) }} status={statusFor(card)} />
          ))}
        </div>
      )}
    </div>
  );
}
