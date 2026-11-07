import Link from "next/link";
import { listOrgDepartures } from "@elkdonis/commerce/server";
import { SchedulePlanner, type PlannerDeparture } from "@/components/manage/schedule-planner";
import { RepeatScheduler } from "@/components/manage/repeat-scheduler";
import { listGuides, listTours } from "@/lib/tours";
import {
  addDays,
  formatWeekLabel,
  mondayOf,
  monthGrid,
  parisDayOf,
  parisInstant,
  parisToday,
  resolveWeek,
} from "@/lib/schedule-plan";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export default async function ManageSchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { week } = await searchParams;
  const monday = resolveWeek(week);
  const today = parisToday();
  const month = monthGrid(monday);
  const gridFrom = month.days[0]!;
  const gridTo = addDays(month.days[month.days.length - 1]!, 1);
  // One query covers the month strip, which always contains the shown week.
  const [departures, tours, guides] = await Promise.all([
    listOrgDepartures(siteConfig.orgId, {
      from: parisInstant(gridFrom)!,
      to: parisInstant(gridTo)!,
      includeCancelled: true,
    }).catch(() => []),
    listTours({ includeDrafts: true }),
    listGuides(),
  ]);

  const authors = new Map(tours.map((t) => [t.id, t.authorName]));
  const rows: PlannerDeparture[] = departures.map((d) => ({
    ...d,
    day: parisDayOf(d.startsAt),
    authorName: authors.get(d.threadId) ?? null,
  }));
  const weekEnd = addDays(monday, 7);
  const inWeek = rows.filter((d) => d.day >= monday && d.day < weekEnd);
  const perDay = new Map<string, number>();
  for (const d of rows) if (d.status === "scheduled") perDay.set(d.day, (perDay.get(d.day) ?? 0) + 1);

  const thisWeek = mondayOf(today);
  const scheduled = inWeek.filter((d) => d.status === "scheduled");
  const seats = scheduled.reduce((n, d) => n + d.seatsTaken, 0);
  const capacity = scheduled.reduce((n, d) => n + d.capacity, 0);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Week of {formatWeekLabel(monday)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {scheduled.length} departure{scheduled.length === 1 ? "" : "s"} · {seats}/{capacity} places taken · Paris time
            </p>
          </div>
          <nav className="flex items-center gap-1 text-sm" aria-label="Week">
            <Link href={`/manage/schedule?week=${addDays(monday, -7)}`} className="border border-border px-3 py-1.5 hover:bg-accent/40">← Prev</Link>
            <Link
              href="/manage/schedule"
              aria-current={monday === thisWeek ? "page" : undefined}
              className={`border px-3 py-1.5 ${monday === thisWeek ? "border-primary text-foreground" : "border-border hover:bg-accent/40"}`}
            >
              This week
            </Link>
            <Link href={`/manage/schedule?week=${addDays(monday, 7)}`} className="border border-border px-3 py-1.5 hover:bg-accent/40">Next →</Link>
          </nav>
        </div>

        <MonthStrip monday={monday} today={today} month={month} perDay={perDay} />

        <div className="mt-6">
          <SchedulePlanner
            monday={monday}
            today={today}
            departures={inWeek}
            tours={tours.map((t) => ({ id: t.id, title: t.title, status: t.status }))}
            guides={guides}
          />
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Schedule a tour</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Repeat a tour on chosen weekdays and times over a date range. Slots already scheduled for that tour, and times already past, are skipped.
        </p>
        <div className="mt-4">
          <RepeatScheduler
            tours={tours.map((t) => ({ id: t.id, title: t.title, status: t.status }))}
            guides={guides}
            defaultFrom={today < monday ? monday : today}
          />
        </div>
      </section>
    </div>
  );
}

function MonthStrip({ monday, today, month, perDay }: { monday: string; today: string; month: ReturnType<typeof monthGrid>; perDay: Map<string, number> }) {
  const weeks: string[][] = [];
  for (let i = 0; i < month.days.length; i += 7) weeks.push(month.days.slice(i, i + 7));
  return (
    <div className="mt-4 max-w-md border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{month.label}</span>
        <span className="flex gap-3 text-xs">
          <Link href={`/manage/schedule?week=${month.prevWeek}`} className="text-muted-foreground underline-offset-4 hover:underline">← month</Link>
          <Link href={`/manage/schedule?week=${month.nextWeek}`} className="text-muted-foreground underline-offset-4 hover:underline">month →</Link>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-px border-t border-border bg-border text-center text-xs">
        {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
          <div key={i} className="bg-card py-1 text-muted-foreground">{l}</div>
        ))}
        {weeks.map((w) => {
          const current = w[0] === monday;
          return w.map((day) => {
            const n = perDay.get(day) ?? 0;
            const inMonth = day.startsWith(month.month);
            return (
              <Link
                key={day}
                href={`/manage/schedule?week=${w[0]}`}
                className={`flex flex-col items-center gap-0.5 py-1.5 hover:bg-accent/40 ${current ? "bg-accent/60" : "bg-card"} ${inMonth ? "" : "text-muted-foreground/60"}`}
                title={n ? `${n} departure${n === 1 ? "" : "s"}` : undefined}
              >
                <span className={day === today ? "font-medium text-primary" : ""}>{Number(day.slice(8))}</span>
                <span className="h-1.5 text-[0.6rem] leading-none text-primary">{n ? "•".repeat(Math.min(n, 4)) : ""}</span>
              </Link>
            );
          });
        })}
      </div>
    </div>
  );
}
