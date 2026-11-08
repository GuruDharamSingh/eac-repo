import { defineHubCard } from '../contract';
import { Detail } from './Detail';
import { Face } from './Face';
import type { MembersHost } from './host';
import { MEMBERS_ACTIONS, type MembersDetailData, type MembersFaceData } from './model';
import { Popup } from './Popup';

export const membersCard = defineHubCard<MembersFaceData, MembersDetailData, MembersHost>({
  id: 'members',
  title: 'Members',
  icon: 'users',
  capability: null,
  gate: 'guide',
  sections: { visitors: { gate: 'owner' }, storage: { gate: 'owner', capability: 'nextcloud_access' } },
  actions: MEMBERS_ACTIONS,
  retires: [
    { screen: 'people', tab: 'people' },
    { screen: 'analytics', tab: 'visitors' },
    { screen: 'cloud', tab: 'permissions' },
  ],
  Face,
  Popup,
  Detail,
});
