/**
 * EAC Contact Form — GrapesJS Component + Block
 *
 * The component script handles:
 *   - trait → DOM sync (heading, sub, submit label, microcopy)
 *   - form submission to the webhookUrl trait via fetch POST
 *   - inline validation feedback on submit attempt
 *   - success / error state rendering
 */

function eacContactScript() {
  const root = this

  /* ── Text trait sync ────────────────────────────────────── */
  const textMap = {
    headingText:  '[data-trait="headingText"]',
    subText:      '[data-trait="subText"]',
    submitLabel:  '[data-trait="submitLabel"]',
    microcopyText:'[data-trait="microcopyText"]',
  }
  for (const [prop, sel] of Object.entries(textMap)) {
    const node = root.querySelector(sel)
    const val  = root.getAttribute(`data-${prop}`)
    if (node && val) node.textContent = val
  }

  /* ── Webhook form submission ────────────────────────────── */
  const form    = root.querySelector('[data-webhook-target]')
  const btn     = root.querySelector('.eac-contact__btn')
  const success = root.querySelector('.eac-contact__success')
  const error   = root.querySelector('.eac-contact__error')
  const webhook = root.getAttribute('data-webhookUrl')

  if (!form || !webhook) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    /* Mark fields as touched for invalid styling */
    form.querySelectorAll('input, textarea').forEach(f =>
      f.classList.add('eac-contact--touched')
    )
    if (!form.checkValidity()) return

    btn.disabled    = true
    btn.textContent = 'Sending…'
    success.hidden  = true
    error.hidden    = true

    try {
      const data = Object.fromEntries(new FormData(form))
      const res  = await fetch(webhook, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Network response not ok')
      success.hidden  = false
      form.reset()
      form.querySelectorAll('input, textarea').forEach(f =>
        f.classList.remove('eac-contact--touched')
      )
    } catch {
      error.hidden = false
    } finally {
      btn.disabled    = false
      btn.textContent = root.getAttribute('data-submitLabel') || 'Send a message'
    }
  })
}

export function registerEacContactComponent(editor) {
  editor.Components.addType('eac-contact', {
    isComponent: el =>
      el.tagName === 'SECTION' && el.classList.contains('eac-contact'),
    model: {
      defaults: {
        name: 'Contact form', droppable: false, copyable: true,
        traits: [
          { type:'text',     name:'headingText',   label:'Heading',        placeholder:'Get in touch',                    changeProp:true },
          { type:'textarea', name:'subText',        label:'Subheadline',    changeProp:true },
          { type:'text',     name:'submitLabel',    label:'Submit label',   placeholder:'Send a message',                 changeProp:true },
          { type:'text',     name:'microcopyText',  label:'Microcopy',      placeholder:'No spam. We reply in 2 days.',   changeProp:true },
          { type:'text',     name:'webhookUrl',     label:'Webhook URL',    placeholder:'https://your-api/contact',       changeProp:true },
          { type:'text',     name:'successMessage', label:'Success message', placeholder:'Message sent — thank you!',     changeProp:true },
        ],
        'script-props': ['headingText','subText','submitLabel','microcopyText','webhookUrl','successMessage'],
        script: eacContactScript,
        attributes: {
          'data-headingText':   'Get in touch',
          'data-subText':       'Questions, collaboration ideas, or workshop enquiries — we read everything.',
          'data-submitLabel':   'Send a message',
          'data-microcopyText': 'No spam. We reply within 2 business days.',
          'data-webhookUrl':    '',
          'data-successMessage':'Message sent — thank you!',
        },
      },
    },
  })
}

const THUMBNAIL = `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="28" rx="3" fill="#f9fafb"/>
  <rect x="8"  y="3"  width="24" height="3"   rx="1"   fill="#111827" opacity=".6"/>
  <rect x="10" y="8"  width="20" height="1.5" rx=".75" fill="#9ca3af" opacity=".5"/>
  <rect x="8"  y="12" width="24" height="4"   rx="1.5" fill="#fff" stroke="#d1d5db" stroke-width=".5"/>
  <rect x="8"  y="18" width="24" height="4"   rx="1.5" fill="#fff" stroke="#d1d5db" stroke-width=".5"/>
  <rect x="8"  y="24" width="24" height="4"   rx="2"   fill="#111827"/>
</svg>`.trim()

export function registerEacContactBlock(editor) {
  editor.Blocks.add('eac-contact', {
    label:'Contact form', category:'EAC — Sections',
    media: THUMBNAIL,
    content: { type: 'eac-contact' },
    select: true,
  })
}

export function registerEacContact(editor) {
  registerEacContactComponent(editor)
  registerEacContactBlock(editor)
}
