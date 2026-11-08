// Client-safe entry: types and the catalogue. Server code is under ./server.
export type { CourseActionScope, ActionArea, ActionFailure, ActionLinks, ActionMeta, ActionNextItem, ActionParam, ActionResult, ActionScope, ActionStatus } from './types';
export { ACTION_CATALOGUE, ACTION_IDS, COURSE_ACTIONS, AGENT_READ_IDS, AGENT_DRAFT_IDS, actionMeta, actionParams, agentExposure } from './catalogue';
export { AGENT_EXPOSURE, withAgent } from './agent';
export { HUB_ACTIONS, HUB_ACTION_IDS } from './hub';
export { CHANNEL_OUTLET_IDS, CHANNEL_DOCK_ACTIONS, type ChannelOutletId, type ChannelMoveKind, type ChannelNextMove } from './channel';
