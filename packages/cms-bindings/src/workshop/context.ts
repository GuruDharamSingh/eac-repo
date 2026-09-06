/**
 * The render context a workshop template binds against.
 *
 * `workshop` deliberately keeps the snake_case column names of
 * `WorkshopPageData` rather than being camelCased on the way in. That keeps a
 * manifest readable as a pair: a section declaring
 * `cmsFields: ["threads.scheduled_at"]` binds `from: "workshop.scheduled_at"`,
 * so the data it claims and the data it uses can be checked by eye as well as
 * by `validateBindings`.
 *
 * The facilitator is lifted out of the flat row because the template speaks
 * about a person, not about `facilitator_*` columns — and because the
 * per-workshop `author_note` override is a workshop field, not a person field,
 * so the two need to stay addressable separately.
 */

import type { WorkshopPageData } from "./types";

export interface WorkshopFacilitator {
  name: string | null;
  bio: string | null;
  photo: string | null;
  pronouns: string | null;
  /** artist_profiles.role_title, e.g. "Writer & workshop facilitator". */
  roleTitle: string | null;
  /**
   * Co-facilitator. No column backs this yet; the template ships a hidden
   * block for it, and a `show` binding against this path keeps that block
   * hidden until one exists.
   */
  co: null;
}

export interface WorkshopRenderContext {
  workshop: WorkshopPageData;
  facilitator: WorkshopFacilitator;
}

export function toWorkshopContext(data: WorkshopPageData): WorkshopRenderContext {
  return {
    workshop: data,
    facilitator: {
      name: data.facilitator_name,
      bio: data.facilitator_bio,
      photo: data.facilitator_photo,
      pronouns: data.facilitator_pronouns,
      roleTitle: data.facilitator_role,
      co: null,
    },
  };
}
