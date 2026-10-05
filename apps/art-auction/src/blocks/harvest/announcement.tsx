import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A slim full-width announcement bar.
//
// Source:  HyperUI "Announcements" 1 (their banner bar) —
//          public/examples/marketing/announcements/1.html
//          https://github.com/markmead/hyperui (MIT, Copyright (c) Mark Mead;
//          see ./NOTICE.md)
//
// Changes: HyperUI's `border-b border-gray-200 bg-gray-100 px-4 py-2
// text-gray-900` bar and underlined inline link are kept. The message and link
// are props, and a `tone` select picks the colours:
//   quiet   bg-muted + border-border + text-foreground      (HyperUI's grey)
//   accent  bg-primary + text-primary-foreground
//   alert   bg-destructive/10 + border-destructive + text-foreground
// "alert" is a tint rather than a solid fill: text-destructive-foreground on
// the dark-mode destructive colour is below 4.5:1. `m-0` on <p>.
// ============================================================================

const props = [
  { name: "message", kind: "string", label: "Message", default: "", inlineEditable: true },
  { name: "label", kind: "string", label: "Link words", default: "" },
  { name: "href", kind: "url", label: "Link goes to", default: "" },
  {
    name: "tone",
    kind: "select",
    label: "Look",
    default: "quiet",
    options: [
      { value: "accent", label: "Accent" },
      { value: "quiet", label: "Quiet" },
      { value: "alert", label: "Alert" },
    ],
  },
] as const;

export type AnnouncementProps = PropsOf<typeof props>;

const TONES: Record<string, string> = {
  quiet: "border-border bg-muted text-foreground",
  accent: "border-primary bg-primary text-primary-foreground",
  alert: "border-destructive bg-destructive/10 text-foreground",
};

function safeHref(href: string | undefined): string | undefined {
  const h = String(href ?? "").trim();
  return /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(h) ? h : undefined;
}

export function Announcement({ message, label, href, tone = "quiet" }: AnnouncementProps) {
  if (!message) return null;
  const link = safeHref(href);

  return (
    <div className={`w-full border-b px-4 py-2 ${TONES[String(tone)] ?? TONES.quiet}`}>
      <p className="m-0 text-center font-medium">
        {message}
        {link && label ? (
          <>
            {" "}
            <a href={link} className="inline-block text-inherit underline underline-offset-2">
              {label}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

export const announcement = defineBlock(
  {
    id: "ha-announcement",
    label: "Announcement bar",
    category: "layout",
    description: "A slim bar across the page with one line and a link.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  Announcement,
  () => ({
    message: "The autumn auction opens for bidding on Friday.",
    label: "See the lots",
    href: "/",
    tone: "quiet",
  })
);
