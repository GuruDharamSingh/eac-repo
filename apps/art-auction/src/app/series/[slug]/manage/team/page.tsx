import { listSeriesMembers } from "@elkdonis/commerce/queries";
import { loadWorkspace } from "../load";
import { TeamPanel } from "../panels";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const members = await listSeriesMembers(series.id);
  return (
    <>
      <div>
        <h1 className="sw-h1">Team</h1>
        <p className="sw-sub">Editors run the whole workspace and edit on the series page. Contributors add their own writing from the series page; an editor approves it. Artists are listed under Artists, not here.</p>
      </div>
      <TeamPanel series={series} members={members} />
    </>
  );
}
