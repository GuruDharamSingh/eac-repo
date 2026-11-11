import type { Data } from "@puckeditor/core";
// Server-safe entry: the package's main entry carries editor hooks.
import { EMPTY_PAGE } from "@elkdonis/page-builder/config";
import { ABOUT_SLUG, FIGURE_SLUG, HOME_SLUG, MUSIC_SLUG, PERSON_SLUG, POST_SLUG, READINGS_SLUG, SERVICE_SLUG } from "@/lib/puck/store";
import { DEFAULT_ABOUT_PAGE, DEFAULT_FIGURE_PAGE, DEFAULT_HOME, DEFAULT_MUSIC_PAGE, DEFAULT_PERSON_PAGE, DEFAULT_POST_PAGE, DEFAULT_READINGS_PAGE, DEFAULT_SERVICE_PAGE } from "@/lib/default-pages";
import { READING_TEMPLATE } from "@/lib/reading-template";

/**
 * What a page opens on before it is first published: its code default, the reading
 * starter, or empty. Shared by the canvas (/studio/<slug>) and Puck's editor
 * (/studio/<slug>/blocks), so both open the same document (2026-11-11).
 */
export function startingPoint(slug: string, template?: string): Data {
  if (slug === HOME_SLUG) return DEFAULT_HOME as Data;
  if (slug === FIGURE_SLUG) return DEFAULT_FIGURE_PAGE as Data;
  if (slug === MUSIC_SLUG) return DEFAULT_MUSIC_PAGE as Data;
  if (slug === READINGS_SLUG) return DEFAULT_READINGS_PAGE as unknown as Data;
  if (slug === ABOUT_SLUG) return DEFAULT_ABOUT_PAGE as unknown as Data;
  if (slug === SERVICE_SLUG) return DEFAULT_SERVICE_PAGE as unknown as Data;
  if (slug === POST_SLUG) return DEFAULT_POST_PAGE as unknown as Data;
  if (slug === PERSON_SLUG) return DEFAULT_PERSON_PAGE as unknown as Data;
  if (template === "reading") return READING_TEMPLATE as unknown as Data;
  return EMPTY_PAGE as Data;
}
