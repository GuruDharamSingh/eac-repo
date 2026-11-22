import type { Metadata } from "next";
import Link from "next/link";
import { requireNetworkAdmin } from "@/lib/gate";
import { listSites } from "@/lib/sites";
import { DEV_ORG } from "@/lib/sites-pages-core";
import { NewPage } from "@/components/sites/NewPage";
import "@/components/sites/sites.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sites" };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default async function SitesPage() {
  await requireNetworkAdmin("/sites");
  const sites = await listSites();
  const pageCount = sites.reduce((n, s) => n + s.pages.length, 0);
  return (
    <div className="dev-page st-page">
      <h1>Sites</h1>
      <p className="dev-lede">
        Every organisation on the network that has built pages in the page editor: {sites.length} sites, {pageCount} pages. Open a page to see it drawn from what is stored, with each block listed. Where this app knows a page&rsquo;s blocks, you can change its words or look here: your changes wait as a draft, and nothing goes live until you publish it.
      </p>
      {sites.map((site) => (
        <section className="st-section" key={site.id}>
          <h2>
            {site.name} <span className="st-slug">{site.slug}</span>
          </h2>
          {site.id === DEV_ORG ? (
            <>
              <p className="st-help">
                This is where this app builds: its pages are its own to try blocks on. Start a page, add blocks, type into them, restyle a part, publish it, then open it at <Link href="/pages">Pages</Link> to change a word right on the page.
              </p>
              <NewPage />
              {site.pages.length === 0 && site.newDrafts.length === 0 ? <p className="st-note">No page yet. Name one above to begin.</p> : null}
            </>
          ) : null}
          <table className="st-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Address</th>
                <th>Last changed</th>
                <th>Draft</th>
              </tr>
            </thead>
            <tbody>
              {site.pages.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <Link href={`/sites/${encodeURIComponent(site.id)}/${p.slug.split("/").map(encodeURIComponent).join("/")}`}>{p.title}</Link>
                    {site.id === DEV_ORG ? (
                      <>
                        {" "}
                        <Link href={`/pages/${p.slug.split("/").map(encodeURIComponent).join("/")}`}>(type into the published page)</Link>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <code>{p.href}</code>
                  </td>
                  <td>{when(p.changedAt)}</td>
                  <td>{p.draftWaiting ? <span className="st-flag">Waiting</span> : "None"}</td>
                </tr>
              ))}
              {site.newDrafts.map((slug) => (
                <tr key={`draft-${slug}`}>
                  <td>
                    <Link href={`/sites/${encodeURIComponent(site.id)}/${slug.split("/").map(encodeURIComponent).join("/")}`}>{slug.split("/").pop()!.replace(/-/g, " ")}</Link>
                  </td>
                  <td>
                    <code>/{slug}</code>
                  </td>
                  <td>Not published yet</td>
                  <td>
                    <span className="st-flag">Waiting</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {sites.length === 0 ? <p className="st-note">No organisation has built a page yet.</p> : null}
    </div>
  );
}
