import type { Metadata } from "next";
import { InvitationsView, type InvitationRow } from "@/components/mobile/invitations-view";
import { listInvitations } from "@/lib/collaborate";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitations", robots: { index: false, follow: false } };

const fee = (cents: number | null, unit: string, currency: string | null) =>
  cents == null
    ? null
    : `${new Intl.NumberFormat("en-GB", { style: "currency", currency: (currency ?? "eur").toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)} ${unit === "per_guest" ? "per guest" : "per run"}`;

/** The artist's own invitations (Board screen 30), with accept and decline. Editors see every artist's. */
export default async function InvitationsPage() {
  const viewer = await requireOrgEditor();
  const isOffice = viewer.role === "owner";
  const list = await listInvitations(isOffice ? { upcomingOnly: true } : { artistUserId: viewer.userId, upcomingOnly: true });
  const rows: InvitationRow[] = list
    .filter((i) => i.status === "proposed" || i.status === "accepted")
    .map((i) => ({
      id: i.id,
      status: i.status,
      experienceTitle: i.experience.title,
      tourTitle: i.tour.title,
      stop: i.stop ? { position: i.stop.number, title: i.stop.title } : null,
      startsAt: i.startsAt,
      arrivalAt: i.arrivalAt,
      artistName: i.artist.name, guideName: i.guide?.name ?? null,
      feeLabel: fee(i.feeCents, i.unit, i.currency),
      guestsBooked: i.guestsBooked,
    }));
  return (
    <div className="elk-m">
      <InvitationsView rows={rows} isArtistView={!isOffice} />
    </div>
  );
}
