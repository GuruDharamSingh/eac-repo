import Link from "next/link";
import { redirect } from "next/navigation";
import { groupNav } from "@/lib/navigation";
import { loadNav } from "@/lib/navigation-store";

// The menu's "About" link lands here and lists the pages grouped under it
// (CV, exhibitions, biography, manifestos). If the menu no longer has an About
// group, /about falls back to the biography, as it did before 2026-09-25.

export const metadata = { title: "About" };

export default async function AboutPage() {
  const group = groupNav(await loadNav()).find((g) => g.item.href === "/about" && g.children.length > 0);
  if (!group) redirect("/biography");

  return (
    <article className="content-page">
      <h1 className="page-title">{group.item.label}</h1>
      <ul className="about-links">
        {group.children.map((c) => (
          <li key={c.href}>
            <Link href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noreferrer" : undefined}>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
