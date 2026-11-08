import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { ChannelFrame } from "@/components/channel/ChannelFrame";
import { PieceBoard } from "@/components/channel/PieceBoard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ org?: string }>;
};

/** The piece board (2b), the full-page form of one piece. */
export default async function ChannelPiecePage({ params, searchParams }: Props) {
  const [{ kind, id }, sp] = await Promise.all([params, searchParams]);
  if (kind !== "thread" && kind !== "artwork") notFound();
  const next = `/channel/piece/${kind}/${encodeURIComponent(id)}${sp.org ? `?org=${encodeURIComponent(sp.org)}` : ""}`;
  const user = await requireUser(`/login?next=${encodeURIComponent(next)}`);
  const model = await loadChannelModel(user, { org: sp.org });
  const piece = model.pieces.find((p) => p.key === `${kind}:${id}`);
  if (!piece) notFound();
  return (
    <ChannelFrame model={model} active="piece">
      <PieceBoard piece={piece} />
    </ChannelFrame>
  );
}
