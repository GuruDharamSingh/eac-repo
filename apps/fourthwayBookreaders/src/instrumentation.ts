// Next.js instrumentation — runs once per server boot (nodejs runtime).
//
// Reading circles (packages/services/src/circle-recording.ts):
//   every 30 s  start recording a circle's call once two people are in it
//               during a session window
//   every 2 min move the service account's finished recordings into the
//               circle's session folder
// Set DISABLE_CIRCLE_RECORDING=1 to turn both off.

const WATCH_MS = 30 * 1000;
const FILE_MS = 2 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_CIRCLE_RECORDING === "1") return;

  const ORG = "fourth_way_book_readers";
  const TZ = "America/Toronto";

  const watch = async () => {
    try {
      const { runCircleRecordingTick } = await import("@elkdonis/services");
      const r = await runCircleRecordingTick(ORG);
      if (r.started.length || r.errors.length) console.log("[fourthway] circle recording:", JSON.stringify(r));
    } catch (err) {
      console.error("[fourthway] circle recording: tick error:", err);
    }
  };
  const file = async () => {
    try {
      const { fileCircleRecordings } = await import("@elkdonis/services");
      const r = await fileCircleRecordings(ORG, TZ);
      if (r.filed.length || r.errors.length) console.log("[fourthway] circle recording files:", JSON.stringify(r));
    } catch (err) {
      console.error("[fourthway] circle recording files: tick error:", err);
    }
  };

  setTimeout(watch, 25_000);
  setInterval(watch, WATCH_MS);
  setTimeout(file, 60_000);
  setInterval(file, FILE_MS);
  console.log("[fourthway] circle recording: watcher (30s) and filer (2m) registered");
}
