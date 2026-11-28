# 02 · Field treatments and wizard step placements

File: `designs/Surface Forms.dc.html` (canvas of options; the ids are stable). Sources: `packages/cms-ui/src/wizard/{fields.css,StepIndicator.tsx,WizardNav.tsx}`.

## Fields (turn 1)
- **1a Stacked.** fields.css as shipped: label .86rem bold, input padding 9/11, hint .78rem. In the prototypes the input is sunken (#2e3239) and lined with --sf-line (#727a86); fields.css as shipped uses --sf-rule. Focus: 2px kind outline, 1px offset. **Used for Description.**
- **1b Registry.** SurfaceFacts made editable: mono label column (92px), value with an underline only, 2px kind underline on focus.
- **1c Edit in place.** A read-only record; hover shows a dashed outline and a pencil. One value at a time becomes an input with ✓ / ✕ (28px). **Used for captions on Details.**
- **1d Sentence.** A fill-in sentence with underlined slots; an unset slot is dashed in the place colour. A candidate for "Offer a tour".
- **1e Write the page.** Fields styled as the tour page they make (display title, lede, practical chips).
- **1f Row card.** Expandable list rows (28px pin, title, mono meta, chevron). The open row holds the place card, private notes, notes, duration and media; Add and Confirm are rows in the same list. **Used for Route stops.**
- **1g One question per sheet.** Phone bottom sheet with a 6-segment progress bar and one large field.

## Steps (turn 2)
- **2a Hairline split** (the pick). The masthead's 2px kind line becomes 3 equal segments, each a button: `0n` mono .62rem, label .98rem, status mono .66rem. States: on (kind line, 7% wash), done (kind 55% line, ✓), todo (line #727a86), warn (status in danger, set after a failed finish).
- **2b Chips in the masthead** (StepIndicator "chips"). An invalid step stays clickable.
- **2c Rail as a table of contents** (200px), with filled-in summaries per step.
- **2d Foot-led bar** for phones (StepIndicator "bar"), between Back and Next.

No step blocks on validation; only Finish checks.
