// Next.js instrumentation — runs once per server boot (nodejs runtime).
//
// Hosts IFAC's reminder scheduler: every five minutes, the day-before and
// hour-before letters to people who RSVP'd to a week of a series, and the
// host reminder from the rota. Deduplication is the database ledger
// (thread_reminder_sends), not this interval — see lib/reminders.ts.

const TICK_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.IFAC_URL || "https://ifacgroup.com";

  const tick = async () => {
    try {
      const { runReminderTick } = await import("@/lib/reminders");
      await runReminderTick(appOrigin);
    } catch (err) {
      console.error("[ifac] reminders: tick error:", err);
    }
  };

  setTimeout(tick, 20_000);
  setInterval(tick, TICK_MS);
  console.log("[ifac] reminders: scheduler registered (every 5m)");
}
