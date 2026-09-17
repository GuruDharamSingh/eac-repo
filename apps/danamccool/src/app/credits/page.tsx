import Link from "next/link";

export const metadata = { title: "Credits" };

/**
 * Third-party credits.
 *
 * Not decoration: **Preline UI is dual licensed** — MIT plus a "Fair Use"
 * rider that permits its blocks inside a page builder only with proper
 * attribution naming Preline UI and linking its repository. This page is how
 * that condition is met, and it is linked from every page's footer.
 *
 * The MIT ones are listed too. They do not require a user-facing credit, but
 * a site built out of other people's work should say so.
 */
const CREDITS = [
  {
    name: "Preline UI",
    href: "https://github.com/htmlstreamofficial/preline",
    licence: "MIT and the Preline UI Fair Use License",
    used: "The opening section on pages built with the page editor.",
  },
  {
    name: "HyperUI",
    href: "https://github.com/markmead/hyperui",
    licence: "MIT",
    used: "The invitation band, the press-quote grid, and the questions-and-answers section.",
  },
  {
    name: "daisyUI",
    href: "https://github.com/saadeghi/daisyui",
    licence: "MIT",
    used: "The timeline.",
  },
  {
    name: "Puck",
    href: "https://github.com/puckeditor/puck",
    licence: "MIT",
    used: "The visual page editor behind this site.",
  },
];

export default function CreditsPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Credits</h1>
      <p>
        This site is built with open-source work by other people. Their licences
        are listed here, and the terms of each are kept.
      </p>

      <dl style={{ marginTop: "2rem" }}>
        {CREDITS.map((c) => (
          <div key={c.name} style={{ marginBottom: "1.5rem" }}>
            <dt style={{ fontWeight: 600 }}>
              <a href={c.href} rel="noopener noreferrer" target="_blank">
                {c.name}
              </a>
            </dt>
            <dd style={{ margin: ".15rem 0 0" }}>
              {c.used} <span style={{ fontSize: ".85rem" }}>Licence: {c.licence}.</span>
            </dd>
          </div>
        ))}
      </dl>

      <p>
        The site itself is part of the{" "}
        <Link href="/">Elkdonis Arts Collective</Link> network, which is
        open source and not for profit.
      </p>
    </article>
  );
}
