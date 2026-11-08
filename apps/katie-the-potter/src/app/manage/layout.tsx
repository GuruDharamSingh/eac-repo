import Link from "next/link";
import type { Metadata } from "next";
import { requireOrgEditor } from "@/lib/auth";
import { ManageTabs, ToastProvider } from "@elkdonis/cms-ui/manage/client";
import { SignOutButton } from "@/components/sign-out-button";
// The shared console primitives first, then this site's own sheet on top.
import "@elkdonis/cms-ui/manage.css";
import "./manage.css";

export const metadata: Metadata = {
  title: { default: "Manage", template: "%s · Manage" },
  // Editorial surfaces have no business in search results.
  robots: { index: false, follow: false },
};

const TABS = [
  { href: "/manage", label: "Overview" },
  { href: "/manage/pieces", label: "Pieces" },
  { href: "/manage/orders", label: "Orders" },
  { href: "/manage/shipping", label: "Shipping" },
  { href: "/manage/payouts", label: "Payouts" },
  { href: "/manage/site", label: "Site" },
  { href: "/manage/people", label: "People" },
];
const OWNER_TABS = [{ href: "/manage/analytics", label: "Visitors" }];

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  // Gate here so every /manage route inherits it; each page and server action
  // re-checks too (a layout is not rendered again on every navigation).
  const viewer = await requireOrgEditor("/manage");

  return (
    <div className="ktp-m">
      <header className="ktp-m-head">
        <div>
          <h1 className="ktp-m-title">Manage</h1>
          <p className="ktp-m-who">
            Signed in as <b>{viewer.email}</b> ({viewer.role})
          </p>
        </div>
        <div className="ktp-m-head-actions">
          <Link className="ktp-btn ktp-btn--ghost" href="/">
            View site
          </Link>
          <SignOutButton />
        </div>
      </header>
      <ManageTabs label="Manage" tabs={[...TABS, ...(viewer.role === "owner" ? OWNER_TABS : [])]} />
      <ToastProvider>
        <div className="ktp-m-body">{children}</div>
      </ToastProvider>
    </div>
  );
}
