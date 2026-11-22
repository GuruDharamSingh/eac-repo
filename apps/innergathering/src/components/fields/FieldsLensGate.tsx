import { getViewer } from "@/lib/auth";
import { siteFields } from "@/lib/fields-site";
import { FieldsLensMount } from "./FieldsLensMount";

/** Server side of the gate: visitors get nothing at all (no bar, no script, no markup); editors get the lens. */
export async function FieldsLensGate() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer?.canEdit) return null;
  return <FieldsLensMount blocks={{ map: siteFields.map }} />;
}
