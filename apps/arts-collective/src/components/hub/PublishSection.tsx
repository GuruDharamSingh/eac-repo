"use client";

import Link from "next/link";
import { CreateContentDialog } from "@/components/cms/create-content-dialog";

type PublishCard = {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  action: "dialog-post" | "dialog-event" | "dialog-workshop-event" | "link";
  href?: string;
  locked?: boolean;
};

const PUBLISH_CARDS: PublishCard[] = [
  {
    id: "workshop",
    icon: "◈",
    title: "Workshop",
    blurb: "Full workshop page with schedule, gallery, registration, and facilitator bio.",
    action: "link",
  },
  {
    id: "event",
    icon: "◆",
    title: "Event",
    blurb: "Announce a one-off gathering, performance, open studio, or pop-up.",
    action: "dialog-event",
  },
  {
    id: "article",
    icon: "◉",
    title: "Article",
    blurb: "Write and publish a post, essay, update, or reflection for your page.",
    action: "dialog-post",
  },
  {
    id: "meeting",
    icon: "◎",
    title: "Community Meeting",
    blurb: "Schedule a recurring or one-off gathering with RSVP and a Talk room.",
    action: "dialog-workshop-event",
  },
  {
    id: "webpage_design",
    icon: "◫",
    title: "Webpage Design Ideas",
    blurb: "Share references, sketches, vibes. The team uses this to shape your site.",
    action: "link",
    locked: true,
  },
];

export function PublishSection({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-4">
      <div className="flex gap-4">
        {PUBLISH_CARDS.map((card) => (
          <PublishCard key={card.id} card={card} orgSlug={orgSlug} />
        ))}
      </div>
    </div>
  );
}

function PublishCard({ card, orgSlug }: { card: PublishCard; orgSlug: string }) {
  const base =
    "relative flex w-[220px] shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left";

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-lg text-muted-foreground">{card.icon}</span>
        {card.locked && (
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Soon
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-medium leading-tight text-foreground">{card.title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{card.blurb}</p>
      </div>
    </>
  );

  if (card.locked) {
    return (
      <div className={`${base} opacity-50`}>
        {inner}
      </div>
    );
  }

  if (card.action === "link") {
    const href = card.id === "workshop" ? `/hub/workshops/${orgSlug}/new` : (card.href ?? "#");
    return (
      <Link href={href} className={`${base} transition-colors hover:border-foreground/30 hover:bg-muted/30`}>
        {inner}
        <span className="mt-auto text-xs text-muted-foreground underline-offset-2 hover:underline">
          Open wizard →
        </span>
      </Link>
    );
  }

  const kind =
    card.action === "dialog-post" ? "post" :
    card.action === "dialog-event" ? "event" :
    "event";

  return (
    <div className={`${base} transition-colors hover:border-foreground/30 hover:bg-muted/30`}>
      {inner}
      <div className="mt-auto">
        <CreateContentDialog
          orgSlug={orgSlug}
          triggerLabel="Open wizard →"
          triggerVariant="ghost"
          triggerSize="sm"
          defaultKind={kind as "post" | "workshop" | "event"}
        />
      </div>
    </div>
  );
}
