import type { RenderRequest, RenderStatus } from "@/lib/catalogue-types";

const STEPS: Array<{ key: RenderStatus; label: string }> = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "claimed", label: "Picked up" },
  { key: "rendering", label: "Rendering" },
  { key: "delivered", label: "Delivered" },
];

const END_LABEL: Partial<Record<RenderStatus, string>> = {
  failed: "Failed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STATUS_LABEL: Record<RenderStatus, string> = {
  requested: "Requested",
  accepted: "Accepted, waiting for the render PC",
  claimed: "Picked up by the render PC",
  rendering: "Rendering",
  delivered: "Delivered (hidden until switched on)",
  failed: "Failed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** When each step happened, as far as the row tells. */
function stepTime(r: RenderRequest, key: RenderStatus): string | null {
  switch (key) {
    case "requested":
      return r.createdAt;
    case "accepted":
      return r.acceptedAt;
    case "claimed":
      return r.claimedAt;
    case "rendering":
      return r.startedAt;
    case "delivered":
      return r.status === "delivered" ? r.finishedAt : null;
    default:
      return null;
  }
}

export function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** The lifecycle as a row of steps, with the end state (failed, rejected, cancelled) where it stopped. */
export function FlyoverTimeline({ request: r }: { request: RenderRequest }) {
  const reached = STEPS.findIndex((s) => s.key === r.status);
  // For an end state, the last step with a timestamp is where it stopped.
  const stoppedAt = reached >= 0 ? reached : Math.max(...STEPS.map((s, i) => (stepTime(r, s.key) ? i : -1)));
  const ended = END_LABEL[r.status];
  return (
    <div>
      <ol className="flex flex-wrap items-start gap-x-1 gap-y-3">
        {STEPS.map((s, i) => {
          const done = i <= stoppedAt;
          const current = i === stoppedAt && !ended;
          return (
            <li key={s.key} className="flex items-start gap-1">
              <div className="w-24 text-center sm:w-28">
                <span
                  className={`mx-auto block h-3 w-3 rounded-full border ${
                    done ? "border-primary bg-primary" : "border-border bg-background"
                  } ${current && r.status !== "delivered" ? "animate-pulse" : ""}`}
                />
                <p className={`mt-1 text-xs ${done ? "font-medium" : "text-muted-foreground"}`}>{s.label}</p>
                <p className="text-[0.65rem] text-muted-foreground">{fmtWhen(stepTime(r, s.key))}</p>
              </div>
              {i < STEPS.length - 1 && <span className={`mt-1.5 block h-px w-4 ${i < stoppedAt ? "bg-primary" : "bg-border"}`} />}
            </li>
          );
        })}
      </ol>
      {r.status === "rendering" && (
        <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, r.progress)) * 100)}%` }} />
        </div>
      )}
      {ended && (
        <p className="mt-3 text-sm text-red-700">
          {ended}
          {r.rejectedReason ? `: ${r.rejectedReason}` : ""}
          {r.status === "failed" && (r.error || r.errorCode) ? `: ${r.error ?? r.errorCode}` : ""}
          {r.status === "failed" ? ` (attempt ${r.attempts} of ${r.maxAttempts})` : ""}
        </p>
      )}
    </div>
  );
}
