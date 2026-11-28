// The desk for Claude sessions: read Justin's notes, answer them, ask him questions, post what changed.
// Run from a one-off container (the repo root is ~/eac):
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/lms admin \
//     node_modules/.bin/tsx ../../apps/development/scripts/desk.mts <command>
//
//   list [--open] [--path P] [--since ISO]      notes and their state (newest first)
//   show <id>                                   one note with its whole thread (short ids work)
//   reply <id> "text" [--status done|doing|seen]
//   ask "question" --options "a|b|c" [--path /rails] [--anchor cap:x]
//   update "what changed" [--path P] [--anchor A]
//   seen <id>                                   mark a note as seen
//
// Writes as Claude (author_kind='claude', no author). Needs migration 302 (dev_notes).
import { createNote, getThread, isMissingTable, listThreads, replyTo, setStatus } from "../src/desk/store";
import { isOpenStatus, type Note, type NoteStatus, type Thread } from "../src/desk/types";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Map<string, string>();
const pos: string[] = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags.set(a.slice(2), "true");
    else {
      flags.set(a.slice(2), next);
      i++;
    }
  } else pos.push(a);
}

const short = (id: string) => id.slice(0, 8);
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
const one = (s: string) => s.replace(/\s+/g, " ").trim();
const where = (n: Note) => `${n.path}${n.anchor ? `  [${n.anchor}]` : ""}`;

function line(t: Thread): string {
  const replies = t.replies.length ? `, ${t.replies.length} repl${t.replies.length === 1 ? "y" : "ies"}` : "";
  const ans = t.answer ? `  ANSWER: ${one(t.answer)}` : t.options && !t.answer ? `  (options: ${t.options.join(" | ")})` : "";
  return `${short(t.id)}  ${t.status.padEnd(6)} ${t.kind.padEnd(8)} ${t.authorKind === "claude" ? "claude" : "justin"}  ${when(t.createdAt)}  ${where(t)}${replies}\n          ${one(t.body).slice(0, 160)}${ans}`;
}

function full(t: Thread): string {
  const out = [`${t.id}`, `status: ${t.status}   kind: ${t.kind}   from: ${t.authorKind}   at: ${when(t.createdAt)}`, `page: ${where(t)}`];
  if (t.anchorText) out.push(`was pointing at: "${t.anchorText}"`);
  out.push("", t.body);
  if (t.options) out.push("", `options: ${t.options.join(" | ")}`);
  if (t.answer) out.push(`ANSWER: ${t.answer}`);
  for (const r of t.replies) out.push("", `--- ${r.authorKind === "claude" ? "claude" : "justin"}  ${when(r.createdAt)}`, r.body);
  return out.join("\n");
}

async function must(id: string | undefined): Promise<Thread> {
  if (!id) throw new Error("Give a note id (the first 8 characters are enough).");
  const t = await getThread(id);
  if (!t) throw new Error(`No note starts with "${id}".`);
  return t;
}

async function main() {
  switch (cmd) {
    case "list": {
      const ts = await listThreads({ openOnly: flags.has("open"), path: flags.get("path"), since: flags.get("since"), limit: 200 });
      if (!ts.length) return console.log("No notes.");
      const open = ts.filter((t) => isOpenStatus(t.status) && t.authorKind === "person").length;
      console.log(`${ts.length} note(s), ${open} of Justin's still open\n`);
      console.log(ts.map(line).join("\n"));
      return;
    }
    case "show": {
      console.log(full(await must(pos[0])));
      return;
    }
    case "reply": {
      const t = await must(pos[0]);
      const text = pos.slice(1).join(" ");
      const st = flags.get("status");
      if (st && !["done", "doing", "seen", "open", "wontdo"].includes(st)) throw new Error("--status is done, doing, seen, open or wontdo.");
      await replyTo(t.id, { body: text, authorKind: "claude", status: st as NoteStatus | undefined });
      console.log(`Replied to ${short(t.id)}${st ? ` and set it to ${st}` : ""}.`);
      return;
    }
    case "ask": {
      const text = pos.join(" ");
      const options = (flags.get("options") ?? "").split("|").map((s) => s.trim()).filter(Boolean);
      const n = await createNote({ kind: options.length ? "decision" : "question", body: text, options, path: flags.get("path") ?? "/", anchor: flags.get("anchor") ?? null, authorKind: "claude" });
      console.log(`Asked ${short(n.id)}: it shows on the Desk under "Questions from Claude".`);
      return;
    }
    case "update": {
      const n = await createNote({ kind: "update", body: pos.join(" "), path: flags.get("path") ?? "/", anchor: flags.get("anchor") ?? null, authorKind: "claude", status: "done" });
      console.log(`Posted ${short(n.id)} under "Latest from Claude".`);
      return;
    }
    case "seen": {
      const t = await must(pos[0]);
      await setStatus(t.id, "seen");
      console.log(`Marked ${short(t.id)} as seen.`);
      return;
    }
    default:
      console.log("Commands: list [--open] [--path P] [--since ISO] | show <id> | reply <id> \"text\" [--status done|doing|seen] | ask \"q\" --options \"a|b\" [--path P] [--anchor A] | update \"text\" [--path P] [--anchor A] | seen <id>");
  }
}

main()
  .catch((e) => {
    console.error(isMissingTable(e) ? "Notes are not switched on yet (migration 302 has not been applied)." : `Error: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 50));
