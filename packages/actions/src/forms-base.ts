// The declared forms of the first seven in-dock entries (2026-11-27, lane E): they were hand-made React
// components in packages/dock/src/forms.tsx and are data now. Same fields, same behaviour. Lane F's forms go in
// forms-wave1.ts. Client-safe.
import type { ActionForm } from './fields';

export const FORMS_BASE: readonly ActionForm[] = [
  {
    entry: 'profile',
    submitLabel: 'Save',
    fields: [
      { kind: 'text', name: 'displayName', label: 'Name', maxLength: 120, required: true },
      { kind: 'text', name: 'headline', label: 'One line about what you do', maxLength: 200 },
      { kind: 'textarea', name: 'bio', label: 'About', maxLength: 4000, rows: 4 },
    ],
  },
  {
    entry: 'store-front',
    submitLabel: 'Save',
    fields: [
      {
        kind: 'textarea', name: 'note', label: 'Store front description', rows: 4, maxLength: 1200, required: true,
        placeholder: 'Two or three lines collectors read above your work.',
        fillFrom: { from: 'bio', label: 'Fill from my directory bio' },
      },
    ],
  },
  {
    entry: 'ship-from',
    submitLabel: 'Save',
    fields: [
      { kind: 'text', name: 'recipientName', label: 'Name on the label', maxLength: 120, required: true },
      { kind: 'text', name: 'line1', label: 'Street', maxLength: 200, required: true },
      { kind: 'text', name: 'city', label: 'City', maxLength: 120, required: true },
      { kind: 'text', name: 'region', label: 'Province or state', maxLength: 120 },
      { kind: 'text', name: 'postalCode', label: 'Postal code', maxLength: 20, required: true },
      { kind: 'text', name: 'country', label: 'Country (two letters: CA, US, FR…)', maxLength: 2, minLength: 2, required: true },
      { kind: 'text', name: 'phone', label: 'Phone, for the courier', inputType: 'tel', maxLength: 40, required: true, help: 'Private: only the city shows on your store. Couriers quote and label from it.' },
    ],
  },
  {
    entry: 'listing',
    submitLabel: 'Save',
    needsChange: true,
    fields: [{ kind: 'toggle', name: 'listed', label: 'Show my page in the artists’ directory' }],
  },
  {
    entry: 'org-details',
    submitLabel: 'Save',
    fields: [
      { kind: 'text', name: 'headline', label: 'One line about the organisation', maxLength: 200 },
      { kind: 'textarea', name: 'bio', label: 'About it', rows: 4, maxLength: 4000 },
    ],
    confirmVars: { name: 'headline' },
  },
  {
    entry: 'org-email',
    submitLabel: 'Save',
    fields: [
      { kind: 'text', name: 'fromName', label: 'Sending name', maxLength: 100, placeholder: 'The name people see in their inbox' },
      { kind: 'text', name: 'replyTo', label: 'Reply-to address', inputType: 'email', maxLength: 200, placeholder: 'Where replies should go' },
    ],
    confirmVars: { name: 'fromName', email: 'replyTo' },
  },
  {
    entry: 'pen-name',
    submitLabel: 'Create',
    fields: [{ kind: 'text', name: 'displayName', label: 'The pen name', minLength: 2, maxLength: 120, required: true, placeholder: 'The name you want to write under' }],
    confirmVars: { name: 'displayName' },
  },
  {
    entry: 'writing-start',
    submitLabel: 'Start',
    fields: [{ kind: 'text', name: 'title', label: 'Title of the piece', maxLength: 200, required: true, placeholder: 'You can change it later' }],
    confirmVars: { title: 'title' },
  },
];
