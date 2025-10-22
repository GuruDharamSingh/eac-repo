import type { Meeting } from './meeting';
import type { MeetingAttendee } from './meeting-attendee';
import type { UserOrganization } from './user-organization';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isAdmin: boolean;
  nextcloudUserId?: string;
  nextcloudSynced: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizations?: UserOrganization[];
  meetings?: Meeting[];
  meetingAttendances?: MeetingAttendee[];
}

export interface UserSummary {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}
