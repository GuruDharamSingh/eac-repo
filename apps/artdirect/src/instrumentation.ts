// Next.js instrumentation: runs once per server boot (nodejs runtime).
// Booking module (2026-11-15): every 5 minutes, send booking reminders that are
// due (each booking is claimed in the database first, so a restart or a second
// app running the same tick does not send twice) and mark lapsed payment holds
// expired. DISABLE_REMINDER_SCHEDULER=1 turns it off, as on the other sites.

const TICK_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const tick = async () => {
    try {
      const { expireLapsedHolds, sendDueBookingReminders } = await import("@elkdonis/booking");
      await expireLapsedHolds();
      const sent = await sendDueBookingReminders();
      if (sent > 0) console.log(`[artdirect] booking reminders: sent ${sent}`);
    } catch (err) {
      console.error("[artdirect] booking reminders: tick error:", err);
    }
  };

  setTimeout(tick, 15_000);
  setInterval(tick, TICK_MS);
  console.log("[artdirect] booking reminders: scheduler registered (every 5m)");
}
