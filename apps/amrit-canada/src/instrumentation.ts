// Next.js instrumentation — runs once per server boot (nodejs runtime).
// Hosts the reminder scheduler: every 5 minutes, check for meetings starting
// within their reminder window and email RSVP'd attendees. The DB ledger
// (thread_reminder_sends) deduplicates across restarts and instances.

const TICK_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3006";

  const tick = async () => {
    try {
      const { runReminderTick } = await import("@/lib/reminders");
      await runReminderTick(appOrigin);
    } catch (err) {
      console.error("[amrit-canada] reminders: scheduler tick error:", err);
    }
  };

  // First run shortly after boot, then on an interval.
  setTimeout(tick, 15_000);
  setInterval(tick, TICK_MS);
  console.log("[amrit-canada] reminders: scheduler registered (every 5m)");
}
