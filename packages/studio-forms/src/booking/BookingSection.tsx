'use client';

import * as React from 'react';
import {
  DEFAULT_OFFER_INPUT,
  MAX_HOURS_RANGES,
  MAX_QUESTIONS,
  type BookingOfferInput,
  type HoursRange,
  type IntakeQuestion,
} from '@elkdonis/booking/core';
import { Seg } from '../forms/fields/Seg';
import { FormRoot } from '../forms/theme/context';

// ============================================================================
// Booking section (booking module phase 1, docs/open/BOOKING_MODULE_2026-11-14.md
// §2.4): how an offering is booked. Kind, length and weekly hours first; then
// notice, how far ahead, a break between bookings, who confirms, the
// cancellation policy and questions for the booker.
//
// Standalone on purpose: value/onChange over BookingOfferInput, no FormHost or
// SectionProps, so a site that does not use FormShell (ArtDirect) mounts it
// inside <BookingSectionRoot>. Validation is @elkdonis/booking's
// validateOfferInput, run by the caller on save; `error` shows its sentence.
// Drawn on the forms' tokens (--frm-*, .frm-*), so the Ledger, quick and site
// themes and dark mode apply.
// ============================================================================

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const LENGTHS = [15, 30, 45, 60, 75, 90, 120, 180];
const NOTICE: Array<[number, string]> = [
  [0, 'None'],
  [60, '1 hour'],
  [180, '3 hours'],
  [720, '12 hours'],
  [1440, '1 day'],
  [2880, '2 days'],
  [10080, '1 week'],
];
const BREAKS: Array<[number, string]> = [
  [0, 'None'],
  [10, '10 min'],
  [15, '15 min'],
  [30, '30 min'],
  [60, '1 hour'],
];
const FREE_UNTIL: Array<[string, string]> = [
  ['', 'No policy (I decide)'],
  ['0', 'Any time before'],
  ['120', 'Up to 2 hours before'],
  ['1440', 'Up to 1 day before'],
  ['2880', 'Up to 2 days before'],
  ['10080', 'Up to 1 week before'],
];
const REMINDERS: Array<[string, string]> = [
  ['1440', 'A day before'],
  ['2880', 'Two days before'],
  ['120', '2 hours before'],
  ['60', '1 hour before'],
  ['', 'No reminder'],
];
const AFTER: Array<[number, string]> = [
  [0, 'No refund'],
  [50, 'Half back'],
  [100, 'Full refund'],
];

export function emptyBookingOffer(timeZone?: string | null): BookingOfferInput {
  return {
    ...DEFAULT_OFFER_INPUT,
    timeZone: timeZone || DEFAULT_OFFER_INPUT.timeZone,
    hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, from: '10:00', to: '17:00' })),
  };
}

function zones(current: string): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    return list.includes(current) ? list : [current, ...list];
  } catch {
    return [current];
  }
}

export interface BookingSectionProps {
  value: BookingOfferInput;
  onChange: (next: BookingOfferInput) => void;
  /** A sentence from validateOfferInput or the save, shown at the top. */
  error?: string | null;
  /** Prefix for ids and radio names (one per section on a page). */
  idPrefix?: string;
  disabled?: boolean;
}

