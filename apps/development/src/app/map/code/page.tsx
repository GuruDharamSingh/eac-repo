import type { Metadata } from "next";
import Link from "next/link";
import { requireNetworkAdmin } from "@/lib/gate";
import { CodeGraph, type WsGraph } from "@/map/CodeGraph";
import graph from "@/data/rails/workspace-graph.json";
import "@/rails/rails.css";

export const metadata: Metadata = { title: "Code map" };
export const dynamic = "force-dynamic";

/** The graph is read here, on the server, behind the gate. It is never copied into public/. */
export default async function CodeMapPage() {
  await requireNetworkAdmin("/map/code");
  return (
    <div className="dev-page dev-r-page" style={{ maxWidth: "none" }}>
      <Link href="/map" className="dev-back">
        Map
      </Link>
      <h1>The code behind it</h1>
      <p className="dev-lede">Which apps and packages stand on which, how far a change reaches, and where the lists and the real use disagree.</p>
      <CodeGraph graph={graph as unknown as WsGraph} />
    </div>
  );
}
