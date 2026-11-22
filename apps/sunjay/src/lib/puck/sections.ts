import { SHARED_SECTIONS, type Section } from "@elkdonis/blocks/sections";

// The sections this site offers in the editor's Sections tab (2026-11-21). Opt-in: the shared library, or a subset
// of it, plus any of the site's own. Every block these use is in this site's catalogue (lib/puck/catalogue.ts):
// section-heading, prose, picture-wall, entry-list.
export const SUNJAY_SECTIONS: Section[] = SHARED_SECTIONS;
