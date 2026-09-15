import Link from "next/link";

export const metadata = { title: "Mixed Media" };

const SECTIONS = [
  { href: "/mixed-media/collage", label: "Collage" },
  { href: "/mixed-media/radical-renaissance", label: "Radical Renaissance" },
  { href: "/mixed-media/botanical-resin-sculptures", label: "Botanical Resin Sculptures" },
  { href: "/mixed-media/art-objects", label: "Art Objects" },
];

export default function MixedMediaPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Mixed Media</h1>
      <ul className="hub-list">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href}>{s.label}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
