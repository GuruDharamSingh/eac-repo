import type { Meeting } from './meeting';
import type { User } from './user';

export interface RSVP {
  id: string;
  meetingId: string;
  userId: string;
  status: 'yes' | 'no' | 'maybe';
  comment?: string;
  createdAt: Date;
  user?: User;
  meeting?: Meeting;
}
