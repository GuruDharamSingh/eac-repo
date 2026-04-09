import type { Organization } from './organization';
import type { User } from './user';

export interface Event {
  id: string;
  orgId?: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  data?: Record<string, any>;
  createdAt: Date;
  organization?: Organization;
  user?: User;
}
