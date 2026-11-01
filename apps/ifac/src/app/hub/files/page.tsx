import type { Metadata } from "next";
import { FileBrowser } from "@elkdonis/cms-ui/hubsite";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HubPageShell } from "@/components/hub/HubPageShell";

export const metadata: Metadata = { title: "Files · IFAC Hub" };
export const dynamic = "force-dynamic";

/**
 * Files as a page (Cards 2, 2026-10-10): cms-ui's shared `FileBrowser` over
 * /api/hub/files, the same two sources the Page layout lists. The route reads
 * over the service account, so a member needs no Nextcloud account.
 *
 * No framed Nextcloud Files here, unlike innergathering's page: IFAC's Cloud
 * card is hidden (owner, 2026-09-19) and most members hold no Nextcloud
 * account.
 */
export default async function HubFilesPage() {
  const viewer = await requireOrgMember("/hub/files");

  return (
    <HubPageShell
      userId={viewer.userId}
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Files" }]}
      title="Files"
      intro={<p>The {siteConfig.shortName} folder and your own.</p>}
    >
      <FileBrowser
        sources={[
          { id: "org", label: siteConfig.shortName, endpoint: "/api/hub/files" },
          { id: "mine", label: "My files", endpoint: "/api/hub/files", params: { scope: "mine" } },
        ]}
      />
    </HubPageShell>
  );
}
