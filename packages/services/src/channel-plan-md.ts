// ============================================================================
// plan.md: the piece's plan as Markdown, with a fixed outline.
//
//   ## Goal
//   ## Dates
//   ## Steps        - [ ] text  ·  - [x] text  ·  `<!-- board -->` tag
//   ## Notes
//
// Pure string helpers, no imports: the Channel UI (client) and the service
// (server) both use them, so a step added on the server reads the same in
// the browser. docs/open/channel.md §4.
// ============================================================================

export const PLAN_SECTIONS = ['Goal', 'Dates', 'Steps', 'Notes'] as const;
export type PlanSectionName = (typeof PLAN_SECTIONS)[number];

export interface PlanStep {
  /** Index among the Steps lines, stable for toggling. */
  index: number;
  text: string;
  done: boolean;
  /** Accepted from the board (`<!-- board -->` at the end of the line). */
  fromBoard: boolean;
  /** Optional trailing date tag: `<!-- on 2026-10-28 -->`. */
  on: string | null;
}

export interface ParsedPlan {
  goal: string;
  dates: string[];
  steps: PlanStep[];
  notes: string;
  /** Anything outside the four sections, kept so nothing a person wrote is lost. */
  other: string;
}

const STEP_RE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;
const BOARD_TAG = /\s*<!--\s*board\s*-->\s*/i;
const ON_TAG = /\s*<!--\s*on\s+(\d{4}-\d{2}-\d{2})\s*-->\s*/i;

/** The empty outline a plan starts with when its piece joins the queue. */
export function emptyPlan(): string {
  return '## Goal\n\n## Dates\n\n## Steps\n\n## Notes\n';
}

function splitSections(md: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let current = '';
  out.set(current, []);
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      current = h[1];
      if (!out.has(current)) out.set(current, []);
      continue;
    }
    out.get(current)!.push(line);
  }
  return out;
}

function trimBlock(lines: string[] | undefined): string {
  return (lines ?? []).join('\n').trim();
}

export function parsePlan(md: string): ParsedPlan {
  const sections = splitSections(md ?? '');
  const steps: PlanStep[] = [];
  let i = 0;
  for (const line of sections.get('Steps') ?? []) {
    const m = STEP_RE.exec(line);
    if (!m) continue;
    let text = m[2];
    const fromBoard = BOARD_TAG.test(text);
    const onMatch = ON_TAG.exec(text);
    text = text.replace(BOARD_TAG, ' ').replace(ON_TAG, ' ').trim();
    steps.push({ index: i++, text, done: m[1].toLowerCase() === 'x', fromBoard, on: onMatch ? onMatch[1] : null });
  }
  const dates = (sections.get('Dates') ?? [])
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
  const other = [...sections.entries()]
    .filter(([name]) => name !== '' && !(PLAN_SECTIONS as readonly string[]).includes(name))
    .map(([name, lines]) => `## ${name}\n${lines.join('\n')}`.trim())
    .concat(trimBlock(sections.get('')) ? [trimBlock(sections.get(''))] : [])
    .join('\n\n');
  return {
    goal: trimBlock(sections.get('Goal')),
    dates,
    steps,
    notes: trimBlock(sections.get('Notes')),
    other,
  };
}

/** Rewrite one section's body, adding the section if it is missing. */
function withSection(md: string, name: PlanSectionName, edit: (lines: string[]) => string[]): string {
  const base = md && md.trim() ? md.replace(/\r\n/g, '\n') : emptyPlan();
  const lines = base.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\s*$`).test(l));
  if (start === -1) {
    const body = edit([]);
    return `${base.replace(/\n*$/, '')}\n\n## ${name}\n${body.join('\n')}\n`;
  }
  let end = lines.findIndex((l, j) => j > start && /^##\s+/.test(l));
  if (end === -1) end = lines.length;
  const body = edit(lines.slice(start + 1, end));
  return [...lines.slice(0, start + 1), ...body, ...lines.slice(end)].join('\n');
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/<!--|-->/g, '').trim().slice(0, 300);
}

/** Append a step to Steps. `fromBoard` tags it as accepted from the board. */
export function addPlanStep(md: string, text: string, opts: { fromBoard?: boolean; on?: string | null } = {}): string {
  const line =
    `- [ ] ${oneLine(text)}` +
    (opts.on && /^\d{4}-\d{2}-\d{2}$/.test(opts.on) ? ` <!-- on ${opts.on} -->` : '') +
    (opts.fromBoard ? ' <!-- board -->' : '');
  return withSection(md, 'Steps', (body) => {
    const kept = [...body];
    while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
    if (kept.length === 0) kept.push('');
    return [...kept, line, ''];
  });
}

/** Tick or untick the step at `index` (its position among the Steps lines). */
export function setPlanStepDone(md: string, index: number, done: boolean): string {
  let seen = -1;
  return withSection(md, 'Steps', (body) =>
    body.map((line) => {
      const m = STEP_RE.exec(line);
      if (!m) return line;
      seen += 1;
      if (seen !== index) return line;
      return line.replace(/\[( |x|X)\]/, done ? '[x]' : '[ ]');
    })
  );
}

/** Add a dated line under Dates, once. */
export function addPlanDate(md: string, text: string): string {
  const line = `- ${oneLine(text)}`;
  return withSection(md, 'Dates', (body) => {
    if (body.some((l) => l.trim() === line)) return body;
    const kept = [...body];
    while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
    if (kept.length === 0) kept.push('');
    return [...kept, line, ''];
  });
}
