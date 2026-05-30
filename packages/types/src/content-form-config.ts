export type ThreadKind = 'post' | 'meeting' | 'event' | 'workshop';
export type ContentFormKind = 'post' | 'meeting' | 'workshop';

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

  // post
  title: string;
  body: string;
  publishAt?: string | null;

  // meeting
  isMeeting: boolean;
  meetingTimeLabel?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  isOnline?: boolean;

  // rsvp
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;

  // workshop
  pitch?: string | null;
  price?: number | null;
  flyerUrl?: string | null;
  sessions?: WorkshopSessionDraft[];

  // visibility
  visibility?: 'PUBLIC' | 'ORGANIZATION';

  // cross-post
  primaryOrgId: string;
  additionalOrgIds?: string[];

  // backlinks
  referencedThreadIds?: string[];

  // extensibility
  extraFields?: ExtraField[];
}

export interface UploadedMedia {
  fileId: string;
  path: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

/**
 * Shared config contract for all content creation surfaces.
 * The hook (useContentDraft) and any render layer (Mantine, headless, etc.)
 * consume this type. New fields go here first, never directly into a component.
 */
export interface ContentFormConfig {
  orgId: string;
  userId: string;
  isAdmin?: boolean;
  isCmsSite?: boolean;
  allowedOrgs?: { id: string; name: string }[];
  initialDraft?: Partial<ContentDraft>;
  initialThreadId?: string;
  /** Override upload endpoint. Defaults to /api/upload */
  uploadEndpoint?: string;
  /** Override publish endpoint. Defaults to /api/content */
  publishEndpoint?: string;
  visibleFields?: {
    kind?: boolean;
    media?: boolean;
    integrations?: boolean;
    scheduledPublish?: boolean;
    visibility?: boolean;
    rsvp?: boolean;
    rsvpCaps?: boolean;
    sessions?: boolean;
  };
  fixedValues?: {
    kind?: ContentFormKind;
    visibility?: 'PUBLIC' | 'ORGANIZATION';
  };
  requiredFields?: {
    title?: boolean;
    scheduledAt?: boolean;
  };
}
