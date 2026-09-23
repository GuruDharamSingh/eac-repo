// Next.js instrumentation — runs once per server boot (nodejs runtime).
//
// Hosts the rota's reminder scheduler: every five minutes, look for a host
// whose turn starts within the hour and write to them. Deduplication is the
// database ledger, not this interval — see lib/reminders.ts.

const TICK_MS = 5 * 60 * 1000;
const NC_FORUM_TICK_MS = 3 * 60 * 1000;

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

  // Org calendars, two-way with Nextcloud, for EVERY org that has one — the
  // same one-host posture as the forum mirror below. Imports events added in
  // Nextcloud, removes what the hub archived, and carries edits both ways
  // (services/org-calendar-sync.ts). Every hub also refreshes on open.
  if (process.env.DISABLE_CALENDAR_SYNC !== "1") {
    const calTick = async () => {
      try {
        const { runOrgCalendarSyncTick } = await import("@elkdonis/services");
        for (const r of await runOrgCalendarSyncTick()) {
          const n = r.imported + r.pulled + r.pushed + r.removed + r.archived;
          if (n || r.error) console.log("[innergathering] calendar-sync:", JSON.stringify(r));
        }
      } catch (err) {
        console.error("[innergathering] calendar-sync: tick error:", err);
      }
    };
    setTimeout(calTick, 45_000);
    setInterval(calTick, NC_FORUM_TICK_MS);
    console.log("[innergathering] calendar sync: scheduler registered (every 3m)");
  }

  // The Nextcloud Forum mirror (migration 144) for EVERY linked org, not just
  // this one — one host runs the poll so orgs don't each hammer Nextcloud.
  // Forum pages also sync their own org on open (syncOrgNcForumIfStale).
  if (process.env.DISABLE_NC_FORUM_SYNC === "1") return;
  const ncTick = async () => {
    try {
      const { runNcForumSyncTick } = await import("@elkdonis/services");
      const reports = await runNcForumSyncTick();
      for (const r of reports) {
        const n = r.threadsImported + r.repliesImported + r.edited + r.removed + r.retried;
        if (n || r.error) console.log("[innergathering] nc-forum:", JSON.stringify(r));
      }
    } catch (err) {
      console.error("[innergathering] nc-forum: tick error:", err);
    }
  };
  setTimeout(ncTick, 30_000);
  setInterval(ncTick, NC_FORUM_TICK_MS);
  console.log("[innergathering] nc-forum sync: scheduler registered (every 3m)");
}
