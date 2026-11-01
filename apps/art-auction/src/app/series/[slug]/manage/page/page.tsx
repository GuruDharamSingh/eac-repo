import { loadWorkspace } from "../load";
import { PageLookPanel } from "../panels";
import "../../series-template.css";

export default async function PageLookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  return (
    <>
      <div>
        <h1 className="sw-h1">Page &amp; look</h1>
        <p className="sw-sub">The series page: cover, title, the curator&rsquo;s write-up, where the money goes, the journal, and the card on the marketplace home.</p>
      </div>
      <PageLookPanel series={series} />
    </>
  );
}
