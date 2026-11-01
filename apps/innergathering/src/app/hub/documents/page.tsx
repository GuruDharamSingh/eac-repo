import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { DocumentsWorkspace, HubPageFrame } from "@elkdonis/cms-ui/hubsite";
import { listOrgDocuments } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Documents · Hub" };
export const dynamic = "force-dynamic";

/**
 * The group's collaborative documents (owner, 2026-10-08): the list beside
 * the open document, framed from Nextcloud rather than opened there. Created
 * through /api/hub/documents, the same route the Documents popup uses.
 */
export default async function HubDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const { doc } = await searchParams;
  await requireOrgMember(doc ? `/hub/documents?doc=${encodeURIComponent(doc)}` : "/hub/documents");
  const documents = await listOrgDocuments(siteConfig.orgId).catch(() => []);

  return (
    <HubPageFrame
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Documents" }]}
      title="Documents"
      intro={<p>Write together. Every member of {siteConfig.orgName} can open and edit these.</p>}
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
        timeZone={siteConfig.timeZone}
      />
    </HubPageFrame>
  );
}
