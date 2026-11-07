// The classifieds page, rebuilt from the developer's canvas screenshots of 2026-11-02: same nesting, same declarations.
let n = 0;
const id = (p: string) => `${p}${++n}`;
const box = (tag: string, css: string, items: any[], extra: object = {}) => ({ type: "box", props: { id: id("b"), tag, look: { css }, items, ...extra } });
const words = (tag: string, html: string, css = "", extra: object = {}) => ({ type: "words", props: { id: id("w"), tag, html, ...(css ? { look: { css } } : {}), ...extra } });
const AD = "font-size: 12.5px; line-height: 1.38; text-align: justify; hyphens: auto; padding: 7px 0; border-bottom: 1px solid rgba(29,26,22,.3)";
const HEAD = "margin: 0 0 4px; font-size: 13px; font-weight: 700; letter-spacing: .24em; text-transform: uppercase; text-align: center; border-top: 2px solid #1d1a16; border-bottom: 1px solid #1d1a16; padding: 4px 0";
const adCol = (anchor: string, span: number, title: string, ads: string[], line = true) => box("div", `grid-column: span ${span}; display: flex; flex-direction: column;${line ? " border-right: 1px solid #1d1a16; padding-right: 16px" : ""}`, [words("h2", title, HEAD), ...ads.map((a) => words("div", a, AD))], { anchor });
const navItem = (label: string, to: string) => words("span", label, "text-decoration: none; color: inherit", { href: `#${to}` });
export const classifieds = {
  root: { props: { title: "Classifieds page", look: { fill: "#ffffff" } } },
  content: [
    box("div", "background: #e9e3d2; color: #1d1a16; font-family: 'Old Standard TT', Georgia, serif; padding: 40px 24px 64px; box-sizing: border-box; min-height: 100%", [
      box("div", "max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px", [
        box("header", "display: flex; flex-direction: column; gap: 8px; position: relative", [
          box("div", "display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; border-bottom: 1px solid #1d1a16; padding-bottom: 6px", [
            words("span", "Vol. I · No. 1"), words("span", "Sunday, 1 November 2026"), words("span", "arts-collective.com/classifieds"),
          ]),
          box("div", "display: flex; align-items: center; justify-content: space-between; gap: 20px", [
            words("div", "Notices<br>Wants<br>Offerings", "font-size: 11px; letter-spacing: .2em; text-transform: uppercase; text-align: center; border: 1px solid #1d1a16; padding: 8px"),
            words("h1", "The Collective Classifieds", "margin: 0; font-size: 62px; line-height: 1; text-align: center; flex-grow: 1"),
            words("div", "Place an ad<br>from your org's hub", "font-size: 11px; letter-spacing: .2em; text-transform: uppercase; text-align: center; border: 1px solid #1d1a16; padding: 8px"),
          ]),
        ]),
        words("p", "Notices, wants &amp; offerings from across the Elkdonis Arts Collective network", "margin: 0; text-align: center; font-style: italic; border-top: 1px solid #1d1a16; border-bottom: 1px solid #1d1a16; padding: 4px 0"),
        box("nav", "display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 22px; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; padding: 2px 0 4px", [
          navItem("For Sale", "for-sale"), navItem("Wanted", "wanted"), navItem("Lessons &amp; Circles", "lessons"), navItem("Studios", "studios"),
        ], { label: "Sections" }),
        box("section", "display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; align-items: start; position: relative", [
          adCol("for-sale", 1, "For Sale", ["<b>EASEL,</b> oak H-frame, adjustable, some paint.", "<b>KILN,</b> electric, cone 6, collect.", "<b>FLAT FILE,</b> five drawers, heavy.", "<b>LINEN,</b> primed, two rolls."]),
          box("div", "grid-column: span 3; display: flex; flex-direction: column; gap: 12px; background: #161616; color: #f1ecdf; padding: 20px 22px 18px", [
            words("span", "This month", "align-self: flex-start; background: #b5301f; color: #ffffff; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; padding: 3px 9px"),
            words("h2", "Silent Auction", "margin: 0; font-size: 58px; line-height: .92"),
            words("p", "Original work by member artists · November 2026", "margin: 0; font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: #79b3c7"),
            words("p", "Ladder bids, proxy bids, and buy-now on selected pieces. Each artist names a beneficiary, who receives a share of the sale.", "margin: 0; font-size: 14px; line-height: 1.45"),
            box("div", "display: flex; justify-content: space-between; align-items: baseline; gap: 16px", [
              words("span", "Bidding opens [DATE]", "font-size: 17px; font-weight: 700"), words("span", "market.arts-collective.com →", "font-size: 12px; letter-spacing: .1em; text-transform: uppercase"),
            ]),
          ], { anchor: "auction" }),
          adCol("wanted", 2, "Wanted", ["<b>ACCOMPANIST</b> for a Sunday choir.", "<b>MODELS</b> for life drawing, Tuesdays.", "<b>OLD FRAMES,</b> any state."], false),
        ], { label: "First page of ads" }),
        box("div", "display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: stretch", [
          box("div", "display: flex; flex-direction: column; gap: 8px; border: 2px solid #1d1a16; padding: 12px", [
            words("div", "❦ Lessons ❦", "font-size: 12px; letter-spacing: .24em; text-align: center; text-transform: uppercase"), words("h3", "Life Drawing, Tuesday Evenings", "margin: 0; font-size: 26px; text-align: center"),
            words("p", "Long poses after the break. Bring paper and charcoal; boards and donkeys are provided.", "margin: 0; font-size: 13px; text-align: justify"),
          ], { anchor: "lessons" }),
          box("div", "display: flex; flex-direction: column; gap: 8px; background: #dcd6c6; padding: 12px", [
            words("span", "Wanted", "align-self: flex-start; background: #b5301f; color: #ffffff; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; padding: 3px 9px"), words("h3", "A second pair of hands at the press", "margin: 0; font-size: 22px"),
            words("p", "Two mornings a week through winter.", "margin: 0; font-size: 13px"),
          ], { anchor: "studios" }),
        ]),
      ]),
    ]),
  ],
};
