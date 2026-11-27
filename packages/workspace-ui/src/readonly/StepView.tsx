"use client";
import type { Step } from "../types";
import { KINDS } from "../sheet/kinds";
import { DoControls } from "./DoControls";
import "../sheet/sheet.css";

/** One step as a visitor reads it: the words, the media and links, and where it lives on the host. Nothing to fill in. */
export function StepView({ step }: { step: Step }) {
  const def = KINDS[step.kind];
  const text = step.prompt;
  return (
    <div className="ws-ro-step">
      <p className="ws-sh-meta">{def.label}{step.minutes ? ` · about ${step.minutes} min` : ""}</p>
      {step.when || step.where ? <p className="ws-sh-meta">{[step.when, step.where].filter(Boolean).join(" · ")}</p> : null}
      {text ? <p className="ws-sh-prompt ws-prompt">{text}</p> : null}
      {step.bodyHtml ? <div className="ws-sh-body" dangerouslySetInnerHTML={{ __html: step.bodyHtml }} /> : step.body ? <div className="ws-sh-body">{step.body}</div> : null}
      {!text && !step.bodyHtml && !step.body ? <p className="ws-sh-meta">Nothing written on this step yet.</p> : null}
      {step.media && step.media.length > 0 ? (
        <ul className="ws-sh-list">
          {step.media.map((m, i) => (
            <li key={i}><a href={m.url} target="_blank" rel="noreferrer">{m.title || (m.kind === "file" ? "A file" : `A ${m.kind}`)}</a></li>
          ))}
        </ul>
      ) : null}
      {step.links && step.links.length > 0 ? (
        <ul className="ws-sh-list">
          {step.links.map((l, i) => (
            <li key={i}><a href={l.url} target="_blank" rel="noreferrer noopener">{l.title || l.url}</a></li>
          ))}
        </ul>
      ) : null}
      {step.openHref ? <p><a href={step.openHref}>Open this step on its own page</a></p> : null}
      <DoControls step={step} />
    </div>
  );
}
