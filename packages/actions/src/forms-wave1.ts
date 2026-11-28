// Form declarations of wiring wave 1 (2026-11-27, rails desk lane F). One declaration per action: the dock
// draws it, the MCP reads its schema. Entries are in ./entries-wave1.ts, runners in ./server/runners-wave1.ts.
// Readers named here ('pen-names-active', 'pen-names-retired', 'post-targets') are in ./server/readers-wave1.ts.
import type { ActionForm } from './fields';

export const FORMS_WAVE1: readonly ActionForm[] = [
  {
    entry: 'profile-photo',
    fields: [{ kind: 'image', name: 'avatarUrl', label: 'Your photo', required: true, help: 'It shows on your page and in the directory.' }],
    submitLabel: 'Save photo',
  },
  {
    entry: 'profile-sections',
    fields: [
      { kind: 'choice', name: 'section', label: 'Which part of your page?', required: true, options: [{ value: 'blog', label: 'Blog' }, { value: 'store', label: 'Store', hint: 'Needs an open store.' }] },
      { kind: 'toggle', name: 'on', label: 'Show it on my page' },
    ],
    submitLabel: 'Save',
    confirmVars: { state: 'on' },
  },
  {
    entry: 'pen-name-retire',
    fields: [{ kind: 'pick', name: 'identityId', label: 'Which pen name?', reader: 'pen-names-active', required: true }],
    submitLabel: 'Retire it',
  },
  {
    entry: 'pen-name-restore',
    fields: [{ kind: 'pick', name: 'identityId', label: 'Which pen name?', reader: 'pen-names-retired', required: true }],
    submitLabel: 'Bring it back',
  },
  {
    entry: 'post-anywhere',
    fields: [
      { kind: 'pick', name: 'target', label: 'Where to post it', reader: 'post-targets', required: true },
      { kind: 'text', name: 'title', label: 'Title', required: true, maxLength: 200 },
      { kind: 'textarea', name: 'text', label: 'Your post', required: true, rows: 6, maxLength: 20000, help: 'A blank line starts a new paragraph.' },
    ],
    submitLabel: 'Post it',
    confirmVars: { title: 'title' },
  },
];
