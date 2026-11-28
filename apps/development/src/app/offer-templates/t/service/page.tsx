import { requireNetworkAdmin } from "@/lib/gate";
import "@elkdonis/cms-ui/offer-surface.css";
import "@elkdonis/cms-ui/offer-templates/shell.css";
import "@elkdonis/cms-ui/offer-templates/service.css";
import "@/offer-templates/frame.css";
import { View } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireNetworkAdmin("/offer-templates/t/service");
  return <View />;
}
