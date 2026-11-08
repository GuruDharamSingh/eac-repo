// Client-safe entry: types and the catalogue. Server code is under ./server.
export type { CourseActionScope, ActionArea, ActionFailure, ActionLinks, ActionMeta, ActionNextItem, ActionParam, ActionResult, ActionScope, ActionStatus } from './types';
export { ACTION_CATALOGUE, ACTION_IDS, COURSE_ACTIONS, actionMeta, actionParams } from './catalogue';
export { CHANNEL_OUTLET_IDS, CHANNEL_DOCK_ACTIONS, type ChannelOutletId, type ChannelMoveKind, type ChannelNextMove } from './channel';
