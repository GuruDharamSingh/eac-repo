/**
 * EAC Glowing CTA Section — GrapesJS Component + Block
 */

const ACCENT_MAP = {
  blue:   '59, 130, 246',
  violet: '120, 80, 220',
  teal:   '20, 160, 120',
  coral:  '200, 80, 40',
}

function eacCtaGlowScript() {
  const root = this
  const textMap = {
    headingText: '[data-trait="headingText"]',
    subText:     '[data-trait="subText"]',
    primaryLabel:'[data-trait="primaryLabel"]',
    ghostLabel:  '[data-trait="ghostLabel"]',
  }
  for (const [prop, sel] of Object.entries(textMap)) {
    const node = root.querySelector(sel)
    const val  = root.getAttribute(`data-${prop}`)
    if (node && val) node.textContent = val
  }
  ;['primary','ghost'].forEach(k => {
    const a = root.querySelector(`[data-href-trait="${k}Href"]`)
    if (a) a.href = root.getAttribute(`data-${k}Href`) || '#'
  })
  const ghost = root.querySelector('.eac-cta-glow__btn--ghost')
  if (ghost)
    ghost.style.display = root.getAttribute('data-showGhost') === '0' ? 'none' : ''

  const accent = root.getAttribute('data-accentColor') || 'blue'
  const ACCENTS = { blue:'59,130,246', violet:'120,80,220', teal:'20,160,120', coral:'200,80,40' }
  if (ACCENTS[accent]) root.style.setProperty('--eac-cta-accent-rgb', ACCENTS[accent])
}

export function registerEacCtaGlowComponent(editor) {
  editor.Components.addType('eac-cta-glow', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-cta-glow'),
    model: {
      defaults: {
        name: 'Glowing CTA', droppable: false, copyable: true,
        traits: [
          { type:'text',     name:'headingText',  label:'Heading',              placeholder:'Ready to create something together?', changeProp:true },
          { type:'textarea', name:'subText',       label:'Subheadline',          changeProp:true },
          { type:'text',     name:'primaryLabel',  label:'Primary button label', placeholder:'Join the collective', changeProp:true },
          { type:'text',     name:'primaryHref',   label:'Primary button URL',   placeholder:'/join',              changeProp:true },
          { type:'text',     name:'ghostLabel',    label:'Ghost button label',   placeholder:'Browse workshops',   changeProp:true },
          { type:'text',     name:'ghostHref',     label:'Ghost button URL',     placeholder:'/workshops',         changeProp:true },
          { type:'checkbox', name:'showGhost',     label:'Show ghost button',    valueTrue:'1', valueFalse:'0',    changeProp:true },
          {
            type:'select', name:'accentColor', label:'Accent colour', changeProp:true,
            options:[
              {id:'blue',   name:'Blue (default)'},{id:'violet',name:'Violet'},
              {id:'teal',   name:'Teal'},          {id:'coral', name:'Coral'},
            ],
          },
        ],
        'script-props': ['headingText','subText','primaryLabel','primaryHref','ghostLabel','ghostHref','showGhost','accentColor'],
        script: eacCtaGlowScript,
        attributes: {
          'data-headingText': 'Ready to create something together?',
          'data-subText':     'Join the collective. Your first workshop is free.',
          'data-primaryLabel':'Join the collective',
          'data-primaryHref': '/join',
          'data-ghostLabel':  'Browse workshops',
          'data-ghostHref':   '/workshops',
          'data-showGhost':   '1',
          'data-accentColor': 'blue',
        },
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#0f172a"/>
  <ellipse cx="20" cy="11" rx="14" ry="9" fill="rgba(59,130,246,.15)"/>
  <rect x="8"  y="6"  width="24" height="3" rx="1" fill="#fff" opacity=".9"/>
  <rect x="12" y="11" width="16" height="2" rx="1" fill="#fff" opacity=".35"/>
  <rect x="9"  y="17" width="9"  height="5" rx="2" fill="#3b82f6"/>
  <rect x="20" y="17" width="9"  height="5" rx="2" fill="none" stroke="#fff" stroke-width=".5" opacity=".4"/>
</svg>`.trim()

const CONTENT = `<section class="eac-cta-glow" data-gjs-type="eac-cta-glow"
  data-headingText="Ready to create something together?"
  data-subText="Join the collective. Your first workshop is free."
  data-primaryLabel="Join the collective" data-primaryHref="/join"
  data-ghostLabel="Browse workshops"      data-ghostHref="/workshops"
  data-showGhost="1" data-accentColor="blue">
  <div class="eac-cta-glow__bg" aria-hidden="true"><div class="eac-cta-glow__glow"></div></div>
  <div class="eac-cta-glow__inner">
    <h2 class="eac-cta-glow__heading" data-gjs-editable="true" data-trait="headingText">Ready to create something together?</h2>
    <p  class="eac-cta-glow__sub"     data-gjs-editable="true" data-trait="subText">Join the collective. Your first workshop is free.</p>
    <div class="eac-cta-glow__btn-row">
      <a href="/join"      class="eac-cta-glow__btn eac-cta-glow__btn--primary" data-trait="primaryLabel" data-href-trait="primaryHref">Join the collective</a>
      <a href="/workshops" class="eac-cta-glow__btn eac-cta-glow__btn--ghost"   data-trait="ghostLabel"   data-href-trait="ghostHref">Browse workshops</a>
    </div>
  </div>
</section>`.trim()

export function registerEacCtaGlowBlock(editor) {
  editor.Blocks.add('eac-cta-glow', {
    label:'Glowing CTA', category:'EAC — Sections',
    media: THUMBNAIL, content: CONTENT, select: true,
  })
}

export function registerEacCtaGlow(editor) {
  registerEacCtaGlowComponent(editor)
  registerEacCtaGlowBlock(editor)
}
