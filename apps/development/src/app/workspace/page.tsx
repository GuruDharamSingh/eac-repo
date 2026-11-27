import type { Metadata } from "next";
import { requireNetworkAdmin } from "@/lib/gate";
import { LocalWorkspaceProvider, Shell } from "@elkdonis/workspace-ui";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

/** Click-through prototype of the workshop workspace. State lives in the browser only (localStorage). The screens live in packages/workspace-ui. */
export default async function WorkspacePage() {
  await requireNetworkAdmin("/workspace");
  return (
    <LocalWorkspaceProvider>
      <Shell />
    </LocalWorkspaceProvider>
  );
}
