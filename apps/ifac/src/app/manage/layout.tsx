import type { Metadata } from "next";
import { requireIfacManager } from "@/lib/manage-auth";
import { ManageTabs } from "@/components/manage/manage-tabs";

export const metadata: Metadata = {
  title: "Manage IFAC",
  // An editorial console has no business in search results.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The one place IFAC is administered.
 *
 * It replaces /admin and /admin/directory, which had grown into two unrelated
 * screens that each linked to the other and disagreed about what "role" meant —
 * one showed access levels, the other a public byline, both called it a role.
 * The tabs here name the four things separately: what's on the site, who is on
 * it, who may change it, and the words in between.
 */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  // Gated here so every /manage route inherits it — a page added later that
  // forgets to check still cannot render.
  const viewer = await requireIfacManager();

  return (
    <div className="admin-shell manage-console">
      <div className="page-heading">
        <p className="kicker">IFAC admin</p>
        <h1>Manage</h1>
        <p className="body-copy">Signed in as {viewer.email}</p>
      </div>

      <ManageTabs />

      {children}
    </div>
  );
}
