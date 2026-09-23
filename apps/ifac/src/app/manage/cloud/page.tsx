import type { CSSProperties } from "react";
import { canManageNextcloudAccess, hasOrgGrant } from "@elkdonis/services";
import { NextcloudAccessPanel } from "@elkdonis/cms-ui/nextcloud-access";
import "@elkdonis/cms-ui/nextcloud-access.css";
import { requireIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Cloud storage — IFAC" };
export const dynamic = "force-dynamic";

/** The panel's dark set, matching the console's panels. Measured ≥ 8.7:1 on #0a0a0a. */
const DARK: CSSProperties = {
  ["--ncx-bg" as string]: "#0a0a0a",
  ["--ncx-ink" as string]: "#e8e3e4",
  ["--ncx-soft" as string]: "#b3a9b1",
  ["--ncx-line" as string]: "#6b5a77",
  ["--ncx-ok" as string]: "#7fd49a",
  ["--ncx-warn" as string]: "#f0b35a",
  ["--ncx-bad" as string]: "#ff8f7a",
  ["--ncx-btn-bg" as string]: "#e8e3e4",
  ["--ncx-btn-ink" as string]: "#0a0a0a",
};

/**
 * Who in IFAC is linked to Nextcloud, and a way to ask for a sync.
 *
 * The console's own gate (requireIfacManager) lets editors in; this tab is
 * narrower — owners only, and only once the network admin has switched it on
 * for IFAC. Anyone else sees why, not an empty panel.
 */
export default async function ManageCloudPage() {
  const viewer = await requireIfacManager("/manage/cloud");
  const [granted, allowed] = await Promise.all([
    hasOrgGrant(siteConfig.orgId, "nextcloud_access"),
    canManageNextcloudAccess(viewer.userId, siteConfig.orgId),
  ]);

  if (!granted || !allowed) {
    return (
      <section className="admin-panel">
        <h2>Cloud storage</h2>
        <p className="body-copy">
          {!granted
            ? "The network admin hasn't turned on cloud storage management for IFAC yet."
            : "Only an owner of IFAC can manage cloud storage access."}
        </p>
      </section>
    );
  }

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL ?? "https://cloud.elkdonis-arts.org";
  return (
    <div style={DARK}>
      <NextcloudAccessPanel endpoint="/api/manage/nextcloud-access" nextcloudUrl={nextcloudUrl} />
    </div>
  );
}
