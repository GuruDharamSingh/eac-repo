import type { Metadata } from "next";
import Link from "next/link";
import { listPages } from "@elkdonis/page-builder/server";
import { requireNetworkAdmin } from "@/lib/gate";
import { DEV_ORG } from "@/lib/sites-pages-core";
import "@/components/sites/sites.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages" };

/** The development organisation's published pages. New pages are started in the Sites tab. */
export default async function PagesIndex() {
  await requireNetworkAdmin("/pages");
  const pages = (await listPages(DEV_ORG)).sort((a, b) => a.slug.localeCompare(b.slug));
  return (
    <div className="dev-page st-page">
      <h1>Pages</h1>
      <p className="dev-lede">
        The pages the development organisation has published. Open one to type into its words. To start a new page, or to add and restyle blocks, use the <Link href="/sites">Sites tab</Link>.
      </p>
      {pages.length === 0 ? (
        <p className="st-note">Nothing is published yet.</p>
      ) : (
        <ul>
          {pages.map((p) => (
            <li key={p.slug}>
              <Link href={`/pages/${p.slug.split("/").map(encodeURIComponent).join("/")}`}>{p.slug}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
