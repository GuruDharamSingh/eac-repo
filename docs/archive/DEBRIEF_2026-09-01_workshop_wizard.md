# Debrief — Workshop wizard foundations (2026-09-01)

Continues `SESSION_BRIEF_2026-07-30.md` item 9 ("workshop wizard steps").
Everything below was re-verified at the end of the session, not just at the
time of writing. Claims are labelled **Verified**, **Assumed**, or **Unknown**.

---

## 1. What was asked

Turn inner-gathering's workshop authoring into a friendlier wizard, keep all
the Talk integrations and options, and — added mid-session — link it to
arts-collective's existing workshop template and its several CMS editing
surfaces rather than becoming yet another one.

Three subagents were spawned for scoping, wizard design, and monorepo
practices. **All three died on a monthly spend limit (HTTP 429)** before
producing anything. The work below was done inline instead. No agent output
was ever received, so nothing here rests on it.

---

## 2. The finding that reordered the work

`workshop_pages` has 35 columns. `WorkshopOfferingInput` covered 14.

A wizard built on the shared write path would have been unable to save
discipline, level, language, accessibility notes, SEO, gallery, promo video,
theming, or the section toggles — all of which the arts-collective template
renders and its live editor exposes. The columns were missing from the read
list too, so `getWorkshopOffering` never returned them.

Closing that gap had to come before any step UI. **Verified** by round-trip.

---

## 3. The four editing surfaces

| Surface | Route | Write path |
|---|---|---|
| Hub form | `/hub/workshops/[orgSlug]/{new,[threadId]}` | `saveWorkshopAction` |
| Live in-page editor | `/sites/[slug]/[contentSlug]` (owner only) | `updateWorkshopFieldByTraitAction` |
| Template preview | `/preview/workshop` | read-only |
| Silex site editor | `/edit/[slug]` | Silex (:6805) |

Plus `upsertWorkshopOffering` in `packages/services`, used by inner-gathering.
**Three write paths onto the same tables.** The wizard must not add a fourth —
`answersToOfferingInput` exists so it routes through `upsertWorkshopOffering`.

---

## 4. What was built

### `packages/services/src/workshop-offerings.ts`
Extended to the full `workshop_pages` surface: 17 previously-unwritable
columns added to the input type, read list, mapper, and both upsert arms.
`parseSessionNotes` generalised to `parseJsonb<T>`, so the three new jsonb
columns get the same protection against the historical double-encoding bug.
`priceMember` added as a first-class input (see §7 — it was a defect found in
self-review).

### `packages/cms-bindings/src/manifest.ts`
Typed template-manifest contract. `parseCmsField` returns null for
`threads.sessions[]`-style projections.

### `packages/cms-bindings/src/workshop/field-index.ts`
One reverse `table.column → registry entry` index, replacing two independent
traversals. Documented tie-breaking: editable beats readonly, direct beats
compound member, then declaration order. Also `ambiguousColumns()` for
diagnostics — which found a real bug (§7).

### `packages/cms-bindings/src/workshop/wizard-config.ts`
`buildWorkshopWizardSteps(manifest, opts)`. Steps are manifest sections;
fields are that section's `cmsFields` resolved through the index. Platform
fields (media, SEO, publishing) bypass the manifest filter.

### `packages/cms-bindings/src/workshop/offering-mapping.ts`
Trait-keyed answers → `WorkshopOfferingInput`. One explicit mapping table
rather than an `inputKey` on 49 registry entries, which makes
`unmappedColumns()` — what the wizard can show but not save — answerable.
Returns `unmapped` explicitly so nothing is silently dropped.

### `packages/cms-bindings/src/workshop/audit.ts` + `scripts/audit-workshop-template.mts`
Drift check across template HTML, manifest, and registry.
`pnpm --filter @elkdonis/cms-bindings audit:template`, exits non-zero on drift.

### `packages/cms-ui/src/wizard/WizardProvider.tsx`
Optional `steps: WizardStepMeta[]` + `isStepVisible` predicate. `step` indexes
the *visible* list so next/back skip hidden steps. Progress caches by step
**id**, not index — an index is meaningless once the step list changes.
`StepIndicator.labels` became optional, deriving from `visibleSteps`.

### Registry: 32 → 49 entries
The authorable columns that had no trait (subtitle, descriptionShort,
galleryItems, priceMember, priceSlidingMin, registrationStatus,
locationAddress, media slots, SEO) now have entries. Input union widened with
`color`/`gallery`/`media`/`boolean`, narrowed back at the live-editor boundary
by `isLiveEditorInput()` — one registry, two renderers.

---

## 5. Bugs found in existing code

1. **`roleTitle` overwrote the facilitator's name.** It mapped to
   `artist_profiles.display_name`, the same column as `fullName`, and has a
   real edit pin in the facilitator HTML. Made `readonly` as a stopgap — the
   correct target is `org_profiles.role_title`, but arts-collective's write
   path has no `org_profiles` arm, so repointing would trade corruption for a
   silent no-op. **Not resolved.**
2. **`registrationUrl` was never editable in the live editor.** Declared by
   three manifest sections, present in none of the HTML. Same for
   `priceSlidingMin`. The wizard covers both (it drives off `cmsFields`).
3. **`threads.tags` does not exist.** The about section declared it. Tags
   live only on `org_profiles`. Removed from the manifest.
4. **Nine of ten sections' `traits` disagreed with their own markup**, in both
   directions. Corrected against the HTML.
5. **`artist_profiles` has no sync to `users`/`org_profiles`.** Migration 084
   was additive and only an `updated_at` trigger exists, so live-editor
   facilitator edits diverge silently from the new tables.

---

## 6. Verification — what was actually run

