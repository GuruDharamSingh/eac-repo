import type { Metadata } from "next";
import { AppCards, Proposal, TokenMatrix } from "@/components/DesignSystemsView";
import { loadDesignSystem, loadThemes } from "@/lib/data";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Design systems" };
export const dynamic = "force-dynamic";

export default async function DesignSystemsPage() {
  await requireNetworkAdmin("/design-systems");
  const themes = loadThemes();
  return (
    <div className="dev-page">
      <h1>Design systems</h1>
      <p className="dev-lede">What each app declares today: colours, fonts, families, and which editor changes them. Seeing them side by side is the first step to unifying them.</p>
      <AppCards themes={themes} />
      <h2>Variables side by side</h2>
      <TokenMatrix themes={themes} />
      <p className="dev-note">Showing the 300 most widely shared variable names. The full list per app is in src/data/themes.json.</p>
      <Proposal ds={loadDesignSystem()} />
    </div>
  );
}
