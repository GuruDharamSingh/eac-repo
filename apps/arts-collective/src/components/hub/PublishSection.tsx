"use client";

import Link from "next/link";
import { CreateContentDialog } from "@/components/cms/create-content-dialog";

/**
 * What an org can make and manage from its hub.
 *
 * This started as "Publish" — the four things you can create — and is now the
 * org's whole toolkit, because the hub is where an org goes to *do* something:
 * make an offering, look at its public site, write to its members, ask them a
 * question. Cards that aren't built yet say so rather than being left off, so
 * the shape of what's coming is visible in one place.
 */

type PublishCard = {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  action: "dialog-post" | "dialog-event" | "dialog-workshop-event" | "link" | "external";
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
    id: "public_site",
    icon: "◱",
    title: "Your Public Site",
    blurb: "Your subdomain as visitors meet it — offering, profile, and the wider community.",
    action: "external",
  },
  {
    id: "workshop_email",
    icon: "✉",
    title: "Workshop Emails",
    blurb: "Confirmation and reminder emails for the people who sign up to your workshops.",
    action: "link",
    locked: true,
  },
  {
    id: "questionnaire",
    icon: "◎",
    title: "Questionnaires",
    blurb: "Ask your members something and read the results. Answers stay private to you.",
    action: "link",
    locked: true,
  },
  {
    id: "drafts",
    icon: "▤",
    title: "Drafts & Review",
    blurb: "Everything written but not yet published, in one place to finish or retire.",
    action: "link",
    locked: true,
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

export function PublishSection({
  orgSlug,
  orgHomeUrl,
}: {
  orgSlug: string;
  /** The org's public home — resolved server-side, since a client component
   *  can't look up its custom domain. */
  orgHomeUrl?: string;
}) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-4">
      <div className="flex gap-4">
        {PUBLISH_CARDS.map((card) => (
          <PublishCard
            key={card.id}
            card={card}
            orgSlug={orgSlug}
            orgHomeUrl={orgHomeUrl}
          />
        ))}
      </div>
    </div>
  );
}

function PublishCard({
  card,
  orgSlug,
  orgHomeUrl,
}: {
  card: PublishCard;
  orgSlug: string;
  orgHomeUrl?: string;
}) {
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
    return <div className={`${base} opacity-50`}>{inner}</div>;
  }

  if (card.action === "external") {
    // Only the public-site card, and only once its URL is known.
    if (!orgHomeUrl) return <div className={`${base} opacity-50`}>{inner}</div>;
    return (
      <a
        href={orgHomeUrl}
        target="_blank"
        rel="noopener"
        className={`${base} transition-colors hover:border-foreground/30 hover:bg-muted/30`}
      >
        {inner}
        <span className="mt-auto text-xs text-muted-foreground underline-offset-2 hover:underline">
          Visit ↗
        </span>
      </a>
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
