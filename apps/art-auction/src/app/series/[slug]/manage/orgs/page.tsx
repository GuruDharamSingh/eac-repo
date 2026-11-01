import { listSeriesOrgs } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../load";
import { OrgsPanel } from "./orgs-panel";

export default async function OrgsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const orgs = await listSeriesOrgs(series.id);
  return (
    <>
      <div>
        <h1 className="sw-h1">Organisations</h1>
        <p className="sw-sub">
          Who takes part in this series. A participating organisation&rsquo;s media folder opens to the desk when adding lots, and it is named among the series&rsquo; partners.
          Adding an organisation you do not run sends its owners a message and an email asking them to accept.
        </p>
      </div>
      <OrgsPanel series={series} orgs={orgs} />
    </>
  );
}
