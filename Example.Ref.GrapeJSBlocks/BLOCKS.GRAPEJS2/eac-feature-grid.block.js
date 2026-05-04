/**
 * EAC Feature Grid — GrapesJS Block Registration
 */

import { registerEacFeatureGridComponent } from './eac-feature-grid.component.js'

const THUMBNAIL = `
<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#f9fafb"/>
  <rect x="12" y="3" width="16" height="2" rx="1" fill="#d1d5db"/>
  <rect x="8"  y="7" width="24" height="3" rx="1" fill="#111827" opacity=".7"/>
  <rect x="2"  y="14" width="10" height="10" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="15" y="14" width="10" height="10" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="28" y="14" width="10" height="10" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="4"  y="16" width="6" height="6" rx="1" fill="#fef3c7"/>
  <rect x="17" y="16" width="6" height="6" rx="1" fill="#dbeafe"/>
  <rect x="30" y="16" width="6" height="6" rx="1" fill="#dcfce7"/>
</svg>`.trim()

const CONTENT = `
<section class="eac-feature-grid" data-gjs-type="eac-feature-grid"
  data-eyebrowText="What we offer"
  data-headingText="Three pillars of the collective"
  data-columns="3">
  <div class="eac-feature-grid__inner">
    <div class="eac-feature-grid__header">
      <span class="eac-feature-grid__eyebrow" data-gjs-editable="true" data-trait="eyebrowText">What we offer</span>
      <h2 class="eac-feature-grid__heading" data-gjs-editable="true" data-trait="headingText">Three pillars of the collective</h2>
    </div>
    <div class="eac-feature-grid__grid">
      <div class="eac-feature-grid__item">
        <div class="eac-feature-grid__icon eac-feature-grid__icon--1" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L12.4 7.6L18.5 8.3L14 12.6L15.3 18.6L10 15.6L4.7 18.6L6 12.6L1.5 8.3L7.6 7.6L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
        <h3 class="eac-feature-grid__title" data-gjs-editable="true">Creative workshops</h3>
        <p class="eac-feature-grid__body" data-gjs-editable="true">Hands-on sessions across writing, movement, and sound led by collective members.</p>
      </div>
      <div class="eac-feature-grid__item">
        <div class="eac-feature-grid__icon eac-feature-grid__icon--2" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h6M10 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <h3 class="eac-feature-grid__title" data-gjs-editable="true">Artist community</h3>
        <p class="eac-feature-grid__body" data-gjs-editable="true">A network of practitioners sharing space, resources, and creative dialogue.</p>
      </div>
      <div class="eac-feature-grid__item">
        <div class="eac-feature-grid__icon eac-feature-grid__icon--3" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M6 10l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h3 class="eac-feature-grid__title" data-gjs-editable="true">Shared resources</h3>
        <p class="eac-feature-grid__body" data-gjs-editable="true">Equipment, studio time, and digital tools accessible to every member.</p>
      </div>
    </div>
  </div>
</section>`.trim()

export function registerEacFeatureGridBlock(editor) {
  editor.Blocks.add('eac-feature-grid', {
    label:    'Feature grid',
    category: 'EAC — Sections',
    media:    THUMBNAIL,
    content:  CONTENT,
    select:   true,
  })
}

export function registerEacFeatureGrid(editor) {
  registerEacFeatureGridComponent(editor)
  registerEacFeatureGridBlock(editor)
}
