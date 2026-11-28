"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { fmtMoney, money, shortWhen } from "../format";
import { PersonName } from "../layers-people";
import { Prose } from "../parts";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Session (packet 2n): what it is on the left, the four steps to book in the
// rail. The steps are a front-end demo: nothing is sent and nothing is paid.

const STEPS = ["Enquire", "Host replies", "Pick a time", "Pay"];
const TIMES = ["Mornings", "Evenings", "Weekends"];

export function ServiceTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const o = data.featured;
  const host = data.owner;
  const hostIds = o ? [o.hostId, ...(o.coHostIds ?? [])].filter((id, i, a) => id && a.indexOf(id) === i) : [host.id];
  const [step, setStep] = React.useState(1);
  const [times, setTimes] = React.useState<Record<string, boolean>>({ Evenings: true });
  const slots = (o?.slots ?? []).slice(0, 3);
  const [slot, setSlot] = React.useState(0);
  const sliding = o?.sliding ?? null;
  const cur = o?.price?.currency ?? "USD";
  const [amount, setAmount] = React.useState(sliding ? Math.min(sliding.maxMinor, o?.price?.amountMinor ?? sliding.maxMinor) : (o?.price?.amountMinor ?? 0));
  if (!o) return null;

  const tags: Array<{ t: string; cls?: string }> = [];
  if (o.durationMinutes) tags.push({ t: `${o.durationMinutes} MIN` });
  if (o.venue?.online) tags.push({ t: "ONLINE" });
  if (o.price) tags.push({ t: fmtMoney(o.price), cls: "is-price" });
  if (sliding) tags.push({ t: `SLIDING ${fmtMoney(money(sliding.minMinor, cur))}–${fmtMoney(money(sliding.maxMinor, cur)).replace("$", "")}`, cls: "is-dashed" });
  const range = sliding ? `${fmtMoney(money(sliding.minMinor, cur))}–${fmtMoney(money(sliding.maxMinor, cur)).replace("$", "")}` : "";
  const payLabel = fmtMoney(money(sliding ? amount : (o.price?.amountMinor ?? 0), cur));
  const slotText = slots[slot] ? slots[slot].label || shortWhen(slots[slot].start, o.when?.timeZone) : "";
  const fill = `${(((step - 1) / 3) * 75).toFixed(1)}%`;
  const pic = o.poster ?? o.images?.[0] ?? null;

  return (
    <TemplateShell data={data} template="service">
      <div className="ost-service">
        <section className="ost-service-offer" aria-label="The session">
          <span className="ost-service-kicker">
            Service{data.extras.category ? ` · ${data.extras.category}` : ""}
          </span>
          <h1 className="ost-service-title">{o.title}</h1>
          {o.standfirst && <p className="ost-service-stand">{o.standfirst}</p>}
          <div className="ost-service-tags">
            {tags.map((g) => (
              <span key={g.t} className={`ost-service-tag ${g.cls ?? ""}`}>
                {g.t}
              </span>
            ))}
          </div>
          {pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ost-service-pic" src={pic} alt="" />
          ) : (
            data.placeholders && (
              <div className="ost-service-pic osf-ph" aria-hidden>
                <span>portrait · 4:3</span>
              </div>
            )
          )}
          <Prose className="ost-body ost-service-para" text={o.description} />
          <div className="ost-service-host">
            <span className="ost-service-av" aria-hidden />
            <div className="ost-service-who">
              <span className="ost-service-name">
                {hostIds.map((id, i) => (
                  <React.Fragment key={id}>
                    {i > 0 && (i === hostIds.length - 1 ? " and " : ", ")}
                    <PersonName id={id} />
                  </React.Fragment>
                ))}
              </span>
              {data.extras.replyNote && <span className="ost-service-reply">● {data.extras.replyNote}</span>}
            </div>
            <button type="button" className="ost-service-btn ost-service-profile" onClick={(e) => open(offerDescriptor("pf-owner", host.id), e.currentTarget)}>
              Profile →
            </button>
          </div>
        </section>

        <aside className="ost-service-rail" aria-label="Book this session">
          <ol className="ost-service-steps">
            <i className="ost-service-line" aria-hidden />
            <i className="ost-service-line is-fill" style={{ width: fill }} aria-hidden />
            {STEPS.map((l, i) => {
              const n = i + 1;
              const state = n < step ? "is-done" : n === step ? "is-cur" : "";
              return (
                <li key={l} className={`ost-service-step ${state}`} aria-current={n === step ? "step" : undefined}>
                  <span className="ost-service-dot">{n < step ? "✓" : n}</span>
                  <span className="ost-service-slabel">{l}</span>
                </li>
              );
            })}
          </ol>

          {step === 1 && (
            <form
              className="ost-service-pane"
              key="s1"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(2);
              }}
            >
              <span className="ost-service-pk">Enquire</span>
              <label className="ost-service-field">
                <span className="ost-service-fl">YOUR NAME</span>
                <input className="ost-service-in" autoComplete="name" />
              </label>
              <label className="ost-service-field">
                <span className="ost-service-fl">EMAIL</span>
                <input className="ost-service-in" type="email" autoComplete="email" />
              </label>
              <label className="ost-service-field">
                <span className="ost-service-fl">WHAT ARE YOU HOPING FOR?</span>
                <textarea className="ost-service-in ost-service-ta" rows={3} />
              </label>
              <span className="ost-service-fl">TIMES THAT SUIT</span>
              <div className="ost-service-times">
                {TIMES.map((t) => (
                  <button key={t} type="button" aria-pressed={!!times[t]} className={`ost-service-time${times[t] ? " is-on" : ""}`} onClick={() => setTimes((x) => ({ ...x, [t]: !x[t] }))}>
                    {t}
                  </button>
                ))}
              </div>
              <button type="submit" className="ost-service-btn ost-service-go">
                Send enquiry
              </button>
              <span className="ost-service-fine">The host replies with times. You pay when you pick one.</span>
            </form>
          )}

          {step === 2 && (
            <div className="ost-service-pane" key="s2">
              <h2 className="ost-service-h">Thank you for your enquiry.</h2>
              <p className="ost-service-p">
                We&apos;ll be in touch about <i>{o.title}</i>. {host.name} usually replies within a day, by email and here.
              </p>
              <div className="ost-service-msg">
                <span className="ost-service-fl">YOUR MESSAGE</span>
                <i style={{ width: "92%" }} />
                <i style={{ width: "60%" }} />
              </div>
              <button type="button" className="ost-service-btn ost-service-demo" onClick={() => setStep(3)}>
                Demo: see the host&apos;s reply →
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="ost-service-pane" key="s3">
              <span className="ost-service-pk">{host.name} replied</span>
              <h2 className="ost-service-h">Pick a time</h2>
              <div role="radiogroup" aria-label="Pick a time" className="ost-service-slots">
                {slots.map((s, i) => (
                  <button key={s.id} type="button" role="radio" aria-checked={i === slot} className={`ost-service-slot${i === slot ? " is-on" : ""}`} onClick={() => setSlot(i)}>
                    <i aria-hidden />
                    <span suppressHydrationWarning>{s.label || shortWhen(s.start, o.when?.timeZone)}</span>
                  </button>
                ))}
              </div>
              {sliding && (
                <>
                  <div className="ost-service-payrow">
                    <span className="ost-service-fl">PAY WHAT YOU CAN · {range}</span>
                    <span className="ost-service-amt">{fmtMoney(money(amount, cur))}</span>
                  </div>
                  <input type="range" className="ost-service-range" aria-label="Amount" min={sliding.minMinor} max={sliding.maxMinor} step={sliding.stepMinor ?? 500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                </>
              )}
              <button type="button" className="ost-service-btn ost-service-go" onClick={() => setStep(4)}>
                Pay {payLabel} and confirm
              </button>
              <span className="ost-service-fl is-faint">CARD PAYMENT BY STRIPE</span>
            </div>
          )}

          {step === 4 && (
            <div className="ost-service-pane is-done" key="s4">
              <span className="ost-service-tick" aria-hidden>
                ✓
              </span>
              <h2 className="ost-service-h">You&apos;re booked</h2>
              <span className="ost-service-p" suppressHydrationWarning>
                {slotText} · online
              </span>
              <p className="ost-service-fine">The join link arrives by email, and this page becomes your session space.</p>
              <div className="ost-service-row">
                <button type="button" className="ost-service-btn">
                  Add to calendar
                </button>
                <button type="button" className="ost-service-link" onClick={() => setStep(1)}>
                  Start over
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </TemplateShell>
  );
}
