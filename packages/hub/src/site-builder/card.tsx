import { defineHubCard } from '../contract';
import { Detail } from './Detail';
import { Face } from './Face';
import type { SiteBuilderHost } from './host';
import { SITE_BUILDER_ACTIONS, type SiteBuilderDetailData, type SiteBuilderFaceData } from './model';
import { Popup } from './Popup';

export const siteBuilderCard = defineHubCard<SiteBuilderFaceData, SiteBuilderDetailData, SiteBuilderHost>({
  id: 'site',
  title: 'Site builder',
  icon: 'panels-top-left',
  capability: null,
  gate: 'guide',
  actions: SITE_BUILDER_ACTIONS,
  retires: [
    { screen: 'pages', tab: 'pages' },
    { screen: 'builder', tab: 'pages' },
    { screen: 'appearance', tab: 'theme' },
    { screen: 'site', tab: 'pages' },
  ],
  Face,
  Popup,
  Detail,
});
