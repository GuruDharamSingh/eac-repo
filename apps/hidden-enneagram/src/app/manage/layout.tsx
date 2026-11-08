import Link from "next/link";
import type { Metadata } from "next";
import { ManageTabs } from "@elkdonis/cms-ui/manage/client";
import { requireOrgEditor } from "@/lib/auth";
import { ManageToasts } from "@/components/manage/manage-toasts";
import "./manage.css";

export const metadata: Metadata = {
  title: { default: "Manage", template: "%s · Manage" },
  robots: { index: false, follow: false },
};

// The back office on the shared kit (@elkdonis/cms-ui/manage, katie's shape).
// The kit's sheet is imported at the root (app/globals.css) with the others.
const TABS = [
  { href: "/manage", label: "Content" },
  { href: "/manage/orders", label: "Orders" },
  { href: "/manage/contacts", label: "Contacts" },
  { href: "/manage/newsletter", label: "Newsletter" },
  { href: "/manage/pages", label: "Pages" },
  { href: "/manage/site", label: "Site" },
  { href: "/manage/music", label: "Music" },
];
const OWNER_TABS = [{ href: "/manage/analytics", label: "Visitors" }];

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  // Gate here so every /manage route inherits it; each page and action re-checks.
  const viewer = await requireOrgEditor();

  return (
    <div className="he-m">
      <header className="he-m-head">
        <div>
          <p className="he-eyebrow">The Hidden Enneagram</p>
          <h1 className="he-m-title">Manage</h1>
          <p className="he-m-who">
            Signed in as <b>{viewer.email}</b> <span className="capitalize">({viewer.role})</span>
          </p>
        </div>
        <nav className="he-m-head-actions" aria-label="Elsewhere">
          <Link href="/">View site</Link>
          <Link href="/studio">Page editor</Link>
          <Link href="/hub">Hub</Link>
          <Link href="/center">Center</Link>
          <Link href="/channel">Channel</Link>
        </nav>
      </header>
      <ManageTabs label="Manage" tabs={[...TABS, ...(viewer.role === "owner" ? OWNER_TABS : [])]} />
      <ManageToasts>
        <div className="he-m-body">{children}</div>
      </ManageToasts>
    </div>
  );
}
