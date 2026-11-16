# Atlas mapping, round 2: shared brief (lead, 2026-11-16)

You curate the action atlas on eris for an assigned set of APPS. Other agents are doing other apps right now.

## Access and safety
- `ssh -o BatchMode=yes eris '<cmd>'` (Bash tool, Git Bash on Windows). Apostrophes and pairs of single quotes inside a single-quoted remote command get STRIPPED. Write files locally under your scratchpad folder (given in your prompt) and `scp -q` them to eris, or scp a Python script and run it.
- Repo: `~/eac` (pnpm monorepo). LOTS of uncommitted work from other sessions. No git writes, installs, migrations, builds, restarts, DB writes or live-site writes.
- Write ONLY: new files `~/eac/packages/actions/atlas/areas/apps.<your-app>.*.ts`, plus an append to `atlas/JOURNAL.md`. Never edit another area file.

## Read first
- `atlas/README.md` and `atlas/types.ts` (the contract; note `Host.case` for dispatchers).
- ALL of `atlas/JOURNAL.md`. It holds conventions, the HOUSE STYLE for confirm text (agent F entry), Justin's answers (money = link only; Silex = legacy/email; network-admin = `apps/admin`; booking pays at the book step), and the key rules (an sa/api host with raw SQL also has a `sql:` twin key, so claim both or ignore the twin with "twin of <key>").
- Style models: `areas/apps.art-auction.market.ts`, `areas/orgapps.meetings.ts`.
- `docs/open/mcp-foundations/DOCK_RAILS_PLAN.md` §3 L1 and §5a.
- Your work list: `atlas/reports/_unclaimed-by-file.txt` (unclaimed hosts per app and file; the truth keys are in `atlas/inventory.json`).

## Rules
- Claim only keys whose file is under `apps/<your app>/`. Every unclaimed key of your apps must end up claimed or ignored (`ignored` needs a reason: a read exposed as an action, dead code, dev tool, or "twin of <key>").
- **Ids**: every capability id in your files starts with the app's short prefix (`elktours-`, `ifac-`, `sunjay-`, `amrit-`, `he-` for hidden-enneagram, `dana-`, `artdirect-`, `katie-`, `fourthway-`, `ig-` for innergathering, `igl-` for inner-gathering), then `<noun>-<verb>`. No collisions possible.
- **Copies of existing capabilities**: many hosts copy a family already mapped in `orgapps.*.ts` or `arts-collective.*.ts` (search the existing files for the same export name or service call). Do NOT edit those files. Create your own row, and put `drift: "copy of <file>:<id>; differs: ..."` plus the SAME `canonical` as the original. The lead merges later.
- Per capability:
  - `service` per host, from reading the code.
  - `address` (app, path template, `how` naming the real control and its component file).
  - `actors` from the REAL auth checks.
  - `risk`: money / irreversible / public / emails / others / none.
  - `entry`: an id from `packages/actions/src/catalogue.ts` or `hub.ts` if it truly covers the action; `null` if person-facing and it should get one; omitted for internal/system.
  - `status`.
  - person rows: a `confirm` with `status:'draft'`, `wave: 6`, following the house style.
  - `drift`/`canonical`.
  - `verified: "2026-11-16 read <files>"`.
- **Security**: while reading, note in `open` any check that looks weaker than its copies elsewhere, any cross-org write (an id from input used without an org filter), unsanitised HTML that is rendered, any client-trusted amount, or any missing ownership check. Prefix such notes with `SECURITY:` so the lead can grep them. Don't overstate: write what you saw, with file:line.
- Run after each file:
  `cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/actions admin sh -c "pnpm --filter @elkdonis/lms exec tsx ../actions/scripts/check-atlas.mts --app <app>"`
  and reach 0 hard errors in YOUR files. If an error is in another agent's file, report it; don't fix it.
- Quality beats breadth. If you run out of room, stop cleanly and say exactly where.

## Journal and report
- Append `## 2026-11-16 · round 2 · <your apps>`: conventions used, judgement calls, the SECURITY notes listed, open questions for Justin, and where you stopped.
- Final report (under 600 words): per app, hosts claimed/ignored/unclaimed; capability count by class; the top drift (copies and canonical); the SECURITY notes (file:line); open questions; check-atlas results.
