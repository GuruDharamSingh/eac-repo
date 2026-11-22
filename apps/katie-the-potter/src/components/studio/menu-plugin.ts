import { menuPlugin } from "@elkdonis/page-builder";
import { loadNavForEditor, saveNavAction } from "@/lib/puck/nav-actions";

/**
 * The Menu tab for the page editor's `plugins` (shared page-builder plugin; the
 * actions are this site's gated ones). Module scope: Puck rebuilds its whole UI
 * when a plugin changes identity.
 */
export const MENU = menuPlugin({ load: loadNavForEditor, save: saveNavAction, memoKey: "katie" });
