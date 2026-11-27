import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canDoSteps, getExperimentState, getWorkspaceDoing, getWorkspaceDraftView, getWorkspaceSettings, getWorkspaceView, listOngoingSessions } from "@elkdonis/lms";
import { ConsentScreen, ServerWorkspaceProvider, Shell } from "@elkdonis/workspace-ui";
import { mapDoing, mapWorkspace } from "@elkdonis/workspace-ui/map";
import { connectors } from "@/lib/connectors";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Workspace", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ module?: string }> };

/** Read-only workspace (slice 1). Signed in only; a visitor who is neither seated nor staff gets the normal not-found. */
export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  const viewer = await getViewer();
  if (!viewer.userId) redirect(connectors.hrefs.signIn(`/workspaces/${slug}`));
  const view = await getWorkspaceView(viewer, slug);
  if (!view) notFound();

  if (!view.run || !view.published) {
    return (
      <main className="so-page">
        <header className="so-hero">
          <span className="so-kicker">Workspace</span>
          <h1>{view.course.title}</h1>
          <p>{!view.run ? "This course has no group yet, so there is no workspace to show." : "This group has no published outline yet, so there is nothing to show."}</p>
          <p><a href="/workspaces">Back to your workspaces</a></p>
        </header>
      </main>
    );
  }

  // An experiment: a seated person who has not agreed to the current wording sees only the wording, never the group.
  const exp = await getExperimentState(viewer, slug);
  if (exp && !exp.isGuide && view.seated && exp.consent.needs && exp.consent.text) {
    return <><style>{".so-root{max-width:none;border-left:0;border-right:0;box-shadow:none}.so-root .ws-root{margin:0}"}</style><ConsentScreen title={view.course.title} text={exp.consent.text.body} version={exp.consent.text.version} slug={slug} again={Boolean(exp.consent.mine)} /></>;
  }
  const doing = canDoSteps(view) ? await getWorkspaceDoing(viewer, view) : null;
  const sessions = view.run ? await listOngoingSessions(view.run.id) : [];
  const settings = view.run ? await getWorkspaceSettings(view.run.id) : undefined;
  // Guides of the workspace (and org owners and guides) also get the editor, over the DRAFT. Anyone else gets the published view only.
  const draft = await getWorkspaceDraftView(viewer, slug, { viewOnly: true });
  const draftData = draft
    ? mapWorkspace(draft, { viewerName: viewer.name, stepHref: (course, step) => connectors.hrefs.step(course, step), ongoing: sessions, settings: draft.settings, edit: true })
    : null;
  const data = mapWorkspace(view, {
    viewerName: viewer.name,
    stepHref: (course, step) => connectors.hrefs.step(course, step),
    initialModule: q.module,
    ongoing: sessions,
    settings,
  });
  return (
    <>
      {/* The prototype look wants the whole width; Sophia centres its column at 1200px. Only this page. */}
      <style>{".so-root{max-width:none;border-left:0;border-right:0;box-shadow:none}.so-root .ws-root{margin:0}"}</style>
    <ServerWorkspaceProvider data={data} doing={doing ? mapDoing(doing) : null} slug={slug} canJournal={view.seated || view.runGuide} experiment={Boolean(exp)}
      editor={draft && draftData?.course ? { course: draftData.course, people: draftData.people, unpublished: draft.unpublished, hasPublished: draft.hasPublished, canSave: draft.canSave } : undefined}>
      <Shell />
    </ServerWorkspaceProvider>
    </>
  );
}
