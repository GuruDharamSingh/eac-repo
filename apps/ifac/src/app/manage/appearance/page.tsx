import type { Metadata } from "next";
import { getThemeOverrides } from "@elkdonis/services";
import { requireIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";
import { IFAC_THEME_VARS, IFAC_THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveIfacThemeAction } from "@/lib/theme-actions";
import { getHubSkin } from "@/lib/hub-skin-store";
import { saveHubSkinAction } from "@/lib/hub-skin-actions";
import { AppearanceCard } from "@/components/hub/AppearanceCard";

export const metadata: Metadata = { title: "Appearance — IFAC" };
export const dynamic = "force-dynamic";

/**
 * The site's colours, per page, and which hub skin members get.
 *
 * MOVED here from the hub, 2026-09-19, with Email: changing the whole site's
 * palette is administration, and it sat on the members' hub only because the
 * hub was where the live editor already had a provider. Same component, same
 * actions — the card is unchanged.
 */
export default async function ManageAppearancePage() {
  await requireIfacManager("/manage/appearance");

  const skin = await getHubSkin(siteConfig.orgId);
  // Each scope's own overrides, unmerged: the editor shows what a scope sets,
  // not what it inherits.
  const overridesByPage: Record<string, Record<string, string>> = {};
  for (const page of IFAC_THEMEABLE_PAGES) {
    overridesByPage[page.key] = await getThemeOverrides({
      orgId: siteConfig.orgId,
      pageKey: page.key,
    });
  }

  return (
    <AppearanceCard
      vars={IFAC_THEME_VARS}
      pages={IFAC_THEMEABLE_PAGES}
      overridesByPage={overridesByPage}
      onSaveSite={saveIfacThemeAction}
      skin={skin}
      onSaveSkin={saveHubSkinAction}
    />
  );
}
