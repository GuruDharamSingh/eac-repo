import type { Metadata } from "next";
import { Calculator } from "@/components/calculator";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Calculate a chart" };

export default async function CalculatePage() {
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="mb-8 text-3xl font-semibold md:text-4xl">Calculate a birth chart</h1>
      <Calculator signedIn={Boolean(viewer)} />
    </div>
  );
}
