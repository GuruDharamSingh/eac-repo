"use client";

import * as React from "react";
import { COMPOSE_GROUPS, type ComposeOption } from "./catalogue";

// ============================================================================
// "One meeting | Series" (2026-10-10).
//
// The switch at the top of a compose form whose kind shares a door with
// others (`ComposeOption.group`). Modelled on innergathering's Meeting/Event
// switch (`apps/innergathering/src/app/hub/compose/page.tsx`), as radios so
// it reads as one choice to a screen reader. The host decides what choosing
// does (a page updates its `?kind=`; a popup could swap state).
// ============================================================================

export function ComposeGroupSwitch({
  options,
  selected,
  onSelect,
}: {
  /** The group's members, from `groupOptions`. Fewer than two draws nothing. */
  options: ComposeOption[];
  selected: ComposeOption;
  onSelect: (option: ComposeOption) => void;
}) {
  const id = React.useId();
  if (options.length < 2 || !selected.group) return null;
  const copy = COMPOSE_GROUPS[selected.group.id];

  return (
    <section className="eac-compose-switch" aria-labelledby={`${id}-q`} data-compose-switch={selected.group.id}>
      <p className="eac-compose-switch__q" id={`${id}-q`}>
        {copy.prompt}
      </p>
      <div className="eac-compose-switch__seg" role="radiogroup" aria-labelledby={`${id}-q`}>
        {options.map((option) => {
          const on = option.id === selected.id;
          return (
            <label key={option.id} className={on ? "is-on" : undefined}>
              <input
                type="radio"
                name={`${id}-kind`}
                value={option.writes.kind}
                checked={on}
                onChange={() => onSelect(option)}
              />
              <span>{option.group?.label ?? option.title}</span>
            </label>
          );
        })}
      </div>
      <p className="eac-compose-switch__help">{copy.help}</p>
    </section>
  );
}
