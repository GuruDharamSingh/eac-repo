"use client";
import { GazetteTemplate } from "@elkdonis/cms-ui/offer-templates/gazette";
import { TemplateFrame } from "@/offer-templates/Frame";
export function View() { return <TemplateFrame template="gazette">{(data) => <GazetteTemplate data={data} />}</TemplateFrame>; }
