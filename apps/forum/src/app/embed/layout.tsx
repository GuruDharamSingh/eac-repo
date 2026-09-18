/**
 * The embeddable forum: the same pages with no masthead, meant for an
 * <iframe> on an org's own site (or any site — a Silex page, a Puck page,
 * something outside the network entirely):
 *
 *   <iframe src="https://forum.arts-collective.com/embed/o/ifac"
 *           style="width:100%;border:0" loading="lazy"></iframe>
 *
 * /embed         — the whole network
 * /embed/o/[org] — one org, scoped: its categories in the rail, nothing else
 *
 * Who may frame it is the Content-Security-Policy frame-ancestors header in
 * next.config.ts (FORUM_EMBED_ANCESTORS). The one script on the page tells
 * the parent how tall the document is, so the host can size the frame
 * instead of showing a scrollbar inside a scrollbar:
 *
 *   window.addEventListener("message", (e) => {
 *     if (e.data?.type === "grand-forum:height") iframe.style.height = e.data.height + "px";
 *   });
 *
 * Sessions: the forum's cookie is read only when the frame is on the same
 * registrable domain as the forum. Framed from elsewhere the reader is
 * anonymous — everything reads, and the sign-in link opens the forum itself.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="gf-page gf-page--embed">
      {children}
      <script
        // Height beacon. Inline and tiny on purpose: the only JavaScript on
        // the embed, and it never touches the DOM.
        dangerouslySetInnerHTML={{
          __html: `(function(){if(window.parent===window)return;var p=function(){try{parent.postMessage({type:"grand-forum:height",height:document.documentElement.scrollHeight},"*")}catch(e){}};p();if(window.ResizeObserver){new ResizeObserver(p).observe(document.documentElement)}else{window.addEventListener("load",p);window.addEventListener("resize",p)}})();`,
        }}
      />
    </main>
  );
}
