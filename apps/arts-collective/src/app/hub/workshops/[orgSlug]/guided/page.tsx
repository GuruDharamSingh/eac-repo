import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@elkdonis/db";
import {
  buildWorkshopWizardSteps,
  toWizardUiSteps,
} from "@elkdonis/cms-bindings";
import { loadTemplateManifest } from "@elkdonis/cms-bindings/node";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";
import { SiteShell } from "@/components/site-shell";
import { GuidedWorkshopWizard } from "@/components/hub/GuidedWorkshopWizard";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

/**
 * The guided workshop authoring flow — the default path for an owner creating a
 * workshop.
 *
 * Steps are derived from the active template's manifest, so a template that
 * consumes fewer fields produces a shorter wizard and a new template needs no
 * code here. WorkshopForm (`/new`) remains as the advanced, all-at-once surface.
 */
export default async function GuidedWorkshopPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ threadId?: string }>;
}) {
  const { orgSlug } = await params;
  const { threadId } = await searchParams;
  const user = await requireUser();

  const orgs = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
  `;
  const org = orgs[0];
  if (!org) redirect("/hub");
  if (!(await canEditOrgSite(user.id, org.id))) redirect("/hub");

  // Editing an existing workshop: seed the wizard from the saved row so the
  // draft cache can only win when it is genuinely newer (WizardProvider
  // compares against serverUpdatedAt).
  let initialAnswers: Record<string, unknown> | undefined;
  let serverUpdatedAt: string | null = null;
  let optionalSections: Record<string, boolean> | undefined;

  if (threadId) {
    const rows = await db<
      { updated_at: Date | null; optional_sections: Record<string, boolean> | null }[]
    >`
      SELECT t.updated_at, wp.optional_sections
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.id = ${threadId} AND t.org_id = ${org.id}
      LIMIT 1
    `;
    if (!rows[0]) redirect(`/hub/workshops/${orgSlug}`);
    serverUpdatedAt = rows[0].updated_at?.toISOString() ?? null;
    optionalSections = rows[0].optional_sections ?? undefined;
  }

  const manifest = loadTemplateManifest("workshop");
  const steps = toWizardUiSteps(
    buildWorkshopWizardSteps(manifest, { optionalSections })
  );

  return (
    <SiteShell>
      <div className="py-4">
        <div className="mb-2 px-6">
          <Link
            href={`/hub/workshops/${orgSlug}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Workshops
          </Link>
        </div>
        <div className="mx-auto max-w-2xl px-6">
          <h1 className="font-serif text-2xl leading-tight">
            {threadId ? "Edit workshop" : "New workshop"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few questions at a time. Your answers save as you go — you can
            leave and come back.{" "}
            <Link
              href={`/hub/workshops/${orgSlug}/new`}
              className="underline underline-offset-4"
            >
              Use the full form instead
            </Link>
            .
          </p>
        </div>
        <GuidedWorkshopWizard
          orgSlug={orgSlug}
          steps={steps}
          threadId={threadId}
          initialAnswers={initialAnswers}
          serverUpdatedAt={serverUpdatedAt}
        />
      </div>
    </SiteShell>
  );
}
