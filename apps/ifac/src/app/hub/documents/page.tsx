import type { Metadata } from "next";
import { DocumentsWorkspace } from "@elkdonis/cms-ui/hubsite";
import { listOrgDocuments } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HubPageShell } from "@/components/hub/HubPageShell";

export const metadata: Metadata = { title: "Documents · IFAC Hub" };
export const dynamic = "force-dynamic";

/**
 * The group's collaborative documents as a page (Cards 2, 2026-10-10): the
 * list beside the open document, framed from Nextcloud. Each document is a
 * public writable share, so members without a Nextcloud account can edit
 * it. New documents go through /api/hub/documents, the route the Documents
 * popup already uses.
 */
export default async function HubDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const { doc } = await searchParams;
  const viewer = await requireOrgMember(doc ? `/hub/documents?doc=${encodeURIComponent(doc)}` : "/hub/documents");
  const documents = await listOrgDocuments(siteConfig.orgId).catch(() => []);

  return (
    <HubPageShell
      userId={viewer.userId}
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Documents" }]}
      title="Collaborative documents"
      intro={<p>Write together. Every member of {siteConfig.shortName} can open and edit these.</p>}
    >
      <DocumentsWorkspace
        documents={documents.map((d) => ({
          id: d.id,
          title: d.title,
          editUrl: d.editUrl,
          createdAt: d.createdAt,
          createdBy: d.createdBy ?? null,
        }))}
        initialId={doc ?? null}
        createEndpoint="/api/hub/documents"
        timeZone="America/Toronto"
      />
    </HubPageShell>
  );
}
