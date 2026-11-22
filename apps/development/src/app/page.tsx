import { Workbench } from "@/components/blocks/Workbench";
import { loadCatalog, loadThemes } from "@/lib/data";
import { requireNetworkAdmin } from "@/lib/gate";

export const dynamic = "force-dynamic";

export default async function BlocksPage() {
  await requireNetworkAdmin("/");
  // Only what the preview needs goes to the browser: the variables and fonts, not the audit detail.
  const themes = loadThemes().map((t) => ({ ...t, swatches: [], families: [], counts: {} }));
  return <Workbench catalog={loadCatalog()} themes={themes} />;
}
