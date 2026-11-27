import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { listWorkspaceCreatorOrgs } from "@elkdonis/lms";
import { NewWorkspaceForm } from "@elkdonis/workspace-ui";
import { connectors } from "@/lib/connectors";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "New workspace", robots: { index: false, follow: false } };

/** Make a workspace: the prototype's four questions, for the owners and guides of an organisation. Network admins with no organisation role do not create. */
export default async function Page() {
  const viewer = await getViewer();
  if (!viewer.userId) redirect(connectors.hrefs.signIn("/workspaces/new"));
  const orgs = await listWorkspaceCreatorOrgs(viewer);
  if (orgs.length === 0) notFound();
  return (
    <>
      <style>{".so-root{max-width:none;border-left:0;border-right:0;box-shadow:none}.so-root .ws-root{margin:0}"}</style>
      <NewWorkspaceForm orgs={orgs} />
    </>
  );
}
