import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { redeemWorkspaceInvite } from "@elkdonis/lms";
import { connectors } from "@/lib/connectors";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Join a workspace", robots: { index: false, follow: false } };

/**
 * An invite link: sign-in first, then the link is checked (unknown, switched off, expired or used up links are refused in plain words)
 * and the person is seated through the engine's own enrolment. No email is sent.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getViewer();
  if (!viewer.userId) redirect(connectors.hrefs.signIn(`/workspaces/join/${token}`));
  const r = await redeemWorkspaceInvite(viewer, token);
  if (r.ok === true) redirect(`/workspaces/${r.slug}`);
  return (
    <main className="so-page">
      <header className="so-hero">
        <span className="so-kicker">Workspaces</span>
        <h1>This link did not work</h1>
        <p>{r.error}</p>
        <p><a href="/workspaces">Back to your workspaces</a></p>
      </header>
    </main>
  );
}