export function BookingSection({ value: v, onChange, error, idPrefix = 'bk', disabled }: BookingSectionProps) {
  const set = (patch: Partial<BookingOfferInput>) => onChange({ ...v, ...patch });
  const hours = v.hours ?? [];
  const questions = v.questions ?? [];
  const id = (s: string) => `${idPrefix}-${s}`;
  const zoneList = React.useMemo(() => zones(v.timeZone), [v.timeZone]);

  function setHour(i: number, patch: Partial<HoursRange>) {
    set({ hours: hours.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  }
  function addHour() {
    const last = hours[hours.length - 1];
    const used = new Set(hours.map((h) => h.weekday));
    const next = WEEK_ORDER.find((d) => !used.has(d)) ?? last?.weekday ?? 1;
    set({ hours: [...hours, { weekday: next, from: last?.from ?? '10:00', to: last?.to ?? '17:00' }] });
  }
  function setQuestion(i: number, patch: Partial<IntakeQuestion>) {
    set({ questions: questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  }

  const freeUntil = v.cancelFreeUntilMinutes == null ? '' : String(v.cancelFreeUntilMinutes);

  return (
    <div className="bks" aria-disabled={disabled || undefined}>
      {error ? (
        <p className="bks-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="bks-row">
        <span className="frm-label bks-label" id={id('kind')}>
          Kind
        </span>
        <div className="bks-cell">
          <Seg
            name={id('kind')}
            labelledBy={id('kind')}
            value={v.mode}
            disabled={disabled}
            options={[
              { value: 'open_hours', label: 'Open hours' },
              { value: 'request_time', label: 'Ask for a time' },
            ]}
            onChange={(m) => set({ mode: m as BookingOfferInput['mode'] })}
          />
          <p className="frm-hint bks-hint">
            {v.mode === 'open_hours'
              ? 'People pick a free time from your hours and it is booked straight away.'
              : 'People suggest up to three times; you confirm one or suggest others.'}
          </p>
        </div>
      </div>

      <div className="bks-row">
        <label className="frm-label bks-label" htmlFor={id('len')}>
          Length
        </label>
        <div className="bks-cell bks-inline">
          <span className="frm-input bks-box">
            <select
              id={id('len')}
              className="frm-input-el bks-select"
              value={LENGTHS.includes(v.durationMinutes) ? String(v.durationMinutes) : 'other'}
              disabled={disabled}
              onChange={(e) => e.target.value !== 'other' && set({ durationMinutes: Number(e.target.value) })}
            >
              {LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`}
                </option>
              ))}
              <option value="other">Other…</option>
            </select>
          </span>
          {!LENGTHS.includes(v.durationMinutes) ? (
            <span className="frm-input bks-box bks-num">
              <input
                className="frm-input-el"
                type="number"
                min={5}
                max={1440}
                step={5}
                aria-label="Length in minutes"
                value={v.durationMinutes || ''}
                disabled={disabled}
                onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
              />
              <span className="bks-unit">min</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="bks-row">
        <span className="frm-label bks-label" id={id('hours')}>
          {v.mode === 'open_hours' ? 'Hours' : 'Usual hours'}
        </span>
        <div className="bks-cell" role="group" aria-labelledby={id('hours')}>
          {v.mode === 'request_time' ? (
            <p className="frm-hint bks-hint">Optional: shown to people as a guide when they suggest times.</p>
          ) : null}
          <ul className="bks-hours">
            {hours.map((h, i) => (
              <li key={i} className="bks-hour">
                <span className="frm-input bks-box">
                  <select
                    className="frm-input-el bks-select"
                    aria-label={`Day ${i + 1}`}
                    value={h.weekday}
                    disabled={disabled}
                    onChange={(e) => setHour(i, { weekday: Number(e.target.value) })}
                  >
                    {WEEK_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {WEEKDAYS[d]}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="frm-input bks-box bks-time">
                  <input
                    className="frm-input-el"
                    type="time"
                    aria-label={`From, ${WEEKDAYS[h.weekday]}`}
                    value={h.from}
                    step={300}
                    disabled={disabled}
                    onChange={(e) => setHour(i, { from: e.target.value })}
                  />
                </span>
                <span className="bks-dash" aria-hidden="true">
                  to
                </span>
                <span className="frm-input bks-box bks-time">
                  <input
                    className="frm-input-el"
                    type="time"
                    aria-label={`Until, ${WEEKDAYS[h.weekday]}`}
                    value={h.to === '24:00' ? '23:59' : h.to}
                    step={300}
                    disabled={disabled}
                    onChange={(e) => setHour(i, { to: e.target.value })}
                  />
                </span>
                <button
                  type="button"
                  className="frm-btn frm-btn--ghost frm-btn--sm bks-x"
                  aria-label={`Remove ${WEEKDAYS[h.weekday]} ${h.from}`}
                  disabled={disabled}
                  onClick={() => set({ hours: hours.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {hours.length < MAX_HOURS_RANGES ? (
            <button type="button" className="frm-btn frm-btn--secondary frm-btn--sm" disabled={disabled} onClick={addHour}>
              + Hours
            </button>
          ) : null}
        </div>
      </div>

      <div className="bks-row">
        <label className="frm-label bks-label" htmlFor={id('tz')}>
          Time zone
        </label>
        <div className="bks-cell">
          <span className="frm-input bks-box">
            <select
              id={id('tz')}
              className="frm-input-el bks-select"
              value={v.timeZone}
              disabled={disabled}
              onChange={(e) => set({ timeZone: e.target.value })}
            >
              {zoneList.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </span>
          <p className="frm-hint bks-hint">Your hours are in this zone; people see times in their own.</p>
        </div>
      </div>

      <div className="bks-row">
        <label className="frm-label bks-label" htmlFor={id('notice')}>
          Notice
        </label>
        <div className="bks-cell bks-inline">
          <span className="frm-input bks-box">
            <select
              id={id('notice')}
              className="frm-input-el bks-select"
              value={String(v.leadTimeMinutes ?? 720)}
              disabled={disabled}
              onChange={(e) => set({ leadTimeMinutes: Number(e.target.value) })}
            >
              {NOTICE.some(([m]) => m === (v.leadTimeMinutes ?? 720)) ? null : (
                <option value={String(v.leadTimeMinutes)}>{v.leadTimeMinutes} min</option>
              )}
              {NOTICE.map(([m, l]) => (
                <option key={m} value={m}>
                  {l}
                </option>
              ))}
            </select>
          </span>
          <label className="frm-label bks-sublabel" htmlFor={id('ahead')}>
            Up to
          </label>
          <span className="frm-input bks-box bks-num">
            <input
              id={id('ahead')}
              className="frm-input-el"
              type="number"
              min={1}
              max={366}
              value={v.maxAheadDays ?? 60}
              disabled={disabled}
              onChange={(e) => set({ maxAheadDays: Number(e.target.value) })}
            />
            <span className="bks-unit">days ahead</span>
          </span>
        </div>
      </div>

      {v.mode === 'open_hours' ? (
        <>
          <div className="bks-row">
            <label className="frm-label bks-label" htmlFor={id('break')}>
              Break after
            </label>
            <div className="bks-cell bks-inline">
              <span className="frm-input bks-box">
                <select
                  id={id('break')}
                  className="frm-input-el bks-select"
                  value={String(v.bufferMinutes ?? 0)}
                  disabled={disabled}
                  onChange={(e) => set({ bufferMinutes: Number(e.target.value) })}
                >
                  {BREAKS.some(([m]) => m === (v.bufferMinutes ?? 0)) ? null : (
                    <option value={String(v.bufferMinutes)}>{v.bufferMinutes} min</option>
                  )}
                  {BREAKS.map(([m, l]) => (
                    <option key={m} value={m}>
                      {l}
                    </option>
                  ))}
                </select>
              </span>
              <label className="frm-label bks-sublabel" htmlFor={id('from')}>
                Starting
              </label>
              <span className="frm-input bks-box">
                <input
                  id={id('from')}
                  className="frm-input-el"
                  type="date"
                  value={v.validFrom ?? ''}
                  disabled={disabled}
                  onChange={(e) => set({ validFrom: e.target.value || null })}
                />
              </span>
            </div>
          </div>

          <div className="bks-row">
            <span className="frm-label bks-label" id={id('approval')}>
              Confirming
            </span>
            <div className="bks-cell">
              <Seg
                name={id('approval')}
                labelledBy={id('approval')}
                value={v.approval ?? 'instant'}
                disabled={disabled}
                options={[
                  { value: 'instant', label: 'Booked straight away' },
                  { value: 'seller_confirms', label: 'I confirm each' },
                ]}
                onChange={(a) => set({ approval: a as BookingOfferInput['approval'] })}
              />
            </div>
          </div>
        </>
      ) : null}

      <div className="bks-row">
        <label className="frm-label bks-label" htmlFor={id('free')}>
          Cancelling
        </label>
        <div className="bks-cell bks-stack">
          <div className="bks-inline">
            <span className="frm-input bks-box">
              <select
                id={id('free')}
                className="frm-input-el bks-select"
                value={freeUntil}
                disabled={disabled}
                onChange={(e) =>
                  set(
                    e.target.value === ''
                      ? { cancelFreeUntilMinutes: null, cancelRefundPercentAfter: null }
                      : { cancelFreeUntilMinutes: Number(e.target.value), cancelRefundPercentAfter: v.cancelRefundPercentAfter ?? 0 }
                  )
                }
              >
                {FREE_UNTIL.some(([m]) => m === freeUntil) ? null : <option value={freeUntil}>{freeUntil} min before</option>}
                {FREE_UNTIL.map(([m, l]) => (
                  <option key={m} value={m}>
                    {l}
                  </option>
                ))}
              </select>
            </span>
            {freeUntil !== '' && freeUntil !== '0' ? (
              <>
                <label className="frm-label bks-sublabel" htmlFor={id('after')}>
                  After that
                </label>
                <span className="frm-input bks-box">
                  <select
                    id={id('after')}
                    className="frm-input-el bks-select"
                    value={String(v.cancelRefundPercentAfter ?? 0)}
                    disabled={disabled}
                    onChange={(e) => set({ cancelRefundPercentAfter: Number(e.target.value) })}
                  >
                    {AFTER.some(([p]) => p === (v.cancelRefundPercentAfter ?? 0)) ? null : (
                      <option value={String(v.cancelRefundPercentAfter)}>{v.cancelRefundPercentAfter}%</option>
                    )}
                    {AFTER.map(([p, l]) => (
                      <option key={p} value={p}>
                        {l}
                      </option>
                    ))}
                  </select>
                </span>
              </>
            ) : null}
          </div>
          <span className="frm-input bks-box bks-wide">
            <input
              className="frm-input-el"
              aria-label="Your own words for the policy (optional)"
              placeholder="Your own words for the policy (optional)"
              maxLength={2000}
              value={v.cancelPolicyText ?? ''}
              disabled={disabled}
              onChange={(e) => set({ cancelPolicyText: e.target.value || null })}
            />
          </span>
          <p className="frm-hint bks-hint">Refunds are issued by you from the order; the booking shows what is due.</p>
        </div>
      </div>

      <div className="bks-row">
        <span className="frm-label bks-label" id={id('q')}>
          Questions
        </span>
        <div className="bks-cell bks-stack" role="group" aria-labelledby={id('q')}>
          {questions.map((q, i) => (
            <div key={i} className="bks-inline">
              <span className="frm-input bks-box bks-wide">
                <input
                  className="frm-input-el"
                  aria-label={`Question ${i + 1}`}
                  maxLength={200}
                  value={q.label}
                  disabled={disabled}
                  onChange={(e) => setQuestion(i, { label: e.target.value })}
                />
              </span>
              <label className="bks-check">
                <input type="checkbox" checked={q.required} disabled={disabled} onChange={(e) => setQuestion(i, { required: e.target.checked })} />
                Required
              </label>
              <button
                type="button"
                className="frm-btn frm-btn--ghost frm-btn--sm bks-x"
                aria-label={`Remove question ${i + 1}`}
                disabled={disabled}
                onClick={() => set({ questions: questions.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          {questions.length < MAX_QUESTIONS ? (
            <button
              type="button"
              className="frm-btn frm-btn--secondary frm-btn--sm"
              disabled={disabled}
              onClick={() => set({ questions: [...questions, { key: `q${Date.now().toString(36)}`, label: '', required: false }] })}
            >
              + Question
            </button>
          ) : null}
        </div>
      </div>

      <div className="bks-row">
        <label className="frm-label bks-label" htmlFor={id('remind')}>
          Reminder
        </label>
        <div className="bks-cell">
          <div className="bks-inline">
          <span className="frm-input bks-box">
            <select
              id={id('remind')}
              className="frm-input-el bks-select"
              value={v.reminderMinutesBefore === null ? '' : String(v.reminderMinutesBefore ?? 1440)}
              disabled={disabled}
              onChange={(e) => set({ reminderMinutesBefore: e.target.value === '' ? null : Number(e.target.value) })}
            >
              {v.reminderMinutesBefore != null && !REMINDERS.some(([m]) => m === String(v.reminderMinutesBefore)) ? (
                <option value={String(v.reminderMinutesBefore)}>{v.reminderMinutesBefore} min before</option>
              ) : null}
              {REMINDERS.map(([m, l]) => (
                <option key={m} value={m}>
                  {l}
                </option>
              ))}
            </select>
          </span>
          </div>
          <p className="frm-hint bks-hint">An email to you and to them before each booking.</p>
        </div>
      </div>

      <div className="bks-row">
        <span className="frm-label bks-label" id={id('status')}>
          Taking bookings
        </span>
        <div className="bks-cell">
          <Seg
            name={id('status')}
            labelledBy={id('status')}
            value={v.status ?? 'open'}
            disabled={disabled}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'paused', label: 'Paused' },
            ]}
            onChange={(s) => set({ status: s as BookingOfferInput['status'] })}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The forms' root (tokens and theme) for a host that does not draw FormShell.
 * The host also imports `@elkdonis/studio-forms/forms.css` and
 * `@elkdonis/studio-forms/booking.css`.
 */
export function BookingSectionRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return <FormRoot className={className ? `bks-root ${className}` : 'bks-root'}>{children}</FormRoot>;
}
