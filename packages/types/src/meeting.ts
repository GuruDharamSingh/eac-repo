import type { Organization } from './organization';
import type { RSVP } from './rsvp';
import type { User } from './user';

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
  organization?: Organization;
  creator?: User;
  rsvps?: RSVP[];
}
