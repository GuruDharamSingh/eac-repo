/**
 * EAC Logo Marquee — GrapesJS Component + Block
 */

function eacMarqueeScript() {
  const root  = this
  const label = root.querySelector('[data-trait="labelText"]')
  const val   = root.getAttribute('data-labelText')
  if (label && val) label.textContent = val

  const speed = root.getAttribute('data-speed') || '22'
  root.style.setProperty('--eac-marquee-speed', `${speed}s`)

  const gap = root.getAttribute('data-gap') || '48'
  root.style.setProperty('--eac-marquee-gap', `${gap}px`)
}

export function registerEacMarqueeComponent(editor) {
  editor.Components.addType('eac-marquee', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-marquee'),
    model: {
      defaults: {
        name: 'Logo marquee', droppable: false, copyable: true,
        traits: [
          { type:'text',   name:'labelText', label:'Label text', placeholder:'Supported and trusted by', changeProp:true },
          { type:'number', name:'speed',     label:'Scroll speed (s, lower = faster)', min:8, max:60, step:2, changeProp:true },
          { type:'number', name:'gap',       label:'Gap between logos (px)', min:16, max:96, step:8, changeProp:true },
        ],
        'script-props': ['labelText','speed','gap'],
        script: eacMarqueeScript,
        attributes: {
          'data-labelText': 'Supported and trusted by',
          'data-speed':     '22',
          'data-gap':       '48',
        },
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#f9fafb"/>
  <rect x="12" y="4" width="16" height="1.5" rx=".75" fill="#d1d5db"/>
  <rect x="1"  y="10" width="10" height="8" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="13" y="10" width="10" height="8" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="25" y="10" width="10" height="8" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="3"  y="13" width="6" height="1.5" rx=".75" fill="#d1d5db"/>
  <rect x="15" y="13" width="6" height="1.5" rx=".75" fill="#d1d5db"/>
  <rect x="27" y="13" width="6" height="1.5" rx=".75" fill="#d1d5db"/>
  <rect x="1"  y="22" width="5" height="1.5" rx=".75" fill="#e5e7eb"/>
  <rect x="8"  y="22" width="5" height="1.5" rx=".75" fill="#e5e7eb"/>
</svg>`.trim()

export function registerEacMarqueeBlock(editor) {
  editor.Blocks.add('eac-marquee', {
    label:'Logo marquee', category:'EAC — Sections',
    media: THUMBNAIL,
    content: { type: 'eac-marquee' },
    select: true,
  })
}

export function registerEacMarquee(editor) {
  registerEacMarqueeComponent(editor)
  registerEacMarqueeBlock(editor)
}
