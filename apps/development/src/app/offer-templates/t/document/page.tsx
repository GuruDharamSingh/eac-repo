import { requireNetworkAdmin } from "@/lib/gate";
import "@elkdonis/cms-ui/offer-surface.css";
import "@elkdonis/cms-ui/offer-templates/shell.css";
import "@elkdonis/cms-ui/offer-templates/document.css";
import "@/offer-templates/frame.css";
import { View } from "./client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireNetworkAdmin("/offer-templates/t/document"); return <View />; }
