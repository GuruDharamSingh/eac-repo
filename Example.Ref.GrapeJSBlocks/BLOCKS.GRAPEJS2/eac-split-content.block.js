/**
 * EAC Split Image / Text — GrapesJS Component + Block
 */

function eacSplitScript() {
  const root = this
  const textMap = {
    tagText:    '[data-trait="tagText"]',
    headingText:'[data-trait="headingText"]',
    bodyText:   '[data-trait="bodyText"]',
    linkText:   '[data-trait="linkText"]',
  }
  for (const [prop, sel] of Object.entries(textMap)) {
    const node = root.querySelector(sel)
    const val  = root.getAttribute(`data-${prop}`)
    if (node && val) node.textContent = val
  }
  const img = root.querySelector('[data-trait="imageSrc"]')
  if (img) {
    const src = root.getAttribute('data-imageSrc')
    const alt = root.getAttribute('data-imageAlt')
    if (src) img.src = src
    if (alt) img.alt = alt
  }
  const link = root.querySelector('[data-href-trait="linkHref"]')
  if (link) link.href = root.getAttribute('data-linkHref') || '#'

  if (root.getAttribute('data-reverse') === '1')
    root.classList.add('eac-split--reverse')
  else
    root.classList.remove('eac-split--reverse')
}

export function registerEacSplitComponent(editor) {
  editor.Components.addType('eac-split', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-split'),
    model: {
      defaults: {
        name: 'Split image / text', droppable: false, copyable: true,
        traits: [
          { type:'text',     name:'tagText',     label:'Category tag',    placeholder:'New workshops',            changeProp:true },
          { type:'text',     name:'headingText', label:'Heading',         placeholder:'Writing as a practice',    changeProp:true },
          { type:'textarea', name:'bodyText',    label:'Body text',       changeProp:true },
          { type:'text',     name:'linkText',    label:'Link label',      placeholder:'See workshop schedule →',  changeProp:true },
          { type:'text',     name:'linkHref',    label:'Link URL',        placeholder:'/workshops/writing',       changeProp:true },
          { type:'text',     name:'imageSrc',    label:'Image URL',       placeholder:'https://…',               changeProp:true },
          { type:'text',     name:'imageAlt',    label:'Image alt text',  placeholder:'Workshop in progress',    changeProp:true },
          { type:'checkbox', name:'reverse',     label:'Flip layout (image right)', valueTrue:'1', valueFalse:'0', changeProp:true },
        ],
        'script-props': ['tagText','headingText','bodyText','linkText','linkHref','imageSrc','imageAlt','reverse'],
        script: eacSplitScript,
        attributes: {
          'data-tagText':     'New workshops',
          'data-headingText': 'Writing as a practice, not a product',
          'data-bodyText':    'Dana\'s writing workshops approach the craft as a living, evolving practice.',
          'data-linkText':    'See workshop schedule →',
          'data-linkHref':    '/workshops/writing',
          'data-imageSrc':    'https://via.placeholder.com/640x480/f3f4f6/9ca3af?text=EAC',
          'data-imageAlt':    'Workshop in progress',
          'data-reverse':     '0',
        },
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#f3f4f6"/>
  <rect x="0" y="0" width="18" height="28" rx="3" fill="#e5e7eb"/>
  <rect x="20" y="5" width="6" height="2" rx="1" fill="#3b82f6" opacity=".7"/>
  <rect x="20" y="9" width="16" height="2.5" rx="1" fill="#111827" opacity=".7"/>
  <rect x="20" y="13" width="13" height="1.5" rx=".75" fill="#111827" opacity=".5"/>
  <rect x="20" y="16" width="14" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/>
  <rect x="20" y="19" width="14" height="1.5" rx=".75" fill="#9ca3af" opacity=".6"/>
  <rect x="20" y="23" width="8" height="1.5" rx=".75" fill="#3b82f6" opacity=".8"/>
</svg>`.trim()

export function registerEacSplitBlock(editor) {
  editor.Blocks.add('eac-split', {
    label:'Split image / text', category:'EAC — Sections',
    media: THUMBNAIL,
    content: { type: 'eac-split' },
    select: true,
  })
}

export function registerEacSplit(editor) {
  registerEacSplitComponent(editor)
  registerEacSplitBlock(editor)
}
