import { defineHubCard } from '../contract';
import { Detail } from './Detail';
import { Face } from './Face';
import type { MembersHost } from './host';
import type { MembersDetailData, MembersFaceData } from './model';
import { Popup } from './Popup';

export const membersCard = defineHubCard<MembersFaceData, MembersDetailData, MembersHost>({
  id: 'members',
  title: 'Members',
  icon: 'users',
  capability: null,
  gate: 'guide',
  sections: { visitors: { gate: 'owner' }, storage: { gate: 'owner', capability: 'nextcloud_access' } },
  actions: ['org-person-role', 'org-person-listed', 'org-person-remove', 'org-arrival-welcome', 'org-arrival-dismiss'],
  retires: [
    { screen: 'people', tab: 'people' },
    { screen: 'analytics', tab: 'visitors' },
    { screen: 'cloud', tab: 'permissions' },
  ],
  Face,
  Popup,
  Detail,
});
