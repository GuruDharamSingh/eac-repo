/**
 * EAC Feature Grid — GrapesJS Component Type
 */

function eacFeatureGridScript() {
  const root = this
  const eyebrow = root.querySelector('[data-trait="eyebrowText"]')
  const heading  = root.querySelector('[data-trait="headingText"]')
  if (eyebrow && root.getAttribute('data-eyebrowText'))
    eyebrow.textContent = root.getAttribute('data-eyebrowText')
  if (heading && root.getAttribute('data-headingText'))
    heading.textContent = root.getAttribute('data-headingText')

  const cols = root.getAttribute('data-columns') || '3'
  root.style.setProperty('--eac-fg-cols', cols)
}

export function registerEacFeatureGridComponent(editor) {
  editor.Components.addType('eac-feature-grid', {
    isComponent: (el) =>
      el.tagName === 'SECTION' && el.classList.contains('eac-feature-grid'),

    model: {
      defaults: {
        name:      'Feature grid',
        droppable: false,
        copyable:  true,
        traits: [
          {
            type: 'text', name: 'eyebrowText', label: 'Eyebrow text',
            placeholder: 'What we offer', changeProp: true,
          },
          {
            type: 'text', name: 'headingText', label: 'Section heading',
            placeholder: 'Three pillars of the collective', changeProp: true,
          },
          {
            type: 'select', name: 'columns', label: 'Columns',
            options: [
              { id: '2', name: '2 columns' },
              { id: '3', name: '3 columns (default)' },
              { id: '4', name: '4 columns' },
            ],
            changeProp: true,
          },
        ],
        'script-props': ['eyebrowText', 'headingText', 'columns'],
        script: eacFeatureGridScript,
        attributes: {
          'data-eyebrowText': 'What we offer',
          'data-headingText': 'Three pillars of the collective',
          'data-columns':     '3',
        },
      },
    },
  })
}
