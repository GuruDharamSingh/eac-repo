import type { Metadata } from "next";
import { SchedulePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

export const metadata: Metadata = { title: "Schedule" };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; week?: string; side?: string }> }) {
  const q = await searchParams;
  return SchedulePage({ c: connectors, q, week: q.week, side: q.side === "inner" || q.side === "outer" ? q.side : null });
}
