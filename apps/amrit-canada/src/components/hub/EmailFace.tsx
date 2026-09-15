import { SurfaceCard } from "@elkdonis/cms-ui/surface";

export interface EmailThreadOption {
  id: string;
  title: string;
  scheduledAt: string | null;
  reminderMinutesBefore: number | null;
}

/** Confirmations, manual triggers, and the automatic countdown reminder — one card, one surface. */
export function EmailFace({ threads }: { threads: EmailThreadOption[] }) {
  return (
    <SurfaceCard
      kind="neutral"
      glyph="✉"
      title="Email"
      blurb="Send confirmations, reminders, and updates to attendees."
      surface={{
        type: "custom",
        key: "email",
        title: "Email",
        kind: "neutral",
        size: "wide",
        props: { threads },
      }}
    />
  );
}
