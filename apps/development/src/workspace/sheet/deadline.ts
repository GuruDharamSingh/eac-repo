/** "in 2 days", "due today", "overdue by 1 day". */
export function describeDue(iso: string, now: number = Date.now()): { text: string; overdue: boolean } {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return { text: "", overdue: false };
  const ms = due.getTime() - now;
  const day = 86400000;
  const n = new Date(now);
  const sameDay = due.getFullYear() === n.getFullYear() && due.getMonth() === n.getMonth() && due.getDate() === n.getDate();
  if (ms < 0) {
    const hours = Math.floor(-ms / 3600000);
    if (hours < 24) return { text: hours < 1 ? "overdue" : `overdue by ${hours} ${hours === 1 ? "hour" : "hours"}`, overdue: true };
    const d = Math.floor(-ms / day);
    return { text: `overdue by ${d} ${d === 1 ? "day" : "days"}`, overdue: true };
  }
  if (sameDay) return { text: "due today", overdue: false };
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const d = Math.round((startOf(due) - startOf(n)) / day);
  return { text: d === 1 ? "due tomorrow" : `in ${d} days`, overdue: false };
}

export function fmtDue(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

/** ISO to the value of a datetime-local input, and back. */
export function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
