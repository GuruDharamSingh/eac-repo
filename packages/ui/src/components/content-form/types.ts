export type ThreadKind = "post" | "meeting" | "event" | "workshop";

export type TierName = "post" | "schedule" | "rsvp" | "workshop";

export interface ExtraField {
  id: string;
  key: string;
  value: string;
}

export interface WorkshopSessionDraft {
  id: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  orderIndex: number;
}

export interface ContentDraft {
  id?: string;

  // post tier
  title: string;
  body: string;
  publishAt?: string | null;

  // schedule tier (meeting)
  isMeeting: boolean;
  meetingTimeLabel?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  isOnline?: boolean;

  // rsvp tier (event)
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;

  // workshop tier
  pitch?: string | null;
  price?: number | null;
  flyerUrl?: string | null;
  sessions?: WorkshopSessionDraft[];

  // cross-post (cms sites only)
  primaryOrgId: string;
  additionalOrgIds?: string[];

  // references (backlinks)
  referencedThreadIds?: string[];

  // extensibility
  extraFields?: ExtraField[];
}

export interface KindInferenceResult {
  kind: ThreadKind;
  reason: string;
}

export interface ContentFormProps {
  orgId: string;
  isCmsSite?: boolean;
  allowedOrgs?: { id: string; name: string }[];
  userId: string;
  initialDraft?: Partial<ContentDraft>;
  initialThreadId?: string;
  onPublished?: (threadId: string, kind: ThreadKind) => void;
  onSaveDraft?: (draft: ContentDraft) => void;
}
