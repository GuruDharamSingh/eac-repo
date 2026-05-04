/**
 * EAC Testimonials — GrapesJS Component + Block
 */

function eacTestimonialsScript() {
  const root = this
  const map = { eyebrowText:'[data-trait="eyebrowText"]', headingText:'[data-trait="headingText"]' }
  for (const [prop, sel] of Object.entries(map)) {
    const node = root.querySelector(sel)
    const val  = root.getAttribute(`data-${prop}`)
    if (node && val) node.textContent = val
  }
}

export function registerEacTestimonialsComponent(editor) {
  editor.Components.addType('eac-testimonials', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-testimonials'),
    model: {
      defaults: {
        name: 'Testimonials', droppable: false, copyable: true,
        traits: [
          { type:'text', name:'eyebrowText', label:'Eyebrow',  placeholder:'From our community', changeProp:true },
          { type:'text', name:'headingText', label:'Heading',  placeholder:'What members say',   changeProp:true },
          {
            type:'select', name:'columns', label:'Columns', changeProp:true,
            options:[{id:'2',name:'2 columns (default)'},{id:'3',name:'3 columns'}],
          },
        ],
        'script-props': ['eyebrowText','headingText','columns'],
        script: eacTestimonialsScript,
        attributes: {
          'data-eyebrowText': 'From our community',
          'data-headingText': 'What members say',
          'data-columns':     '2',
        },
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#f9fafb"/>
  <rect x="2"  y="2" width="17" height="24" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="21" y="2" width="17" height="24" rx="2" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>
  <rect x="4"  y="5"  width="8" height="1.5" rx=".75" fill="#f59e0b"/>
  <rect x="4"  y="8"  width="13" height="1"   rx=".5"  fill="#9ca3af" opacity=".6"/>
  <rect x="4"  y="10" width="11" height="1"   rx=".5"  fill="#9ca3af" opacity=".6"/>
  <circle cx="6" cy="21" r="2.5" fill="#dbeafe"/>
  <rect x="10" y="19.5" width="7" height="1" rx=".5" fill="#374151"/>
  <rect x="10" y="22"   width="5" height="1" rx=".5" fill="#9ca3af"/>
  <rect x="23" y="5"  width="8" height="1.5" rx=".75" fill="#f59e0b"/>
  <rect x="23" y="8"  width="13" height="1"   rx=".5"  fill="#9ca3af" opacity=".6"/>
  <rect x="23" y="10" width="11" height="1"   rx=".5"  fill="#9ca3af" opacity=".6"/>
  <circle cx="25" cy="21" r="2.5" fill="#fce7f3"/>
  <rect x="29" y="19.5" width="7" height="1" rx=".5" fill="#374151"/>
  <rect x="29" y="22"   width="5" height="1" rx=".5" fill="#9ca3af"/>
</svg>`.trim()

const CARD = (initials, quote, name, role, avatarBg, avatarColor) =>
`<div class="eac-testimonials__card">
  <div class="eac-testimonials__stars" aria-label="5 out of 5 stars">${'<span class="eac-testimonials__star" aria-hidden="true"></span>'.repeat(5)}</div>
  <blockquote class="eac-testimonials__quote" data-gjs-editable="true">${quote}</blockquote>
  <div class="eac-testimonials__attribution">
    <div class="eac-testimonials__avatar" style="background:${avatarBg};color:${avatarColor}" aria-hidden="true">${initials}</div>
    <div class="eac-testimonials__author">
      <span class="eac-testimonials__name" data-gjs-editable="true">${name}</span>
      <span class="eac-testimonials__role" data-gjs-editable="true">${role}</span>
    </div>
  </div>
</div>`

const CONTENT = `<section class="eac-testimonials" data-gjs-type="eac-testimonials"
  data-eyebrowText="From our community" data-headingText="What members say" data-columns="2">
  <div class="eac-testimonials__inner">
    <div class="eac-testimonials__header">
      <span class="eac-testimonials__eyebrow" data-gjs-editable="true" data-trait="eyebrowText">From our community</span>
      <h2 class="eac-testimonials__heading" data-gjs-editable="true" data-trait="headingText">What members say</h2>
    </div>
    <div class="eac-testimonials__grid">
      ${CARD('SK','The writing workshop with Dana changed how I approach every creative project. There\'s nowhere else in Toronto like it.','Sarah K.','Poet &amp; visual artist','#dbeafe','#1e40af')}
      ${CARD('NR','Ario\'s drum circle was the most alive I\'ve felt in a room of strangers. I\'ve been back every month since.','Neel R.','Musician &amp; sound designer','#fce7f3','#9d174d')}
    </div>
  </div>
</section>`.trim()

export function registerEacTestimonialsBlock(editor) {
  editor.Blocks.add('eac-testimonials', {
    label:'Testimonials', category:'EAC — Sections',
    media: THUMBNAIL, content: CONTENT, select: true,
  })
}

export function registerEacTestimonials(editor) {
  registerEacTestimonialsComponent(editor)
  registerEacTestimonialsBlock(editor)
}
