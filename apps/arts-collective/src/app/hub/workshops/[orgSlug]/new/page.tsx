import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";
import { SiteShell } from "@/components/site-shell";
import { WorkshopForm } from "@/components/hub/WorkshopForm";
import { db } from "@elkdonis/db";
import Link from "next/link";

export default async function NewWorkshopPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();

  const orgs = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
  `;
  const org = orgs[0];
  if (!org) redirect("/hub");

  const allowed = await canEditOrgSite(user.id, org.id);
  if (!allowed) redirect("/hub");

  return (
    <SiteShell>
      <div className="py-4">
        <div className="mb-4 px-6">
          <Link
            href={`/hub/workshops/${orgSlug}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Workshops
          </Link>
        </div>
        <WorkshopForm orgSlug={orgSlug} />
      </div>
    </SiteShell>
  );
}
