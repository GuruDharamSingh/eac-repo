import type { StudioResult } from '../types';

// The Meetings kind's contract with its host (2026-11-01). Structurally the
// services' MeetingInput / MeetingRecord (packages/services/src/meeting-content.ts);
// this package has no services dependency, as with Post.

export type MeetingKindId = 'meeting' | 'event';

export interface MeetingInputView {
  kind: MeetingKindId;
  title: string;
  body?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  timeZone?: string | null;
  /** ISO instants. The kind converts the form's wall clock before sending. */
  scheduledAt: string | null;
  durationMinutes?: number | null;
  format?: 'in_person' | 'online' | 'hybrid' | null;
  location?: string | null;
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  recurrenceUntil?: string | null;
  recurrenceCustomRule?: string | null;
  meetingUrl?: string | null;
  videoLink?: string | null;
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;
  notifyOnMinAttendees?: boolean;
  section?: string | null;
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  shareToNetwork?: boolean;
  createTalkRoom?: boolean;
  createDocument?: boolean;
  hostUserId?: string;
  coHostUserId?: string;
}

export interface MeetingSummaryView {
  id: string;
  orgId: string;
  kind: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  recurrencePattern: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
  isSeries: boolean;
}

export interface MeetingRecordView extends MeetingSummaryView {
  slug: string;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  input: MeetingInputView;
  talkToken: string | null;
  documentUrl: string | null;
  /** The public page, when the host knows it. */
  href?: string | null;
}

export interface MeetingContextView {
  canEdit: boolean;
  reason: string | null;
  feeds: Array<{ slug: string; name: string }>;
  hostCandidates: Array<{ userId: string; displayName: string }>;
  canCreateTalkRoom: boolean;
  canCreateDocument: boolean;
  canShareToNetwork: boolean;
}

export interface MeetingActions {
  context(orgId: string): Promise<MeetingContextView>;
  listMeetings(orgId: string): Promise<MeetingSummaryView[]>;
  loadMeeting(id: string): Promise<MeetingRecordView | null>;
  saveMeeting(
    orgId: string,
    input: MeetingInputView,
    intent: 'draft' | 'published',
    id: string | null
  ): Promise<StudioResult<{ record: MeetingRecordView; warnings: string[] }>>;
  removeMeeting(id: string): Promise<StudioResult>;
}

export interface MeetingKindProps {
  initialOrgId: string;
  initialMeetings: MeetingSummaryView[];
  initialContext: MeetingContextView;
  initialMeetingId: string | null;
  actions: MeetingActions;
  /** POST multipart `file` + `orgSlug` + `context`; answers `{ url }`. */
  uploadEndpoint: string;
  /** The org's media library; `:org` is replaced with the acting org's slug. */
  libraryEndpoint?: string;
}
