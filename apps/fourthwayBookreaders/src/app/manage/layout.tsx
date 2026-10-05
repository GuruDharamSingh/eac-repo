import Link from "next/link";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/manage", label: "Overview" },
  { href: "/manage/groups", label: "Reading groups" },
  { href: "/manage/book", label: "The book" },
  { href: "/manage/groups/new", label: "New reading group" },
  { href: "/manage/meeting-structure", label: "Structure of a meeting" },
  { href: "/manage/suggested", label: "Books ahead" },
  { href: "/manage/site", label: "Hero, banner & copy" },
];

const OWNER_LINKS = [{ href: "/manage/analytics", label: "Visitors" }];

/** The gate lives in the layout, so no page under /manage can forget it. */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireOrgEditor("/manage");
  return (
    <div className="column band">
      <p className="eyebrow">Manage</p>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 26px" }} aria-label="Manage">
        {[...LINKS, ...(viewer.role === "owner" ? OWNER_LINKS : [])].map((l) => <Link key={l.href} href={l.href} className="btn">{l.label}</Link>)}
      </nav>
      {children}
    </div>
  );
}
