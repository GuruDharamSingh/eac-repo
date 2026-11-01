/**
 * The auction clock worker. Runs in container eac-auction-clock:
 *
 *   node_modules/.bin/tsx ../commerce/scripts/auction-clock.mts          # loop forever
 *   node_modules/.bin/tsx ../commerce/scripts/auction-clock.mts --once   # one tick, then exit
 *
 * Every AUCTION_CLOCK_SECONDS (default 30) it schedules series lots, opens
 * lots whose start has passed, settles lots whose end has passed and
 * releases orders whose payment window has passed. See
 * packages/commerce/src/server/auction-clock.ts.
 */
import { tickAuctionClock } from "../src/server/auction-clock.ts";

const INTERVAL_MS = Math.max(5, Number(process.env.AUCTION_CLOCK_SECONDS || 30)) * 1000;
const once = process.argv.includes("--once");
const payUrlBase = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? null;
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function tick(): Promise<void> {
  try {
    const r = await tickAuctionClock({ payUrlBase });
    if (r.scheduled || r.opened || r.settled.sold || r.settled.passed || r.released) {
      log("tick", JSON.stringify(r));
    }
  } catch (err) {
    log("tick failed:", err);
  }
}

log(`auction clock up; every ${INTERVAL_MS / 1000}s${once ? " (once)" : ""}`);
await tick();
if (!once) {
  while (!stopping) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    if (!stopping) await tick();
  }
}
log("auction clock stopped");
process.exit(0);
