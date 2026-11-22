import type { Metadata } from "next";
import { ArtistHomeView } from "@/components/mobile/artist-home-view";
import { ArtistTabBar } from "@/components/mobile/board-nav";
import { getAvailability, listMyExperiences } from "@/lib/artist-wizard";
import { listInvitations } from "@/lib/collaborate";
import { requireOrgMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My page", robots: { index: false, follow: false } };

/** Artist home (G7c): members only. Phone design in a centred 480px column on desktop. */
export default async function ArtistHomePage() {
  const viewer = await requireOrgMember("/artist");
  const [availability, mine, inv] = await Promise.all([
    getAvailability(), listMyExperiences(), listInvitations({ artistUserId: viewer.userId, upcomingOnly: true }),
  ]);
  return (
    <div className="elk-m m-col">
      <ArtistHomeView
        name=""
        email={viewer.email}
        availability={availability}
        experiences={mine.map((e) => ({ id: e.id, title: e.title, state: e.state, label: e.label, notes: e.notes }))}
        invitationCount={inv.filter((i) => i.status === "proposed").length}
      />
      <ArtistTabBar waiting={inv.filter((i) => i.status === "proposed").length} />
    </div>
  );
}
