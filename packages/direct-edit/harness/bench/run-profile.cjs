// Inside the container: copies the page folder to /h (the drivers' fixed path), runs each driver in a fresh node
// process with the shim preloaded, and keeps the logs and screenshots. Started by run-browsers.sh.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const PROFILE = process.env.PROFILE, OUT = path.join("/out", PROFILE);
const DRIVERS = (process.env.DRIVERS || "walk.cjs walk2.cjs drive13.cjs").split(/\s+/).filter(Boolean);
const LIMIT_MS = Number(process.env.DRIVER_LIMIT || 900) * 1000;
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
for (const e of fs.readdirSync("/page")) if (!["node_modules", "shots", "reference"].includes(e)) fs.cpSync(path.join("/page", e), path.join("/h", e), { recursive: true });

const run = (driver) => new Promise((resolve) => {
  const name = path.basename(driver), log = fs.createWriteStream(path.join(OUT, `${name}.log`));
  const file = driver.startsWith("/") ? driver : path.join("/h", driver);
  if (!fs.existsSync(file)) { log.end(`driver not found: ${driver}\n`); return resolve({ name, code: 127, ms: 0 }); }
  const t0 = Date.now();
  const c = cp.spawn("node", ["--require", "/bench/pw-shim.cjs", file], { cwd: "/h", env: { ...process.env, NODE_PATH: "/v/node_modules" } });
  c.stdout.pipe(log, { end: false }); c.stderr.pipe(log, { end: false });
  const killer = setTimeout(() => { log.write(`\nBENCH-TIMEOUT driver stopped after ${LIMIT_MS / 1000}s\n`); c.kill("SIGKILL"); }, LIMIT_MS);
  c.on("close", (code) => {
    clearTimeout(killer); log.end(); const ms = Date.now() - t0;
    const shots = "/h/shots"; if (fs.existsSync(shots)) { fs.cpSync(shots, path.join(OUT, "shots", name.replace(/\.cjs$/, "")), { recursive: true }); fs.rmSync(shots, { recursive: true, force: true }); }
    resolve({ name, code, ms });
  });
});

(async () => {
  for (const d of DRIVERS) {
    const r = await run(d);
    console.log(`${PROFILE} ${r.name}: exit ${r.code} in ${Math.round(r.ms / 1000)}s`);
  }
})();
