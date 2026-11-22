import { createElement, type ComponentType, type ReactNode } from "react";
import type { Block } from "@elkdonis/blocks";
import { withSample } from "./util";
// Scoped copy of Sunjay's palette and landing styles (selectors under [data-mock-app="sunjay"]).
import "../mocks/sunjay/sunjay-mock.css";

const STAGE_HTML = `<div class="ifs-stage"><div class="ifs-stage__body"><p class="ifs-stage__eyebrow">Autumn series</p><h2 class="ifs-stage__title">Ritual Theatre Lab</h2><p class="ifs-stage__week">Week 4 of 8</p><p class="ifs-stage__lede">A weekly lab for movement, voice and presence.</p><div class="ifs-stage__actions"><a href="#">Join this week</a></div></div></div>`;
const JOIN_HTML = `<div class="ifs-join"><h3>Join the group</h3><p>Leave an email and we will send the next invitation.</p></div>`;

/**
 * Wraps a landing piece (home-*): these blocks draw whatever the page hands them in puck.metadata.parts, so the
 * wrapper hands them a drawn part (a real mock component, or a little markup) the way app/page.tsx does.
 */
function withPart(block: unknown, part: ReactNode | string): Block<never> {
  const b = block as Block<Record<string, unknown>>;
  const Inner = b.Component as ComponentType<Record<string, unknown>>;
  const id = b.def.id;
  function Landing(props: Record<string, unknown>) {
    const puck = (props.puck ?? {}) as { metadata?: Record<string, unknown> };
    const metadata = { ...(puck.metadata ?? {}), parts: { ...((puck.metadata?.parts as Record<string, unknown>) ?? {}), [id]: part } };
    return createElement(Inner, { ...props, puck: { ...puck, metadata } });
  }
  return { ...b, Component: Landing } as unknown as Block<never>;
}

/** sunjay: the layout, small and writing blocks, plus the four landing pieces with a part handed in. */
export async function load(): Promise<Block<never>[]> {
  const [home, layout, small, writing, standing, forum] = await Promise.all([
    import("../../../../sunjay/src/blocks/home-blocks"),
    import("../../../../sunjay/src/blocks/layout-blocks"),
    import("../../../../sunjay/src/blocks/small-blocks"),
    import("../../../../sunjay/src/blocks/writing-blocks"),
    import("../mocks/sunjay/standing"),
    import("../mocks/sunjay/forum"),
  ]);
  const byId = (id: string) => home.HOME_BLOCKS.find((b) => (b as unknown as Block).def.id === id);
  return [
    withPart(byId("home-stage"), STAGE_HTML),
    withPart(byId("home-standing"), createElement(standing.default)),
    withPart(byId("home-forum"), createElement(forum.default)),
    withPart(byId("home-join"), JOIN_HTML),
    layout.band,
    layout.banner,
    layout.heading,
    layout.link,
    small.steps,
    small.notice,
    writing.journal,
    writing.article,
    writing.seriesNav,
    writing.post,
  ].map((b) => ((b as Block).def.id.startsWith("home-") ? (b as Block<never>) : withSample(b)));
}
