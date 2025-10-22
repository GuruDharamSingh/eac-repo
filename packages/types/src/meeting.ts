import type { Organization } from './organization';
import type { MeetingAttendee } from './meeting-attendee';
import type { User } from './user';
import type { Media } from './media';

export type MeetingRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type MeetingVisibility = 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  orgId: string;
  createdBy: User['id'];
  videoLink?: string;
  isRSVPEnabled: boolean;
  location?: string;
  timeZone?: string;
  recurrencePattern: MeetingRecurrence;
  recurrenceCustomRule?: string;
  reminderMinutesBefore?: number;
  coHostIds: string[];
  rsvpDeadline?: Date;
  visibility: MeetingVisibility;
  autoRecord: boolean;
  tags: string[];
  attachments: string[];
  followUpWorkflow: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Additional fields from database
  guideId?: string;
  isOnline?: boolean;
  durationMinutes?: number;
  
  // Nextcloud integration
  nextcloudDocumentId?: string;
  documentUrl?: string;
  documentShareToken?: string;
  
  // Relations
  organization?: Organization;
  creator?: User;
  guide?: User;
  attendees?: MeetingAttendee[];
  media?: Media[];
  coverImage?: Media;
}
