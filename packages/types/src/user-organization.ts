import type { Organization } from './organization';
import type { User } from './user';

export interface UserOrganization {
  id: string;
  userId: string;
  orgId: string;
  role: 'ADMIN' | 'MEMBER' | 'GUEST';
  user?: User;
  org?: Organization;
}
