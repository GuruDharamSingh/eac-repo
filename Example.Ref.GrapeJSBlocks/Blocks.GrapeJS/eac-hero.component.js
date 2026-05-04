/**
 * EAC Dark Cinematic Hero — GrapesJS Component Type
 * ===================================================
 * Registers the `eac-hero` component type with the GrapesJS editor.
 *
 * Usage (inside your Silex client plugin or GrapesJS init):
 *
 *   import { registerEacHeroComponent } from './eac-hero.component.js'
 *   registerEacHeroComponent(editor)
 *
 * The component is intentionally NOT droppable — all content changes
 * go through the traits panel or inline text editing. This prevents
 * non-technical collective members from accidentally breaking the
 * layer structure by dragging foreign blocks into the section.
 */

/**
 * Maps accent preset names to their RGB triplets.
 * These drive the --eac-hero-accent-rgb CSS custom property.
 * @type {Record<string, string>}
 */
const ACCENT_MAP = {
  violet: '120, 80, 220',
  teal:   '20, 160, 120',
  coral:  '200, 80, 40',
  amber:  '180, 140, 0',
}

/**
 * Trait definitions for the EAC Hero component.
 * Grouped: Content → Primary CTA → Ghost CTA → Visual.
 */
const EAC_HERO_TRAITS = [
  // ── Content ──────────────────────────────────────────────────
  {
    type:        'text',
    name:        'eyebrowText',
    label:       'Eyebrow text',
    placeholder: 'e.g. Elkdonis Arts Collective',
    changeProp:  true,
  },
  {
    type:        'text',
    name:        'headlineText',
    label:       'Headline',
    placeholder: 'Where art finds its community',
    changeProp:  true,
  },
  {
    type:       'textarea',
    name:       'subText',
    label:      'Subheadline',
    changeProp: true,
  },

  // ── Primary CTA ──────────────────────────────────────────────
  {
    type:        'text',
    name:        'primaryLabel',
    label:       'Primary button label',
    placeholder: 'Explore workshops',
    changeProp:  true,
  },
  {
    type:        'text',
    name:        'primaryHref',
    label:       'Primary button URL',
    placeholder: '/workshops',
    changeProp:  true,
  },

  // ── Ghost CTA ────────────────────────────────────────────────
  {
    type:        'text',
    name:        'ghostLabel',
    label:       'Ghost button label',
    placeholder: 'Meet the collective',
    changeProp:  true,
  },
  {
    type:        'text',
    name:        'ghostHref',
    label:       'Ghost button URL',
    placeholder: '/about',
    changeProp:  true,
  },

  // ── Visual ───────────────────────────────────────────────────
  {
    type:    'select',
    name:    'accentColor',
    label:   'Accent colour',
    options: [
      { id: 'violet', name: 'Violet (default)' },
      { id: 'teal',   name: 'Teal'             },
      { id: 'coral',  name: 'Coral'            },
      { id: 'amber',  name: 'Amber'            },
    ],
    changeProp: true,
  },
  {
    type:        'checkbox',
    name:        'showGhostBtn',
    label:       'Show ghost button',
    valueTrue:   '1',
    valueFalse:  '0',
    changeProp:  true,
  },
  {
    type:       'number',
    name:       'minHeight',
    label:      'Min height (vh)',
    min:        50,
    max:        100,
    step:       5,
    changeProp: true,
  },
]

/**
 * The component script runs both inside the GrapesJS canvas
 * and in the final exported HTML. It syncs trait attribute values
 * onto the relevant child DOM nodes.
 *
 * GrapesJS serialises this function to a string — it must be
 * self-contained (no closure references to outer scope).
 */
function eacHeroScript() {
  const root = this

  // ── Text content traits → DOM ─────────────────────────────────
  const TEXT_TRAITS = {
    eyebrowText:  '[data-trait="eyebrowText"]',
    headlineText: '[data-trait="headlineText"]',
    subText:      '[data-trait="subText"]',
    primaryLabel: '[data-trait="primaryLabel"]',
    ghostLabel:   '[data-trait="ghostLabel"]',
  }

  for (const [prop, selector] of Object.entries(TEXT_TRAITS)) {
    const node  = root.querySelector(selector)
    const value = root.getAttribute(`data-${prop}`)
    if (node && value) node.textContent = value
  }

  // ── href traits → anchor elements ────────────────────────────
  const HREF_TRAITS = ['primary', 'ghost']
  for (const key of HREF_TRAITS) {
    const anchor = root.querySelector(`[data-href-trait="${key}Href"]`)
    if (anchor) {
      anchor.href = root.getAttribute(`data-${key}Href`) || '#'
    }
  }

  // ── Ghost button visibility ───────────────────────────────────
  const ghost = root.querySelector('.eac-hero__btn--ghost')
  if (ghost) {
    ghost.style.display =
      root.getAttribute('data-showGhostBtn') === '0' ? 'none' : ''
  }

  // ── Accent colour → CSS custom property ──────────────────────
  const accent = root.getAttribute('data-accentColor') || 'violet'
  const ACCENTS = {
    violet: '120, 80, 220',
    teal:   '20, 160, 120',
    coral:  '200, 80, 40',
    amber:  '180, 140, 0',
  }
  if (ACCENTS[accent]) {
    root.style.setProperty('--eac-hero-accent-rgb', ACCENTS[accent])
  }

  // ── Min height → CSS custom property ─────────────────────────
  const minH = root.getAttribute('data-minHeight')
  if (minH) {
    root.style.setProperty('--eac-hero-min-height', `${minH}vh`)
  }
}

/**
 * Registers the eac-hero component type with a GrapesJS editor instance.
 *
 * @param {import('grapesjs').Editor} editor
 */
export function registerEacHeroComponent(editor) {
  editor.Components.addType('eac-hero', {
    /**
     * Detect existing HTML in the canvas so re-loaded pages
     * correctly identify the component type.
     */
    isComponent: (el) =>
      el.tagName === 'SECTION' && el.classList.contains('eac-hero'),

    model: {
      defaults: {
        name:      'Dark hero',
        tagName:   'section',
        droppable: false,   // children managed via traits, not drag-and-drop
        copyable:  true,
        resizable: false,
        traits:    EAC_HERO_TRAITS,
        script:    eacHeroScript,

        // Attribute names that GrapesJS should watch and re-run
        // the script on change (must match the `data-{name}` pattern
        // used in the script above).
        'script-props': [
          'eyebrowText',
          'headlineText',
          'subText',
          'primaryLabel',
          'primaryHref',
          'ghostLabel',
          'ghostHref',
          'accentColor',
          'showGhostBtn',
          'minHeight',
        ],

        // Default attribute values written onto the root element
        attributes: {
          'data-eyebrowText':  'Elkdonis Arts Collective',
          'data-headlineText': 'Where art finds its community',
          'data-subText':      'A home for artists, makers, and creative practitioners across disciplines.',
          'data-primaryLabel': 'Explore workshops',
          'data-primaryHref':  '/workshops',
          'data-ghostLabel':   'Meet the collective',
          'data-ghostHref':    '/about',
          'data-accentColor':  'violet',
          'data-showGhostBtn': '1',
          'data-minHeight':    '90',
        },
      },
    },
  })
}
