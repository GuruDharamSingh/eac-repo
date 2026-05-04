/**
 * eac-workshop-template/index.js
 * ================================
 * Registers all workshop template blocks with a GrapesJS / Silex editor.
 *
 * Usage in your Silex client plugin:
 *
 *   import { registerAllWsBlocks } from './eac-workshop-template/index.js'
 *
 *   export default function EacPlugin(config, options) {
 *     config.on('grapesjs:start', ({ editor }) => {
 *       registerAllWsBlocks(editor)
 *     })
 *   }
 *
 * CSS: import all section stylesheets in your global CSS entry point,
 * or inject via editor.CssComposer.addRules() in the same callback.
 *
 *   @import './shared/eac-tokens.css';
 *   @import './sections/eac-ws-nav/eac-ws-nav.css';
 *   @import './sections/eac-ws-hero/eac-ws-hero.css';
 *   @import './sections/eac-ws-detail-strip/eac-ws-detail-strip.css';
 *   @import './sections/eac-ws-about/eac-ws-about.css';
 *   @import './sections/eac-ws-facilitator/eac-ws-facilitator.css';
 *   @import './sections/eac-ws-schedule/eac-ws-schedule.css';
 *   @import './sections/eac-ws-gallery/eac-ws-gallery.css';
 *   @import './sections/eac-ws-testimonials/eac-ws-testimonials.css';
 *   @import './sections/eac-ws-related/eac-ws-related.css';
 *   @import './sections/eac-ws-register/eac-ws-register.css';
 */

/**
 * GrapesJS component type IDs for the workshop template.
 * Used internally — exported for reference.
 */
export const WS_COMPONENT_IDS = {
  nav:         'eac-ws-nav',
  hero:        'eac-ws-hero',
  detailStrip: 'eac-ws-detail-strip',
  about:       'eac-ws-about',
  facilitator: 'eac-ws-facilitator',
  schedule:    'eac-ws-schedule',
  gallery:     'eac-ws-gallery',
  testimonials:'eac-ws-testimonials',
  related:     'eac-ws-related',
  register:    'eac-ws-register',
}

/**
 * Register a workshop section as a GrapesJS component + block.
 * Each section follows the same 4-argument pattern so this helper
 * keeps registration DRY across all 10 sections.
 *
 * @param {import('grapesjs').Editor} editor
 * @param {{ id, label, html, thumbnail }} opts
 */
function registerWsSection(editor, { id, label, html, thumbnail }) {
  editor.Components.addType(id, {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains(id),
    model: {
      defaults: {
        name:      label,
        droppable: false,
        copyable:  true,
      },
    },
  })

  editor.Blocks.add(`${id}--block`, {
    label,
    category: 'EAC — Workshop template',
    media:    thumbnail,
    content:  html,
    select:   true,
  })
}

/**
 * Minimal SVG thumbnails for the block panel.
 * Each is 40×28px, matches the section's visual character.
 */
