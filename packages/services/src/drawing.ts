import { db } from '@elkdonis/db';
import { createThread } from './posts';
import { gatherOnto, type GatherViewer } from './gather';
import { canModerate } from './forum-write';
import type { ForumViewer } from './forum';

// ============================================================================
// Drawings — a post whose body is a picture.
//
// Not a new kind. `kind='post'` with `metadata.drawing = { scene, svg }`:
// the Excalidraw scene is the SOURCE (re-editable), the SVG exported at the
// same moment is the PRESENTATION. The body carries one <img> pointing at
// the host's /api/drawing/<id>/svg, so the picture shows wherever a post
// shows — the forum stream, an org site, an embed — with no client script
// and no host knowing what Excalidraw is. Only the editor needs the scene.
//
// Why not `document`: that kind is ORGANIZATION-only and off every feed,
// which is the opposite of what a map is for. A drawing is meant to surface.
//
// Drawn OVER a thread's map, the drawing `cites` that thread (a gather edge),
// so it appears on the thread's constellation like anything else that
// refers to it.
// ============================================================================

export interface DrawingScene {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface Drawing {
  id: string;
  slug: string;
  title: string;
  orgId: string;
  orgSlug: string;
  section: string | null;
  authorId: string;
  caption: string | null;
  scene: DrawingScene;
  svg: string;
  updatedAt: Date;
}

export class DrawingError extends Error {}

// Postgres takes far more, but a scene past this is not a drawing anyone
// drew by hand, and the SVG is served inline on every page that shows it.
const MAX_SCENE_CHARS = 4_000_000;
const MAX_SVG_CHARS = 3_000_000;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The body: the picture, then the caption as a paragraph. */
function bodyFor(imageBase: string, id: string, title: string, caption: string | null): string {
  const src = `${imageBase.replace(/\/$/, '')}/api/drawing/${id}/svg`;
  const cap = caption?.trim() ? `<p>${escapeHtml(caption.trim())}</p>` : '';
  return `<figure class="eac-drawing"><img src="${src}" alt="${escapeHtml(title)}" loading="lazy"></figure>${cap}`;
}

function check(scene: DrawingScene, svg: string): void {
  if (!scene || !Array.isArray(scene.elements)) throw new DrawingError('No scene to save.');
  if (JSON.stringify(scene).length > MAX_SCENE_CHARS) throw new DrawingError('That drawing is too large to save.');
  if (typeof svg !== 'string' || !svg.trimStart().startsWith('<svg')) throw new DrawingError('No picture to save.');
  if (svg.length > MAX_SVG_CHARS) throw new DrawingError('That picture is too large to save.');
}

export async function getDrawing(id: string): Promise<Drawing | null> {
  const [r] = await db<Array<any>>`
    SELECT t.id, t.slug, t.title, t.org_id, o.slug AS org_slug, t.section, t.author_id, t.updated_at,
           t.metadata->'drawing' AS drawing
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${id} AND t.kind = 'post' AND t.status <> 'archived' AND (t.metadata ? 'drawing')
  `;
  if (!r || !r.drawing) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    orgId: r.org_id,
    orgSlug: r.org_slug,
    section: r.section,
    authorId: r.author_id,
    caption: typeof r.drawing.caption === 'string' ? r.drawing.caption : null,
    scene: r.drawing.scene ?? { elements: [] },
    svg: typeof r.drawing.svg === 'string' ? r.drawing.svg : '',
    updatedAt: r.updated_at,
  };
}

export async function createDrawing(input: {
  authorId: string;
  orgId: string;
  feedSlug: string;
  title: string;
  caption?: string | null;
  scene: DrawingScene;
  svg: string;
  /** The thread this was drawn over, which the drawing will then cite. */
  fromThreadId?: string | null;
  /** Where /api/drawing/<id>/svg is served from — the host's public origin. */
  imageBase: string;
  viewer: GatherViewer;
}): Promise<{ id: string; slug: string }> {
  const title = input.title.trim();
  if (!title) throw new DrawingError('Give the drawing a title.');
  check(input.scene, input.svg);

  const [feed] = await db<Array<{ slug: string; min_role: string | null }>>`
    SELECT slug, min_role FROM org_feeds WHERE org_id = ${input.orgId} AND slug = ${input.feedSlug}
  `;
  if (!feed) throw new DrawingError('No such forum.');
  const caption = input.caption?.trim() || null;

  const thread = await createThread({
    orgId: input.orgId,
    authorId: input.authorId,
    kind: 'post',
    title,
    body: '',
    section: feed.slug,
    status: 'published',
    // Members-only categories keep their drawings to members, as topics do.
    visibility: feed.min_role ? 'ORGANIZATION' : 'PUBLIC',
    metadata: {
      drawing: { version: 1, scene: input.scene, svg: input.svg, caption, updatedAt: new Date().toISOString() },
    },
  });

  // The body needs the id the row just got.
  await db`
    UPDATE threads SET body = ${bodyFor(input.imageBase, thread.id, title, caption)}, updated_at = NOW()
    WHERE id = ${thread.id}
  `;

  if (input.fromThreadId && input.fromThreadId !== thread.id) {
    try {
      await gatherOnto(
        thread.id,
        { targetType: 'thread', targetThreadId: input.fromThreadId, relation: 'cites', addedBy: input.authorId },
        { viewer: input.viewer }
      );
    } catch (err) {
      // The drawing exists either way; a source the drawer cannot see is
      // simply not cited. Same wording as everywhere: not an error to them.
      console.warn('[drawing] could not cite source:', (err as Error).message);
    }
  }

  return { id: thread.id, slug: thread.slug };
}

export async function updateDrawing(
  id: string,
  input: { title: string; caption?: string | null; scene: DrawingScene; svg: string; imageBase: string }
): Promise<{ id: string; slug: string }> {
  const title = input.title.trim();
  if (!title) throw new DrawingError('Give the drawing a title.');
  check(input.scene, input.svg);
  const caption = input.caption?.trim() || null;
  const patch = { drawing: { version: 1, scene: input.scene, svg: input.svg, caption, updatedAt: new Date().toISOString() } };
  const [row] = await db<Array<{ id: string; slug: string }>>`
    UPDATE threads
    SET title = ${title},
        body = ${bodyFor(input.imageBase, id, title, caption)},
        metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json(patch as never)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id} AND kind = 'post' AND (metadata ? 'drawing')
    RETURNING id, slug
  `;
  if (!row) throw new DrawingError('No such drawing.');
  return row;
}

/** The author, or someone who moderates the org. */
export function canEditDrawing(viewer: ForumViewer, drawing: Pick<Drawing, 'authorId' | 'orgId'>): boolean {
  if (!viewer.userId) return false;
  if (viewer.userId === drawing.authorId) return true;
  if (viewer.identityIds?.includes(drawing.authorId)) return true;
  return canModerate(viewer, drawing.orgId);
}
