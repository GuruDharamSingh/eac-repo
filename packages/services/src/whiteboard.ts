import { db } from '@elkdonis/db';

// ============================================================================
// One shared whiteboard per org: an Excalidraw scene stored whole, the same
// site_config pattern as center-layout.ts and Puck pages (migrations 073/091
// precedent — data, not DDL). Unlike center-layout there is no overlay: a
// whiteboard has no network default to inherit, it is just replaced whole on
// every save.
// ============================================================================

const CONFIG_KEY = 'whiteboard';

export interface WhiteboardScene {
  /** Excalidraw's own element array, stored opaquely — this package never
   *  interprets shapes, only round-trips them. */
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

const EMPTY_SCENE: WhiteboardScene = { elements: [] };

/** The org's whiteboard, or an empty scene if it has never been drawn on. */
export async function getWhiteboard(orgId: string): Promise<WhiteboardScene> {
  const [row] = await db<Array<{ value: unknown }>>`
    SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${CONFIG_KEY} LIMIT 1
  `;
  const value = row?.value as Partial<WhiteboardScene> | undefined;
  if (!value || !Array.isArray(value.elements)) return EMPTY_SCENE;
  return { elements: value.elements, appState: value.appState, files: value.files };
}

/** Replace the org's whiteboard. Caller authorises (any member, by design). */
export async function saveWhiteboard(orgId: string, scene: WhiteboardScene): Promise<void> {
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${orgId}, ${CONFIG_KEY}, ${db.json(scene as any)}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}
