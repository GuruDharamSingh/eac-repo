import type { Course, Entry, Person } from "../types";

// Pure helpers (labels, grouping, the journal model) plus the two outputs:
// a Markdown download and a print-only view. Browser only, no network.

export function kindLabel(e: Pick<Entry, "kind" | "timestamp">): string {
  if (e.kind === "note" && e.timestamp) return "Video note";
  switch (e.kind) {
    case "reflection": return "Reflection";
    case "practice": return "Practice log";
    case "photo": return "Photo";
    case "recording": return "Recording";
    case "quiz": return "Quiz";
    default: return "Note";
  }
}

export function isMedia(e: Entry): boolean {
  return e.kind === "photo" || e.kind === "recording" || !!e.mediaLabel;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function stepTitle(course: Course, e: Entry): string | undefined {
  if (!e.stepId) return undefined;
  for (const m of course.modules) {
    const s = m.steps.find((x) => x.id === e.stepId);
    if (s) return s.title;
  }
  return undefined;
}

export interface EntryGroup { id: string; title: string; entries: Entry[] }

/** Entries grouped by module in course order, newest first inside a group. */
export function groupByModule(course: Course, entries: Entry[]): EntryGroup[] {
  const sorted = [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const groups: EntryGroup[] = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    entries: sorted.filter((e) => e.moduleId === m.id),
  }));
  const known = new Set(course.modules.map((m) => m.id));
  const rest = sorted.filter((e) => !known.has(e.moduleId));
  if (rest.length) groups.push({ id: "other", title: "Other", entries: rest });
  return groups.filter((g) => g.entries.length > 0);
}

/** An entry is unread when the guide has not commented on it. */
export function hasGuideComment(course: Course, e: Entry): boolean {
  return e.comments.some((c) => c.by === course.guideId);
}

// ---------------------------------------------------------------- model

interface ItemModel {
  heading: string;
  lines: string[];
  comments: { by: string; date: string; text: string }[];
}
interface PersonModel { name: string; groups: { title: string; items: ItemModel[] }[] }

function buildModel(course: Course, people: Person[], entries: Entry[], personIds: string[]): PersonModel[] {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";
  return personIds.map((pid) => {
    const mine = entries.filter((e) => e.personId === pid);
    return {
      name: name(pid),
      groups: groupByModule(course, mine).map((g) => ({
        title: g.title,
        items: g.entries.map((e) => {
          const st = stepTitle(course, e);
          const lines: string[] = [];
          if (e.text) lines.push(e.text);
          if (e.minutes != null) lines.push(`${e.minutes} minutes`);
          if (isMedia(e)) {
            lines.push(`[${kindLabel(e)} placeholder: ${e.mediaLabel ?? "no caption"}${e.timestamp ? `, at ${e.timestamp}` : ""}]`);
          } else if (e.timestamp) {
            lines.push(`At ${e.timestamp}`);
          }
          return {
            heading: [kindLabel(e), fmtDate(e.at), st].filter(Boolean).join(" · "),
            lines,
            comments: e.comments.map((c) => ({ by: name(c.by), date: fmtDate(c.at), text: c.text })),
          };
        }),
      })),
    };
  });
}

export function buildMarkdown(course: Course, people: Person[], entries: Entry[], personIds: string[]): string {
  const model = buildModel(course, people, entries, personIds);
  const multi = model.length > 1;
  const out: string[] = [];
  out.push(multi ? `# ${course.title}: journals` : `# ${course.title}: journal of ${model[0]?.name ?? ""}`);
  out.push("");
  for (const p of model) {
    if (multi) out.push(`## ${p.name}`, "");
    if (p.groups.length === 0) out.push("_No entries yet._", "");
    for (const g of p.groups) {
      out.push(`${multi ? "###" : "##"} ${g.title}`, "");
      for (const it of g.items) {
        out.push(`${multi ? "####" : "###"} ${it.heading}`, "");
        for (const l of it.lines) out.push(l, "");
        for (const c of it.comments) out.push(`> **${c.by}** (${c.date}): ${c.text}`, "");
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "journal";
}

/** Download a Markdown file. `label` becomes part of the file name. */
export function downloadJournal(course: Course, people: Person[], entries: Entry[], personIds: string[], label: string): void {
  try {
    const md = buildMarkdown(course, people, entries, personIds);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(course.title)}-${slug(label)}.md`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* download blocked: nothing to do in a prototype */
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Opens the browser print dialog on a print-only view of the journal. */
export function printJournal(course: Course, people: Person[], entries: Entry[], personIds: string[]): void {
  const model = buildModel(course, people, entries, personIds);
  const multi = model.length > 1;
  const html: string[] = [`<h1>${esc(course.title)}: ${multi ? "journals" : `journal of ${esc(model[0]?.name ?? "")}`}</h1>`];
  for (const p of model) {
    if (multi) html.push(`<h2>${esc(p.name)}</h2>`);
    if (p.groups.length === 0) html.push("<p><em>No entries yet.</em></p>");
    for (const g of p.groups) {
      html.push(`<h3>${esc(g.title)}</h3>`);
      for (const it of g.items) {
        html.push(`<section class="ws-j-print-entry"><h4>${esc(it.heading)}</h4>`);
        for (const l of it.lines) html.push(`<p>${esc(l)}</p>`);
        for (const c of it.comments) html.push(`<blockquote><strong>${esc(c.by)}</strong> (${esc(c.date)}): ${esc(c.text)}</blockquote>`);
        html.push("</section>");
      }
    }
  }
  const root = document.createElement("div");
  root.className = "ws-j-print-root";
  root.innerHTML = html.join("");
  document.body.appendChild(root);
  document.body.classList.add("ws-j-printing");
  const cleanup = () => {
    root.remove();
    document.body.classList.remove("ws-j-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  try {
    window.print();
  } finally {
    // Browsers that never fire afterprint: remove later.
    setTimeout(cleanup, 60000);
  }
}

/** Who may comment: the guide always; everyone else only when the workshop allows it. */
export function mayComment(course: Course, viewerId: string): boolean {
  return viewerId === course.guideId || course.journalComments === "everyone";
}

export function visibilityLine(course: Course): string {
  if (course.journals === "shared") return "The journal is Shared: people in the workshop see each other's entries.";
  return "The journal is Private: each person and the guide.";
}
