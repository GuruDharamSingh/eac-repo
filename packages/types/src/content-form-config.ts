export type ThreadKind = 'post' | 'meeting' | 'event' | 'workshop' | 'service';
export type ContentFormKind = 'post' | 'meeting' | 'workshop';

export interface ExtraField {
  id: string;
  key: string;
  value: string;
}

export interface WorkshopSessionResource {
  id: string;
  title: string;
  type: 'link' | 'pdf' | 'video' | 'audio' | 'doc' | 'other';
  url: string;
  isPublic: boolean;
  description?: string;
}

export interface WorkshopSessionDraft {
  id: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  isOnline?: boolean;
  location?: string;
  videoConferenceUrl?: string;
  mediaUrl?: string | null;
  /** Recorded/embedded video for this session — distinct from the shared live Talk room. */
  videoUrl?: string | null;
  /** Files/links attached to this session (materials, readings, recordings). */
  resources?: WorkshopSessionResource[];
  backgroundColor?: string | null;
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
  videoLink?: string | null;
  recurrencePattern?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' | null;
  recurrenceCustomRule?: string | null;
  recurrenceUntil?: string | null;
  /** Other users (besides the author) who can also confirm/cancel a recurring
   *  cycle. Stored as `threads.metadata.coGuideIds`. Null/undefined = solo guide. */
  coGuideIds?: string[] | null;

  // rsvp
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;
  /** Email the guide(s) once minAttendees is first reached. */
  notifyOnMinAttendees?: boolean | null;
  /** Author-editable body of the RSVP confirmation email for this publication.
   *  Stored as email_template_settings row `rsvp-guest:<threadId>`. */
  rsvpEmailBody?: string | null;
  /** Minutes before scheduled_at to email attendees a reminder (null = 60). */
  reminderMinutesBefore?: number | null;
  /** Author-editable body of the scheduled reminder email for this publication.
   *  Stored as email_template_settings row `reminder:<threadId>`. */
  reminderEmailBody?: string | null;

  // workshop
  pitch?: string | null;
  price?: number | null;
  /** Card thumbnail — shown on feed/workshop cards. */
  flyerUrl?: string | null;
  /** Wide banner behind the title at the top of the workshop page. Falls back to flyerUrl. */
  bannerImageUrl?: string | null;
  /** Vertical crop position within the banner's fixed-height strip: 0 = top, 50 = center (default), 100 = bottom. */
  bannerFocalY?: number | null;
  /** Featured "main media" shown in the page body — image or video. */
  heroMediaUrl?: string | null;
  heroMediaType?: 'image' | 'video' | null;
  /** Headline overlaid on the hero media. */
  heroText?: string | null;
  /** Workshop page background color (hex). Falls back to the site default when unset. */
  backgroundColor?: string | null;
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