**Verified (executed, output inspected):**
- All 17 new fields round-trip create → read against the live DB; jsonb comes
  back as real arrays/objects, not double-encoded strings.
- Update path (`ON CONFLICT DO UPDATE`) for every new column.
- Sessions survive being omitted from an update (wizard-critical).
- `published_at` survives publish → re-save as draft.
- Step derivation from the real manifest: 6 template + 6 platform steps, no
  column asked twice, conditional fields carried.
- A reduced manifest yields a shorter wizard (nav + hero + about → 2 steps).
- `SSR`: `in_person` hides the video-room step (3 visible, 4 declared),
  `online` shows 4, legacy `totalSteps` mode unchanged.
- Live editor still receives 36 valid defs, no invalid input types,
  `roleTitle` correctly excluded.
- Manifest still parses, 10 sections, renderer and CSS still work.
- `cms-bindings` and `cms-ui` typecheck clean; template audit clean.
- arts-collective typecheck: 2 errors, both pre-existing and in files I never
  touched (one is the user's own in-progress edit to `upload/image/route.ts`).

**Assumed (not executed):**
- That the wizard's generated fields will render sensibly — no UI exists yet.
- That platform steps map cleanly onto Talk/materials/email flows. I scoped
  them from the field inventory, not from reading those flows end to end.

**Unknown / not checked:**
- Repo-wide `pnpm lint` (reported broken in memory; not re-verified).
- Whether any app *runs* correctly with these changes — nothing was
  exercised through a browser or a running route.
- inner-gathering's Mantine form was not touched or re-tested.

---

## 7. Defect found in my own work during this review

`priceMember` was in `COLUMN_TO_INPUT_KEY` but **absent from
`WorkshopOfferingInput`** — it mapped to a key `upsertWorkshopOffering`
ignores. A silent drop, the precise failure the mapping was built to prevent.
Fixed: `priceMember` is now a real input (defaulting to `price`), a real
output field, and is covered by the update test.

Lesson worth keeping: the mapping table is only as good as its agreement with
the input type, and nothing enforces that agreement at compile time. A test
asserting `Object.values(COLUMN_TO_INPUT_KEY)` are all real keys of
`WorkshopOfferingInput` would have caught it. **Not written** — see §8.

---

## 8. Boundaries — basic questions, answered honestly

**Is any of this wired into a running app?**
No. `grep` confirms **nothing imports `@elkdonis/cms-ui`**. The shell, the
step builder, and the mapping have zero consumers. This is unconsumed
infrastructure, verified in isolation.

**Is the wizard actually template-driven?**
Only in principle. There is **no `workshop_pages.template_id` column** and
nothing selects a template at runtime — confirmed absent. "Template-driven"
today means "driven by the one workshop template that exists".

**Does "a new template needs no wizard code" hold?**
Partially, and only for a new *workshop* template.
`buildWorkshopWizardSteps` imports the workshop `fieldRegistry` directly, so
it is workshop-specific by construction. Checking the siblings:
portfolio declares `cmsFields` on 6 of 8 sections and dossier on 5 of 6 (both
would work with their own registries — dossier already has one), but
**enneagram declares `cmsFields` on 0 of 20 sections** and would produce an
empty wizard. The pattern does not generalize to it as written.

**Can the wizard save everything it displays?**
No, and it says so. `unmappedColumns()` returns the four `artist_profiles.*`
facilitator fields. They surface in `unmapped` rather than being dropped, but
the caller must still implement a profile write path. That path does not exist.

**Is the conditional-step behaviour tested?**
Render-time derivation only. Navigation skipping, id-based cache resume, and
autosave are typechecked but never executed — **the repo has no test runner**
(no vitest, no jest), so there was nowhere to put a test without adding a
dependency and running an install.

**Did anything regress?**
Nothing detected. The live editor's def count and validity were checked, the
renderer was exercised, and both consumer apps typecheck no worse than before.
But "no regression detected by typecheck and unit-level probes" is weaker than
"no regression" — no app was run.

---

## 9. Next steps, in order

1. **Build the step components.** A generic renderer keyed on `input` type
   (`text`/`select`/`image`/`gallery`/`color`/`media`/`compound`), then the
   bespoke ones: `platform:sessions`, `materials`, `talk`, `email`, `publish`.
   Talk needs room-provisioning UX, not just fields. This is the large piece.
2. **Wire one app end to end** so the infrastructure stops being unconsumed.
   hidden-enneagram is the natural first target (already depends on cms-ui).
3. **Resolve the facilitator fields** — move them off `artist_profiles` onto
   `users`/`org_profiles` as a set, add the write path, then un-readonly
   `roleTitle`.
4. **Decide the template selection question** — `template_id` column, or
   accept one template per content kind.
5. **Add a test runner**, and start with the `COLUMN_TO_INPUT_KEY` ↔
   `WorkshopOfferingInput` agreement check that would have caught §7.

---

## 10. Environment notes

- `packages/services` is a **built** package and its `dist/` is root-owned
  (container-built). It cannot be rebuilt from the host as `guru` — `EACCES`.
  Use `docker compose exec inner-gathering sh -c "cd /app && pnpm --filter
  @elkdonis/services build"`. `cms-bindings` and `cms-ui` are source-exported
  and have no such problem — a point in favour of source-export for new packages.
- `pnpm --filter @elkdonis/services exec tsc --noEmit` surfaces ~14
  pre-existing errors in `packages/nextcloud` and `packages/utils` (missing
  DOM lib). None in workshop code.
- Running containers: inner-gathering, amrit-canada, arts-collective, ifac,
  postgres, redis, supabase-*. **hidden-enneagram, admin, art-auction,
  pigeonshoot are stopped.** (Corrects an earlier memory note claiming
  amrit-canada was not running.)
- No test runner installed anywhere in the repo.
