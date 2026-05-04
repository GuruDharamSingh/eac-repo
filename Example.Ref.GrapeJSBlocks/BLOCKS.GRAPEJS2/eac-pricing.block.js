/**
 * EAC Pricing Table — GrapesJS Component + Block
 */

function eacPricingScript() {
  const root = this
  const map = { eyebrowText:'[data-trait="eyebrowText"]', headingText:'[data-trait="headingText"]' }
  for (const [prop, sel] of Object.entries(map)) {
    const node = root.querySelector(sel)
    const val  = root.getAttribute(`data-${prop}`)
    if (node && val) node.textContent = val
  }
  ;['tier1','tier2','tier3'].forEach(k => {
    const a = root.querySelector(`[data-trait="${k}Href"]`)
    if (a) a.href = root.getAttribute(`data-${k}Href`) || '#'
  })
}

export function registerEacPricingComponent(editor) {
  editor.Components.addType('eac-pricing', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-pricing'),
    model: {
      defaults: {
        name: 'Pricing table', droppable: false, copyable: true,
        traits: [
          { type:'text', name:'eyebrowText', label:'Eyebrow',  placeholder:'Membership',                    changeProp:true },
          { type:'text', name:'headingText', label:'Heading',  placeholder:'Join at the level that fits you', changeProp:true },
          { type:'text', name:'tier1Href',   label:'Tier 1 URL', placeholder:'/join/community',   changeProp:true },
          { type:'text', name:'tier2Href',   label:'Tier 2 URL', placeholder:'/join/practitioner', changeProp:true },
          { type:'text', name:'tier3Href',   label:'Tier 3 URL', placeholder:'/join/collective',  changeProp:true },
        ],
        'script-props': ['eyebrowText','headingText','tier1Href','tier2Href','tier3Href'],
        script: eacPricingScript,
        attributes: {
          'data-eyebrowText': 'Membership',
          'data-headingText': 'Join at the level that fits you',
          'data-tier1Href':   '/join/community',
          'data-tier2Href':   '/join/practitioner',
          'data-tier3Href':   '/join/collective',
        },
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#f9fafb"/>
  <rect x="1"  y="4"  width="11" height="20" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="14" y="2"  width="12" height="24" rx="2" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>
  <rect x="27" y="4"  width="11" height="20" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="17" y="5"  width="6" height="2" rx="1" fill="#3b82f6"/>
  <rect x="3"  y="7"  width="5" height="1.5" rx=".75" fill="#9ca3af"/>
  <rect x="29" y="7"  width="5" height="1.5" rx=".75" fill="#9ca3af"/>
  <rect x="17" y="9"  width="4" height="3"   rx=".5"  fill="#111827"/>
  <rect x="3"  y="11" width="4" height="2"   rx=".5"  fill="#111827" opacity=".6"/>
  <rect x="29" y="11" width="4" height="2"   rx=".5"  fill="#111827" opacity=".6"/>
</svg>`.trim()

export function registerEacPricingBlock(editor) {
  editor.Blocks.add('eac-pricing', {
    label:'Pricing table', category:'EAC — Sections',
    media: THUMBNAIL,
    content: { type: 'eac-pricing' },
    select: true,
  })
}

export function registerEacPricing(editor) {
  registerEacPricingComponent(editor)
  registerEacPricingBlock(editor)
}
