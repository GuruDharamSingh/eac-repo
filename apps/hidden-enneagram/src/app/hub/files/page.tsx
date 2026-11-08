import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { FileBrowser, HubPageFrame } from "@elkdonis/cms-ui/hubsite";
import { getViewerCloud } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Files · Hub" };
export const dynamic = "force-dynamic";

/**
 * Files (round 5, 2026-11-07). innergathering's /hub/files without its
 * framed Nextcloud Files: Nextcloud lets only https://elkdonis-arts.org frame
 * it (eac_embed `frame_ancestors`), so on hiddenenneagram.com the frame would
 * be a refused box. The browser reads over WebDAV with the service account
 * (/api/center/files), so it needs no Nextcloud account; Nextcloud itself is
 * a link out, in a new tab.
 */
export default async function HubFilesPage() {
  const viewer = await requireOrgMember("/hub/files");
  const cloud = await getViewerCloud(viewer.userId, siteConfig.orgId).catch(() => null);

  return (
    <HubPageFrame
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Files" }]}
      title="Files"
      intro={<p>The site&rsquo;s folder and your own.</p>}
      actions={
        cloud?.linked ? (
          <a className="eac-nc-btn" href={cloud.teamFolderUrl} target="_blank" rel="noopener">
            Open in Nextcloud ↗
          </a>
        ) : null
      }
    >
      <FileBrowser
        sources={[
          { id: "org", label: siteConfig.orgName, endpoint: "/api/center/files" },
          { id: "mine", label: "My files", endpoint: "/api/center/files", params: { scope: "mine" } },
        ]}
      />
    </HubPageFrame>
  );
}
