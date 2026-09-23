import type { Metadata } from "next";
import { CarePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { SOPHIA_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Taking care while you practise",
  description: "What to do if a practice is difficult, what these courses are not, and where to find help now.",
  alternates: { canonical: `${SOPHIA_URL}/care` },
};

export default function Page() {
  return CarePage({ c: connectors });
}
