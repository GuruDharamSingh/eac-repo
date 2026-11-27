"use client";

// Opens one record's field over the page (the canvas's double-click on words that come from a record). Client only.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { RecordFieldPanel, type RecordFieldHost } from "./FieldsLens";

let current: { close(): void } | null = null;

/** `field` is "record:<kind>:<id>:<field>". One panel at a time; the returned handle closes it. */
export function openRecordField(host: RecordFieldHost, field: string): { close(): void } {
  current?.close();
  const el = document.createElement("div");
  el.dataset.deUi = "";
  document.body.append(el);
  const root = createRoot(el);
  const handle = {
    close() {
      if (current === handle) current = null;
      // Not during a React commit: the panel's own close button may be calling this.
      setTimeout(() => { root.unmount(); el.remove(); }, 0);
    },
  };
  current = handle;
  root.render(createElement(RecordFieldPanel, { host, field, onClose: handle.close }));
  return handle;
}
