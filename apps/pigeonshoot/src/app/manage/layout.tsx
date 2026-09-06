import Link from "next/link";
import { requireOrgEditor } from "@/lib/auth";
import { getManageStats } from "@/lib/manage/data";

const TABS = [
  { href: "/manage", label: "Overview" },
  { href: "/manage/queue", label: "Rating queue", badge: "unrated" },
  { href: "/manage/reports", label: "Reports", badge: "openReports" },
  { href: "/manage/species", label: "Species", badge: "proposedSpecies" },
  { href: "/manage/rubric", label: "Rubric" },
  { href: "/manage/guests", label: "Contributors" },
  { href: "/manage/pages", label: "Site copy" },
] as const;

/**
 * The gate for every owner surface.
 *
 * This check protects the PAGES. It does not protect the server actions those
 * pages import — each of those re-checks independently, because an action is a
 * public endpoint regardless of where it's imported from.
 */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  await requireOrgEditor();
  const stats = await getManageStats();

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <nav className="mb-8 flex flex-wrap gap-1 border-b border-border pb-3">
        {TABS.map((tab) => {
          const count = "badge" in tab ? stats[tab.badge as keyof typeof stats] : 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {tab.label}
              {count > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
