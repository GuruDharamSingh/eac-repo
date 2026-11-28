"use client";
import { DocumentTemplate } from "@elkdonis/cms-ui/offer-templates/document";
import { TemplateFrame } from "@/offer-templates/Frame";
export function View() { return <TemplateFrame template="document">{(data) => <DocumentTemplate data={data} />}</TemplateFrame>; }
