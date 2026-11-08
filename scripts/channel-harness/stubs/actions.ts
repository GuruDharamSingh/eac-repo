// Harness stub for @/lib/channel/actions: no server, no database.
const ok = async (..._a: unknown[]) => ({ ok: true as const, accepted: 1, postId: "harness", swapped: false });
export const acceptSuggestionAction = ok;
export const acceptSuggestionsAction = ok;
export const dismissSuggestionAction = ok;
export const startPlanAction = ok;
export const savePlanAction = ok;
export const setPlanStepAction = ok;
export const addTodoAction = ok;
export const setTodoDoneAction = ok;
export const saveQuickSheetAction = ok;
export const saveNewPostAction = ok;
export const addRoutineAction = ok;
export const dryRunPublishAction = async () => ({
  ok: true as const,
  live: false,
  steps: [
    { order: 1, outlet: "site", account: "directory.arts-collective.com/guru-dharam", text: "Salt Marsh, Low Tide", notes: ["Publishes first, so the other outlets can link to it."] },
    { order: 2, outlet: "instagram", account: "@elkdonis.arts", text: "Salt Marsh, Low Tide — link in bio", notes: ["Link replaced with “link in bio”."] },
  ],
});
export type DryRunStep = { order: number; outlet: "site" | "instagram" | "facebook"; account: string; text: string; notes: string[] };
export type PublishTarget = { id: string; outlet: "facebook" | "instagram" | "threads"; label: string; disabledReason: string | null };
export type PublishResult = { targetId: string; label: string; ok: boolean; url: string | null; error: string | null };
export const listPublishTargetsAction = async () => ({
  ok: true as const,
  targets: [
    { id: "c1:instagram:p1", outlet: "instagram" as const, label: "@elkdonis.arts (Instagram)", disabledReason: null },
    { id: "c1:page:p1", outlet: "facebook" as const, label: "Elkdonis Arts Collective (Facebook Page)", disabledReason: null },
    { id: "c2:page:p2", outlet: "facebook" as const, label: "Guru Dharam Studio (Facebook Page)", disabledReason: "Your role on this Page cannot post." },
  ],
});
export const publishNewPostAction = async () => ({
  ok: true as const,
  postId: "harness",
  results: [
    { targetId: "c1:instagram:p1", label: "@elkdonis.arts (Instagram)", ok: false, url: null, error: "Instagram takes JPEG pictures only; make the first picture a JPEG." },
    { targetId: "c1:page:p1", label: "Elkdonis Arts Collective (Facebook Page)", ok: true, url: "https://facebook.com/example", error: null },
  ],
});
export const updateRoutineAction = ok;
export const archiveRoutineAction = ok;
export const acceptAdjustedAction = ok;
export const neverSuggestAction = ok;
export type Adjustment = { at?: string | null; outlet?: string; importance?: 1 | 2 | 3; note?: string };
