import { CalendarCheck, CalendarX, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadCycleStatus } from "@/lib/types";

/**
 * "Is it happening?" — the answer someone deciding whether to set a 3:30am
 * alarm needs before anything else on the page. Deliberately loud.
 *
 * `pending` is stated as unconfirmed rather than hidden: silence about a 4am
 * gathering is itself information, and pretending otherwise would strand
 * people at a locked door.
 */
export function CycleBadge({
  status,
  className,
}: {
  status: ThreadCycleStatus;
  className?: string;
}) {
  const config = {
    confirmed: {
      Icon: CalendarCheck,
      label: "Confirmed — it's on",
      classes: "border-primary/50 bg-primary/15 text-foreground",
    },
    cancelled: {
      Icon: CalendarX,
      label: "Cancelled this cycle",
      classes: "border-destructive/50 bg-destructive/10 text-destructive",
    },
    pending: {
      Icon: CircleHelp,
      label: "Not yet confirmed",
      classes: "border-border bg-muted text-muted-foreground",
    },
  }[status];

  const { Icon, label, classes } = config;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
        classes,
        className
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}
