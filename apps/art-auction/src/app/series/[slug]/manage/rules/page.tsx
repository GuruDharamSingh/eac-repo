import { loadWorkspace } from "../load";
import { RulesPanel } from "../panels";

export default async function RulesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  return (
    <>
      <div>
        <h1 className="sw-h1">Dates &amp; bidding</h1>
        <p className="sw-sub">The series&rsquo; clock. Every lot in it follows these dates.</p>
      </div>
      <RulesPanel series={series} />
    </>
  );
}