const THUMBS = {
  nav: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#0f172a"/><rect x="4" y="12" width="6" height="2" rx="1" fill="#fff" opacity=".8"/><rect x="14" y="12" width="12" height="2" rx="1" fill="#fff" opacity=".3"/><rect x="30" y="10" width="7" height="5" rx="2" fill="#fff"/></svg>`,
  hero: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#0f172a"/><ellipse cx="20" cy="11" rx="14" ry="8" fill="rgba(120,80,220,.15)"/><rect x="10" y="5" width="20" height="3" rx="1" fill="#fff" opacity=".9"/><rect x="13" y="10" width="14" height="2" rx="1" fill="#fff" opacity=".35"/><rect x="11" y="15" width="8" height="5" rx="2" fill="#fff"/><rect x="21" y="15" width="8" height="5" rx="2" fill="none" stroke="#fff" stroke-width=".5" opacity=".4"/></svg>`,
  detailStrip: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#f9fafb"/>${[0,1,2,3,4,5].map(i=>`<rect x="${4+i*6}" y="8" width="4" height="12" rx="1" fill="#e5e7eb"/><rect x="${4+i*6}" y="10" width="3" height="1.5" rx=".75" fill="#9ca3af"/><rect x="${4+i*6}" y="13" width="3" height="2" rx=".5" fill="#374151"/>`).join('')}</svg>`,
  about: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#fff"/><rect x="4" y="5" width="20" height="3" rx="1" fill="#111827" opacity=".7"/><rect x="4" y="11" width="32" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/><rect x="4" y="14" width="28" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/><rect x="4" y="17" width="30" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/><rect x="4" y="22" width="6" height="3" rx="1.5" fill="#e5e7eb"/><rect x="12" y="22" width="8" height="3" rx="1.5" fill="#e5e7eb"/></svg>`,
  facilitator: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#f9fafb"/><circle cx="10" cy="14" r="6" fill="#dbeafe"/><rect x="20" y="8" width="14" height="2" rx="1" fill="#111827" opacity=".7"/><rect x="20" y="12" width="10" height="1.5" rx=".75" fill="#9ca3af"/><rect x="20" y="16" width="16" height="1.5" rx=".75" fill="#d1d5db"/><rect x="20" y="19" width="14" height="1.5" rx=".75" fill="#d1d5db"/></svg>`,
  schedule: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#fff"/>${[0,1,2].map(i=>`<rect x="4" y="${5+i*8}" width="6" height="5" rx="1" fill="#f3f4f6"/><rect x="13" y="${6+i*8}" width="18" height="1.5" rx=".75" fill="#374151" opacity=".7"/><rect x="13" y="${9+i*8}" width="13" height="1" rx=".5" fill="#9ca3af"/>`).join('')}</svg>`,
  gallery: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#f9fafb"/><rect x="2" y="4" width="18" height="20" rx="2" fill="#e5e7eb"/><rect x="22" y="4" width="16" height="9" rx="2" fill="#e5e7eb"/><rect x="22" y="15" width="16" height="9" rx="2" fill="#d1d5db"/></svg>`,
  testimonials: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#fff"/><rect x="2" y="4" width="17" height="20" rx="2" fill="#f9fafb" stroke="#e5e7eb" stroke-width=".5"/><rect x="21" y="4" width="17" height="20" rx="2" fill="#f9fafb" stroke="#e5e7eb" stroke-width=".5"/><rect x="5" y="9" width="11" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/><rect x="5" y="12" width="9" height="1.5" rx=".75" fill="#9ca3af" opacity=".5"/><rect x="24" y="9" width="11" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/><rect x="24" y="12" width="9" height="1.5" rx=".75" fill="#9ca3af" opacity=".5"/></svg>`,
  related: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#f9fafb"/>${[0,1,2].map(i=>`<rect x="${2+i*13}" y="2" width="11" height="24" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/><rect x="${3+i*13}" y="4" width="9" height="7" rx="1" fill="${['#1e293b','#1e3a2f','#2d1b2e'][i]}"/><rect x="${3+i*13}" y="14" width="7" height="1.5" rx=".75" fill="#374151" opacity=".7"/><rect x="${3+i*13}" y="17" width="5" height="1" rx=".5" fill="#9ca3af"/>`).join('')}</svg>`,
  register: `<svg viewBox="0 0 40 28"><rect width="40" height="28" rx="3" fill="#0f172a"/><rect x="6" y="4" width="28" height="20" rx="3" fill="#1e293b"/><rect x="10" y="7" width="10" height="3" rx="1" fill="#fff" opacity=".9"/><rect x="10" y="12" width="20" height="2" rx="1" fill="rgba(120,80,220,.6)"/><rect x="10" y="17" width="20" height="5" rx="2" fill="#fff"/></svg>`,
}

/**
 * HTML content strings for each block.
 * In production you may prefer to fetch these from the .html files
 * at build time and inline them here via a bundler transform.
 * For now they reference the component type ID — GrapesJS will
 * instantiate the registered component template on drop.
 */
const CONTENT = id => ({ type: id })

/**
 * Registers all 10 workshop template sections.
 *
 * @param {import('grapesjs').Editor} editor
 */
export function registerAllWsBlocks(editor) {
  const sections = [
    { id: WS_COMPONENT_IDS.nav,          label: 'Workshop nav',          thumbnail: THUMBS.nav          },
    { id: WS_COMPONENT_IDS.hero,         label: 'Workshop hero',         thumbnail: THUMBS.hero         },
    { id: WS_COMPONENT_IDS.detailStrip,  label: 'Detail strip',          thumbnail: THUMBS.detailStrip  },
    { id: WS_COMPONENT_IDS.about,        label: 'About / description',   thumbnail: THUMBS.about        },
    { id: WS_COMPONENT_IDS.facilitator,  label: 'Facilitator bio',       thumbnail: THUMBS.facilitator  },
    { id: WS_COMPONENT_IDS.schedule,     label: 'Session schedule',      thumbnail: THUMBS.schedule     },
    { id: WS_COMPONENT_IDS.gallery,      label: 'Media gallery',         thumbnail: THUMBS.gallery      },
    { id: WS_COMPONENT_IDS.testimonials, label: 'Participant quotes',    thumbnail: THUMBS.testimonials },
    { id: WS_COMPONENT_IDS.related,      label: 'Related workshops',     thumbnail: THUMBS.related      },
    { id: WS_COMPONENT_IDS.register,     label: 'Registration block',    thumbnail: THUMBS.register     },
  ]

  sections.forEach(s =>
    registerWsSection(editor, { ...s, html: CONTENT(s.id) })
  )
}
