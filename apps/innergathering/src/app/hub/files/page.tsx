import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { FileBrowser, HubPageFrame, NextcloudFrame } from "@elkdonis/cms-ui/hubsite";
import { getViewerCloud } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { NEXTCLOUD_SIGN_IN } from "@/lib/hub-links";

export const metadata: Metadata = { title: "Files · Hub" };
export const dynamic = "force-dynamic";

/**
 * Files (owner, 2026-10-08). Two parts:
 *
 *   The file browser, for every member: read over WebDAV by the service
 *   account (/api/center/files), so it needs no Nextcloud account.
 *
 *   Nextcloud Files, framed on the group folder, for a member who has a
 *   Nextcloud account. The Files app needs a real account and session —
 *   without one it shows a login page — so a member who has none is offered
 *   the sign-in instead, which also creates the account.
 */
export default async function HubFilesPage() {
  const viewer = await requireOrgMember("/hub/files");
  const cloud = await getViewerCloud(viewer.userId, siteConfig.orgId).catch(() => null);

  return (
    <HubPageFrame
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Files" }]}
      title="Files"
      intro={<p>The group&rsquo;s folder and your own.</p>}
    >
      <FileBrowser
        sources={[
          { id: "org", label: siteConfig.orgName, endpoint: "/api/center/files" },
          { id: "mine", label: "My files", endpoint: "/api/center/files", params: { scope: "mine" } },
        ]}
      />

      {cloud ? (
        <section className="eac-hp-section" aria-labelledby="files-nc">
          <h2 id="files-nc" className="eac-hp-section-title">
            In Nextcloud
          </h2>
          {cloud.linked ? (
            <NextcloudFrame
              src={cloud.teamFolderUrl}
              title={`${cloud.teamFolderLabel} in Nextcloud Files`}
              signInUrl={NEXTCLOUD_SIGN_IN}
              linked
              height="70vh"
              note="Upload, move and share here. If the frame asks you to log in, sign in to Nextcloud once."
            />
          ) : (
            <div className="eac-hp-panel">
              <p>
                Nextcloud Files needs a Nextcloud account. Signing in with your {siteConfig.orgName} account creates
                one; come back here afterwards and the group folder will open in this page.
              </p>
              {NEXTCLOUD_SIGN_IN ? (
                <div>
                  <a className="eac-nc-btn eac-nc-btn--primary" href={NEXTCLOUD_SIGN_IN} target="_blank" rel="noopener">
                    Sign in to Nextcloud
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </HubPageFrame>
  );
}
