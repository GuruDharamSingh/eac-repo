import { requireNetworkAdmin } from "@/lib/gate";
import "@elkdonis/cms-ui/offer-surface.css";
import "@/offer-templates/frame.css";
import { View } from "./client";

export const dynamic = "force-dynamic";

/** Demo of PersonName and the hover profile card (frame 5d). Hover a name; click opens the layer. */
export default async function Page() {
  await requireNetworkAdmin("/offer-templates/t/people");
  return <View />;
}
