import type { User } from './user';
import type { Meeting } from './meeting';

export type AttendanceStatus = 'registered' | 'attended' | 'absent';

export interface MeetingAttendee {
  meetingId: string;
  userId: string;
  attendanceStatus: AttendanceStatus;
  registeredAt: Date;
  user?: User;
  meeting?: Meeting;
}
