// One copy of the workspace screens. Client components; the server-side mapper is its own subpath ("./map")
// so nothing here reaches @elkdonis/db or @elkdonis/services (scripts/check-client-barrels.mjs).
export { Shell } from "./Shell";
export { NewWorkspaceForm } from "./NewWorkspaceForm";
export { ConsentScreen } from "./readonly/ExperimentPanels";
export { WorkspaceProvider, LocalWorkspaceProvider, useWorkspace, type WorkspaceApi } from "./store";
export { ServerWorkspaceProvider, type ServerWorkspaceData } from "./server";
export type { DoingData, JournalWire } from "./types";
export type { Course, Module, Step, StepKind, Person, Mode } from "./types";
