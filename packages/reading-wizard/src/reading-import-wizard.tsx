"use client";

import { useMemo, useState } from "react";
import {
  buildProgramPreview,
  createReadingWizardState,
  createUnitDraft,
  READING_WIZARD_STEPS,
} from "./planner";
import type { ReadingUnitDraft, ReadingWizardState, ReadingWizardStep } from "./types";

type ActiveStep = ReadingWizardStep["id"];

const stepOrder = READING_WIZARD_STEPS.map((step) => step.id);

function updateUnit(
  units: ReadingUnitDraft[],
  unitId: string,
  patch: Partial<ReadingUnitDraft>
): ReadingUnitDraft[] {
  return units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit));
}

export function ReadingImportWizard() {
  const [activeStep, setActiveStep] = useState<ActiveStep>("source");
  const [state, setState] = useState<ReadingWizardState>(() => createReadingWizardState());
  const preview = useMemo(() => buildProgramPreview(state), [state]);
  const activeIndex = stepOrder.indexOf(activeStep);

  const patchState = (patch: Partial<ReadingWizardState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const patchUnit = (unitId: string, patch: Partial<ReadingUnitDraft>) => {
    setState((current) => ({
      ...current,
      units: updateUnit(current.units, unitId, patch),
    }));
  };

  const addUnit = () => {
    setState((current) => ({
      ...current,
      units: [...current.units, createUnitDraft(current.units.length + 1)],
    }));
  };

  const goToOffset = (offset: number) => {
    const nextStep = stepOrder[Math.min(stepOrder.length - 1, Math.max(0, activeIndex + offset))];
    setActiveStep(nextStep);
  };

  return (
    <div className="rw-wizard">
      <nav className="rw-step-list" aria-label="Import steps">
        {READING_WIZARD_STEPS.map((step) => (
          <button
            className="rw-step-button"
            data-active={activeStep === step.id}
            key={step.id}
            onClick={() => setActiveStep(step.id)}
            type="button"
          >
            <strong>{step.title}</strong>
            <span>{step.caption}</span>
          </button>
        ))}
      </nav>

      <section className="rw-panel">
        {activeStep === "source" ? (
          <>
            <h2>Source</h2>
            <div className="rw-grid">
              <div className="rw-field">
                <label htmlFor="book-title">Book title</label>
                <input
                  id="book-title"
                  onChange={(event) => patchState({ bookTitle: event.target.value })}
                  value={state.bookTitle}
                />
              </div>
              <div className="rw-field">
                <label htmlFor="author-name">Author</label>
                <input
                  id="author-name"
                  onChange={(event) => patchState({ authorName: event.target.value })}
                  value={state.authorName}
                />
              </div>
              <div className="rw-field">
                <label htmlFor="source-type">Source type</label>
                <select
                  id="source-type"
                  onChange={(event) => patchState({ sourceType: event.target.value as ReadingWizardState["sourceType"] })}
                  value={state.sourceType}
                >
                  <option value="manual">Manual outline</option>
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                  <option value="audio">Audio</option>
                  <option value="link">External link</option>
                </select>
              </div>
              <div className="rw-field">
                <label htmlFor="rights-status">Rights</label>
                <select
                  id="rights-status"
                  onChange={(event) => patchState({ rightsStatus: event.target.value as ReadingWizardState["rightsStatus"] })}
                  value={state.rightsStatus}
                >
                  <option value="member_private">Member private</option>
                  <option value="public_domain">Public domain</option>
                  <option value="licensed">Licensed</option>
                  <option value="link_only">Link only</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div className="rw-field">
              <label htmlFor="nextcloud-folder">Nextcloud folder</label>
              <input
                id="nextcloud-folder"
                onChange={(event) => patchState({ nextcloudFolder: event.target.value })}
                value={state.nextcloudFolder}
              />
            </div>
          </>
        ) : null}

        {activeStep === "structure" ? (
          <>
            <h2>Structure</h2>
            <div className="rw-unit-list">
              {state.units.map((unit) => (
                <article className="rw-unit-card" key={unit.id}>
                  <div className="rw-unit-card-header">
                    <strong>{unit.label}</strong>
                    <span>{unit.estimatedMinutes} min</span>
                  </div>
                  <div className="rw-grid">
                    <div className="rw-field">
                      <label htmlFor={`${unit.id}-title`}>Title</label>
                      <input
                        id={`${unit.id}-title`}
                        onChange={(event) => patchUnit(unit.id, { title: event.target.value })}
                        value={unit.title}
                      />
                    </div>
                    <div className="rw-field">
                      <label htmlFor={`${unit.id}-locator`}>Locator</label>
                      <input
                        id={`${unit.id}-locator`}
                        onChange={(event) => patchUnit(unit.id, { locator: event.target.value })}
                        value={unit.locator}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <button className="rw-add-button" onClick={addUnit} type="button">Add Unit</button>
          </>
        ) : null}

        {activeStep === "cadence" ? (
          <>
            <h2>Cadence</h2>
            <div className="rw-grid">
              <div className="rw-field">
                <label htmlFor="group-name">Group</label>
                <input
                  id="group-name"
                  onChange={(event) => patchState({ groupName: event.target.value })}
                  value={state.groupName}
                />
              </div>
              <div className="rw-field">
                <label htmlFor="start-date">Start date</label>
                <input
                  id="start-date"
                  onChange={(event) => patchState({ startDate: event.target.value })}
                  type="date"
                  value={state.startDate}
                />
              </div>
              <div className="rw-field">
                <label htmlFor="interval-days">Interval days</label>
                <input
                  id="interval-days"
                  min="1"
                  onChange={(event) => patchState({ intervalDays: Number(event.target.value) || 1 })}
                  type="number"
                  value={state.intervalDays}
                />
              </div>
              <div className="rw-field">
                <label htmlFor="meeting-time">Meeting time</label>
                <input
                  id="meeting-time"
                  onChange={(event) => patchState({ meetingTime: event.target.value })}
                  type="time"
                  value={state.meetingTime}
                />
              </div>
              <div className="rw-field">
                <label htmlFor="time-zone">Time zone</label>
                <input
                  id="time-zone"
                  onChange={(event) => patchState({ timeZone: event.target.value })}
                  value={state.timeZone}
                />
              </div>
            </div>
          </>
        ) : null}

        {activeStep === "resources" ? (
          <>
            <h2>Resources</h2>
            <div className="rw-unit-list">
              {state.units.map((unit) => (
                <article className="rw-unit-card" key={unit.id}>
                  <div className="rw-unit-card-header">
                    <strong>{unit.label}</strong>
                    <span>{unit.title}</span>
                  </div>
                  <div className="rw-field">
                    <label htmlFor={`${unit.id}-resource`}>Resource URL</label>
                    <input
                      id={`${unit.id}-resource`}
                      onChange={(event) => patchUnit(unit.id, { resourceUrl: event.target.value })}
                      value={unit.resourceUrl}
                    />
                  </div>
                  <div className="rw-field">
                    <label htmlFor={`${unit.id}-notes`}>Notes</label>
                    <textarea
                      id={`${unit.id}-notes`}
                      onChange={(event) => patchUnit(unit.id, { notes: event.target.value })}
                      value={unit.notes}
                    />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activeStep === "publish" ? (
          <>
            <h2>Publish</h2>
            <div className="rw-grid">
              <div className="rw-preview-stat">
                <strong>{preview.totalUnits}</strong>
                <span>Units</span>
              </div>
              <div className="rw-preview-stat">
                <strong>{preview.estimatedWeeks}</strong>
                <span>Weeks</span>
              </div>
              <div className="rw-preview-stat">
                <strong>{preview.resourceCount}</strong>
                <span>Resources</span>
              </div>
              <div className="rw-preview-stat">
                <strong>{preview.missingResourceCount}</strong>
                <span>Open slots</span>
              </div>
            </div>
            <div className="rw-field">
              <label htmlFor="program-slug">Program slug</label>
              <input id="program-slug" readOnly value={preview.slug} />
            </div>
            <div className="rw-field">
              <label htmlFor="newsletter-title">First newsletter draft</label>
              <input id="newsletter-title" readOnly value={preview.newsletterDraftTitle} />
            </div>
          </>
        ) : null}

        <div className="rw-actions">
          <button disabled={activeIndex === 0} onClick={() => goToOffset(-1)} type="button">Previous</button>
          <button disabled={activeIndex === stepOrder.length - 1} onClick={() => goToOffset(1)} type="button">Next</button>
        </div>
      </section>

      <aside className="rw-preview" aria-label="Program preview">
        <h2>Preview</h2>
        <div className="rw-preview-stat">
          <strong>{state.bookTitle}</strong>
          <span>{state.authorName}</span>
        </div>
        <div className="rw-preview-stat">
          <strong>{preview.estimatedWeeks}</strong>
          <span>Estimated weeks</span>
        </div>
        <div className="rw-preview-stat">
          <strong>{preview.privateSource ? "Private" : "Public"}</strong>
          <span>Source access</span>
        </div>
        <div className="rw-preview-stat">
          <strong>{preview.nextcloudFolder}</strong>
          <span>Folder</span>
        </div>
      </aside>
    </div>
  );
}