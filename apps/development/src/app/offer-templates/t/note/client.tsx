"use client";

import { NoteTemplate } from "@elkdonis/cms-ui/offer-templates/note";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="note">{(data) => <NoteTemplate data={data} />}</TemplateFrame>;
}
