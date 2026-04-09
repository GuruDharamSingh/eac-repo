import type { Organization } from './organization';
import type { User } from './user';

export type UserOrgRole = 'owner' | 'guide' | 'member' | 'viewer';

export interface UserOrganization {
  userId: string;
  orgId: string;
  role: UserOrgRole;
  joinedAt: Date;
  user?: User;
  org?: Organization;
}
