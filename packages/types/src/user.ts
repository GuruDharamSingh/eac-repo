import type { Meeting } from './meeting';
import type { RSVP } from './rsvp';
import type { UserOrganization } from './user-organization';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarUrl?: string;
  isSuperadmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizations?: UserOrganization[];
  meetings?: Meeting[];
  rsvps?: RSVP[];
}
