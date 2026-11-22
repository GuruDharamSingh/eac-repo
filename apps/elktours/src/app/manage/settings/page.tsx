import { requireOrgEditor } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { Split } from "@/components/mobile/split";
import { SettingsView } from "@/components/mobile/settings-view";

export const dynamic = "force-dynamic";

/**
 * /manage/settings: the two house settings (below-the-minimum rule, holding guides' posts). Guides and owners may
 * open it; only an owner gets the controls (the save action checks the role again). One phone view; on desktop the
 * same view is shown centred.
 */
export default async function SettingsPage() {
  const viewer = await requireOrgEditor("/manage/settings");
  const settings = await getSiteSettings();
  const canEdit = viewer.role === "owner";
  return (
    <Split
      mobile={<SettingsView initial={settings} canEdit={canEdit} />}
      desktop={
        <div className="b-settings-desktop">
          <SettingsView initial={settings} canEdit={canEdit} />
        </div>
      }
    />
  );
}
