import Link from "next/link";

export const metadata = { title: "Collections" };

/**
 * Her real Collections page was an index of every body of work
 * (portfolio_collections.txt) — reproduced here as links into the actual
 * pages rather than duplicating their content.
 */
const ITEMS = [
  { href: "/workshops", label: "Workshops & Teaching" },
  { href: "/medicine-buddha", label: "Medicine Buddha Invocation" },
  { href: "/figurative", label: "Figurative" },
  { href: "/mixed-media/art-objects", label: "Art Objects" },
  { href: "/mixed-media/botanical-resin-sculptures", label: "Botanical Resin Sculptures" },
  { href: "/mixed-media/collage", label: "Collage" },
  { href: "/portraiture", label: "Chroma Portraiture 2016" },
  { href: "/universal-pharmacy", label: "Universal Pharmacy" },
  { href: "/illustration", label: "Illustration" },
  { href: "/commissions", label: "Commissions" },
  { href: "/mixed-media/radical-renaissance", label: "Radical Renaissance" },
  { href: "/publications", label: "Publications" },
  { href: "/art-archive", label: "Art Archive" },
];

export default function CollectionsPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Collections</h1>
      <ul className="hub-list">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
