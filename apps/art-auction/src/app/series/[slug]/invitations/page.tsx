import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSeriesBySlug } from "@elkdonis/commerce/queries";
import { listSeriesInvitationsFor } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { InvitationList } from "./invitation-list";
import "../manage/workspace.css";

export const dynamic = "force-dynamic";

/**
 * Where an organisation's owner answers a series' invitation (migration
 * 212). Linked from the message and the email the desk's "Add an
 * organisation" sends. Lists every open invitation for orgs this person runs.
 */
export default async function InvitationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=/series/${slug}/invitations`);
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  const invitations = await listSeriesInvitationsFor(userId);
  return (
    <div className="sw" style={{ minHeight: "60vh" }}>
      <main className="sw-main" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="sw-main-inner">
          <div>
            <p className="sw-eyebrow">Auction series</p>
            <h1 className="sw-h1">Invitations</h1>
            <p className="sw-sub">Organisations you run that have been asked to take part in a series.</p>
          </div>
          <InvitationList invitations={invitations} currentSlug={series.slug} />
          <p className="sw-muted"><Link href={`/series/${series.slug}`}>Back to {series.title}</Link></p>
        </div>
      </main>
    </div>
  );
}
