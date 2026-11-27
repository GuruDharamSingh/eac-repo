"use client";
import { useState } from "react";
import { useWorkspace } from "../../store";
import { CommonFields, Saved, StringList, type DoProps, type KindDef } from "./shared";

function QuizDo({ step, moduleId, intervalKey, mediaLabel: extraMedia }: DoProps) {
  const { addEntry } = useWorkspace();
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const opts = step.options ?? [];
  const hasAnswer = typeof step.answer === "number";
  return (
    <fieldset className="ws-sh-fieldset">
      <legend className="ws-sh-prompt">{step.prompt || step.title}</legend>
      {opts.map((o, i) => (
        <div key={i} className="ws-sh-check">
          <input type="radio" id={`${step.id}-q${i}`} name={`${step.id}-q`} checked={pick === i} onChange={() => { setPick(i); setResult(null); }} />
          <label htmlFor={`${step.id}-q${i}`}>{o}</label>
        </div>
      ))}
      <button type="button" className="ws-sh-btn" disabled={pick === null}
        onClick={() => {
          if (pick === null) return;
          const ok = hasAnswer ? pick === step.answer : true;
          setResult(ok);
          addEntry({ ...(intervalKey ? { intervalKey } : {}), ...(extraMedia ? { mediaLabel: extraMedia } : {}), moduleId, stepId: step.id, kind: "quiz", text: `${opts[pick]}${hasAnswer ? (ok ? " (right)" : " (not quite)") : ""}` });
        }}>Check answer</button>
      {result !== null && hasAnswer && <Saved>{result ? "Right." : `Not quite. The answer is: ${opts[step.answer as number]}.`}</Saved>}
      {result !== null && !hasAnswer && <Saved>Saved to your journal.</Saved>}
    </fieldset>
  );
}

export const quiz: KindDef = {
  label: "Quiz",
  Do: (p) => <QuizDo {...p} />,
  Edit: (p) => (
    <>
      <CommonFields {...p} />
      <StringList label="Option" addLabel="Add option" items={p.step.options ?? []} onChange={(options) => p.patch({ options })}
        correct={p.step.answer} onCorrect={(answer) => p.patch({ answer })} />
    </>
  ),
};
