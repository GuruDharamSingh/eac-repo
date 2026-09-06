import type { Metadata } from "next";
import { ReportRow } from "@/components/manage/report-row";
import { listOpenReports } from "@/lib/manage/data";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const reports = await listOpenReports();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reporting flags a card, it doesn&apos;t hide it. <strong>Hide</strong> keeps the files
        for appeal; <strong>Remove</strong> deletes the photos from storage permanently — use
        it for copyright and identifiable people.
      </p>

      {reports.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          Nothing reported.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
