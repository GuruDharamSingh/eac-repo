// Next.js instrumentation — runs once per server boot (nodejs runtime).
//
// Hosts the rota's reminder scheduler: every five minutes, look for a host
// whose turn starts within the hour and write to them. Deduplication is the
// database ledger, not this interval — see lib/reminders.ts.

const TICK_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3015";

  const tick = async () => {
    try {
      const { runHostReminderTick } = await import("@/lib/reminders");
      await runHostReminderTick(appOrigin);
    } catch (err) {
      console.error("[innergathering] reminders: tick error:", err);
    }
  };

  setTimeout(tick, 20_000);
  setInterval(tick, TICK_MS);
  console.log("[innergathering] host reminders: scheduler registered (every 5m)");
}
