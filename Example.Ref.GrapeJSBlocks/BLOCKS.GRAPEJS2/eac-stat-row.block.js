/**
 * EAC Stats Row — GrapesJS Component + Block
 *
 * The component script handles the count-up animation via
 * IntersectionObserver + requestAnimationFrame. It is self-contained
 * so GrapesJS can serialise it into exported HTML where it runs at runtime.
 */

function eacStatsScript() {
  /* Count-up animation ─────────────────────────────────────── */
  function animateCounter(el) {
    const target   = parseInt(el.getAttribute('data-target') || '0', 10)
    const suffix   = el.getAttribute('data-suffix') || ''
    const duration = 1200
    const start    = performance.now()

    function step(now) {
      const elapsed  = Math.min(now - start, duration)
      const progress = elapsed / duration
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3)
      const value    = Math.round(eased * target)
      el.textContent = value.toLocaleString() + suffix
      if (elapsed < duration) requestAnimationFrame(step)
      else el.textContent = target.toLocaleString() + suffix
    }
    requestAnimationFrame(step)
  }

  const numbers = this.querySelectorAll('.eac-stats__number[data-target]')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCounter(e.target)
          observer.unobserve(e.target)
        }
      })
    },
    { threshold: 0.5 }
  )
  numbers.forEach(n => observer.observe(n))
}

export function registerEacStatsComponent(editor) {
  editor.Components.addType('eac-stats', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-stats'),
    model: {
      defaults: {
        name: 'Stats row', droppable: false, copyable: true,
        traits: [
          { type:'text', name:'stat1Number', label:'Stat 1 number', placeholder:'240', changeProp:true },
          { type:'text', name:'stat1Suffix', label:'Stat 1 suffix', placeholder:'+',   changeProp:true },
          { type:'text', name:'stat1Label',  label:'Stat 1 label',  placeholder:'workshops delivered', changeProp:true },
          { type:'text', name:'stat2Number', label:'Stat 2 number', placeholder:'1400', changeProp:true },
          { type:'text', name:'stat2Label',  label:'Stat 2 label',  placeholder:'community members', changeProp:true },
          { type:'text', name:'stat3Number', label:'Stat 3 number', placeholder:'12', changeProp:true },
          { type:'text', name:'stat3Label',  label:'Stat 3 label',  placeholder:'disciplines represented', changeProp:true },
        ],
        'script-props': [],
        script: eacStatsScript,
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#fff"/>
  <rect x="0" y="0" width="40" height="28" rx="3" fill="#f9fafb"/>
  <rect x="1"  y="0" width="12" height="28" rx="0" fill="none" stroke="#f3f4f6" stroke-width=".5"/>
  <rect x="14" y="0" width="12" height="28" rx="0" fill="none" stroke="#f3f4f6" stroke-width=".5"/>
  <rect x="7"  y="8" width="6" height="5" rx="1" fill="#111827" opacity=".7"/>
  <rect x="20" y="8" width="6" height="5" rx="1" fill="#111827" opacity=".7"/>
  <rect x="33" y="8" width="6" height="5" rx="1" fill="#111827" opacity=".7"/>
  <rect x="5"  y="15" width="10" height="1.5" rx=".75" fill="#9ca3af"/>
  <rect x="18" y="15" width="10" height="1.5" rx=".75" fill="#9ca3af"/>
  <rect x="31" y="15" width="10" height="1.5" rx=".75" fill="#9ca3af"/>
  <rect x="8"  y="19" width="5" height="1" rx=".5" fill="#16a34a" opacity=".8"/>
  <rect x="21" y="19" width="5" height="1" rx=".5" fill="#16a34a" opacity=".8"/>
</svg>`.trim()

export function registerEacStatsBlock(editor) {
  editor.Blocks.add('eac-stats', {
    label:'Stats row', category:'EAC — Sections',
    media: THUMBNAIL,
    content: { type: 'eac-stats' },
    select: true,
  })
}

export function registerEacStats(editor) {
  registerEacStatsComponent(editor)
  registerEacStatsBlock(editor)
}
