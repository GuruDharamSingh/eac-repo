import Link from "next/link";
import type { Metadata } from "next";
import { getManageStats } from "@/lib/manage/data";

export const metadata: Metadata = { title: "Manage" };

export default async function ManagePage() {
  const stats = await getManageStats();

  const tiles = [
    { label: "Waiting to be rated", value: stats.unrated, href: "/manage/queue" },
    { label: "Open reports", value: stats.openReports, href: "/manage/reports" },
    { label: "Species to review", value: stats.proposedSpecies, href: "/manage/species" },
    { label: "Added today", value: stats.today, href: "/cards" },
    { label: "Hidden or removed", value: stats.hidden, href: "/manage/reports" },
    { label: "Cards in total", value: stats.total, href: "/cards" },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Manage</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cards publish themselves. Your job is rating them and taking down the ones that
        shouldn&apos;t be here.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <p className="text-sm text-muted-foreground">{t.label}</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">{t.value}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
