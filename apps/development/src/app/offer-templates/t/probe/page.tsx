import { requireNetworkAdmin } from "@/lib/gate";
import "@elkdonis/cms-ui/offer-surface.css";
import "@elkdonis/cms-ui/offer-templates/shell.css";
import "@/offer-templates/frame.css";
import { Probe } from "./client";

export const dynamic = "force-dynamic";

/** The bare shell with nothing in it: proves the frame, the sample data and the gateway. */
export default async function ProbePage() {
  await requireNetworkAdmin("/offer-templates/t/probe");
  return <Probe />;
}
