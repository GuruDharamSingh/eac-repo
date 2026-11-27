// Next.js instrumentation — runs once per server boot (nodejs runtime).
// Hosts the reminder scheduler: every 5 minutes, check for meetings starting
// within their reminder window and email RSVP'd attendees. The DB ledger
// (thread_reminder_sends) deduplicates across restarts and instances.

const TICK_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Slot sweeper: expire lapsed holds and auto-cancel slots that closed below their minimum
  // (only under the auto_cancel rule). A no-op unless BOOKING_TABLES=1. Idempotent and safe on
  // several instances (cancelling locks the slot row and re-checks its status).
  if (process.env.DISABLE_SLOT_SWEEP !== "1") {
    const sweep = async () => {
      try {
        const { sweepTourSlots } = await import("@/lib/tour-slots");
        await sweepTourSlots();
      } catch (err) {
        console.error("[elktours] slot sweep tick error:", err);
      }
    };
    setTimeout(sweep, 30_000);
    setInterval(sweep, TICK_MS);
  }

  // Standing rules: keep the runs of every active rule made up to its horizon (at most six months ahead).
  // Hourly; a no-op until migration 291 is applied. Idempotent and safe on several instances.
  if (process.env.DISABLE_STANDING_RULES !== "1") {
    const topUp = async () => {
      try {
        const { topUpStandingRules } = await import("@/lib/standing-rules");
        await topUpStandingRules();
      } catch (err) {
        console.error("[elktours] standing rules tick error:", err);
      }
    };
    setTimeout(topUp, 60_000);
    setInterval(topUp, 60 * 60 * 1000);
  }

  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3021";

  const tick = async () => {
    try {
      const { runReminderTick } = await import("@/lib/reminders");
      await runReminderTick(appOrigin);
    } catch (err) {
      console.error("[elktours] reminders: scheduler tick error:", err);
    }
  };

  // First run shortly after boot, then on an interval.
  setTimeout(tick, 15_000);
  setInterval(tick, TICK_MS);
  console.log("[elktours] reminders: scheduler registered (every 5m)");
}
