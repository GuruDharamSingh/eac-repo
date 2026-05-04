/**
 * EAC Dark Cinematic Hero — GrapesJS Block Registration
 * =======================================================
 * Adds the hero to the GrapesJS block panel under the
 * "EAC — Sections" category.
 *
 * Usage (inside your Silex client plugin or GrapesJS init):
 *
 *   import { registerEacHeroBlock } from './eac-hero.block.js'
 *   registerEacHeroBlock(editor)
 *
 * This file is intentionally separate from the component definition
 * so the component type can be registered server-side (for HTML
 * parsing on load) without also re-adding the panel block.
 */

/**
 * Inline SVG thumbnail shown in the GrapesJS block panel.
 * 40×28px, dark background with white rule indicators.
 */
const BLOCK_THUMBNAIL = `
  <svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="28" rx="3" fill="#0a0a0f"/>
    <!-- Eyebrow line -->
    <rect x="14" y="5" width="12" height="1.5" rx=".75" fill="#fff" opacity=".35"/>
    <!-- Headline lines -->
    <rect x="10" y="9"  width="20" height="3" rx="1" fill="#fff" opacity=".9"/>
    <rect x="12" y="14" width="16" height="2" rx="1" fill="#fff" opacity=".55"/>
    <!-- Sub line -->
    <rect x="13" y="18" width="14" height="1.5" rx=".75" fill="#fff" opacity=".25"/>
    <!-- CTA buttons -->
    <rect x="9"  y="22" width="9" height="4" rx="2" fill="#fff" opacity=".85"/>
    <rect x="20" y="22" width="9" height="4" rx="2"
          fill="none" stroke="#fff" stroke-width=".5" opacity=".4"/>
    <!-- Ambient glow hint -->
    <ellipse cx="20" cy="10" rx="12" ry="7"
             fill="rgba(120,80,220,.12)"/>
  </svg>
`.trim()

/**
 * The HTML content string used when the block is dropped into the canvas.
 * Mirrors eac-hero.html — kept as a JS string here so the block file
 * is self-contained and importable without a fetch/fs read.
 */
const BLOCK_CONTENT = `
<section class="eac-hero" data-gjs-type="eac-hero"
  data-eyebrowText="Elkdonis Arts Collective"
  data-headlineText="Where art finds its community"
  data-subText="A home for artists, makers, and creative practitioners across disciplines."
  data-primaryLabel="Explore workshops"
  data-primaryHref="/workshops"
  data-ghostLabel="Meet the collective"
  data-ghostHref="/about"
  data-accentColor="violet"
  data-showGhostBtn="1"
  data-minHeight="90"
>
  <div class="eac-hero__bg" aria-hidden="true">
    <div class="eac-hero__glow"></div>
    <div class="eac-hero__rule"></div>
  </div>
  <div class="eac-hero__inner">
    <span class="eac-hero__eyebrow"
          data-gjs-editable="true"
          data-trait="eyebrowText">
      Elkdonis Arts Collective
    </span>
    <h1 class="eac-hero__headline"
        data-gjs-editable="true"
        data-trait="headlineText">
      Where <em class="eac-hero__headline-em">art</em>
      finds its community
    </h1>
    <p class="eac-hero__sub"
       data-gjs-editable="true"
       data-trait="subText">
      A home for artists, makers, and creative practitioners across
      disciplines. Join workshops, connect with collaborators, and
      grow together.
    </p>
    <div class="eac-hero__cta-row">
      <a href="/workshops"
         class="eac-hero__btn eac-hero__btn--primary"
         data-trait="primaryLabel"
         data-href-trait="primaryHref">
        Explore workshops
      </a>
      <a href="/about"
         class="eac-hero__btn eac-hero__btn--ghost"
         data-trait="ghostLabel"
         data-href-trait="ghostHref">
        Meet the collective
      </a>
    </div>
  </div>
</section>
`.trim()

/**
 * Registers the EAC hero block in the GrapesJS block panel.
 *
 * Call this AFTER registerEacHeroComponent() so the component
 * type is already known when the block content is parsed.
 *
 * @param {import('grapesjs').Editor} editor
 */
export function registerEacHeroBlock(editor) {
  editor.Blocks.add('eac-hero-dark', {
    label:    'Dark hero',
    category: 'EAC — Sections',
    media:    BLOCK_THUMBNAIL,
    content:  BLOCK_CONTENT,
    select:   true,   // auto-select the component after drop

    attributes: {
      title: 'Dark cinematic hero section',
    },
  })
}
