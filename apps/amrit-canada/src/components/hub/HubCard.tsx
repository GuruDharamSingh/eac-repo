import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CardStatus, HubCard as HubCardType } from "@/lib/hub-cards";

/**
 * Ported from apps/arts-collective/src/components/hub/HubCard.tsx (same
 * Tailwind+shadcn stack) rather than apps/ifac's bespoke-CSS/dialog-modal
 * version, which amrit-canada shares no styling with. Adds `wide` for the
 * two full-width tiles IFAC's IA has (Questionnaires, Appearance) that
 * arts-collective's onboarding-row use case never needed.
 */

const STATUS_LABEL: Record<CardStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  locked: "Coming soon",
};

const STATUS_CLASS: Record<CardStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-accent text-accent-foreground",
  complete: "bg-primary/15 text-primary",
  locked: "bg-muted/50 text-muted-foreground",
};

export function HubCard({ card, status }: { card: HubCardType; status: CardStatus }) {
  const locked = !card.available;
  const href = card.href ?? "#";

  return (
    <article
      className={cn(
        "flex h-full min-h-[240px] flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm transition",
        card.wide ? "w-full" : "w-[280px] shrink-0",
        !locked && "hover:border-primary/60 hover:shadow-md",
        locked && "opacity-60"
      )}
    >
      <div className="space-y-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_CLASS[status]
          )}
        >
          {STATUS_LABEL[status]}
        </span>
        <h3 className="font-serif text-xl leading-tight text-foreground">{card.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{card.blurb}</p>
      </div>
      <div className="pt-4">
        {locked ? (
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
        ) : status === "complete" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href}>Review</Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href={href}>{status === "in_progress" ? "Continue" : "Start"}</Link>
          </Button>
        )}
      </div>
    </article>
  );
}
