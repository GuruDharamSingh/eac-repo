// Client-safe entry: types and the catalogue. Server code is under ./server.
export type { ActionAddress, ActionConfirm, ActionRisk, ActionRole, CourseActionScope, ActionArea, ActionFailure, ActionLinks, ActionMeta, ActionNextItem, ActionParam, ActionResult, ActionScope, ActionStatus } from './types';
export { ACTION_CATALOGUE, ACTION_IDS, COURSE_ACTIONS, AGENT_READ_IDS, AGENT_DRAFT_IDS, actionMeta, actionParams, agentExposure } from './catalogue';
export { AGENT_EXPOSURE, withAgent } from './agent';
export { confirmView, fillPlaceholders, isMoneyMeta, NEUTRAL_WORDS, type ConfirmCard, type ConfirmMode } from './confirm';
export { declareForms, formFieldNames, type ActionForm, type FieldSpec, type FieldKind, type FieldOption, type PickItem, type LoadedForm, type FormValues } from './fields';
export { ACTION_FORMS, actionForm } from './forms';
export { routeFor, withTicket, type ActionRoute } from './route';
export { anchorProps, EAC_ANCHOR } from './anchor';
export { HUB_ACTIONS, HUB_ACTION_IDS } from './hub';
export { CHANNEL_OUTLET_IDS, CHANNEL_DOCK_ACTIONS, type ChannelOutletId, type ChannelMoveKind, type ChannelNextMove, type ChannelPlanProposal } from './channel';
