export const metadata = { title: "Vimeo" };

// Her real nav had a Vimeo item, but no video URL survived the scrape — an
// honest "not yet linked" note rather than a fabricated embed.
export default function VimeoPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Vimeo</h1>
      <p>Video documentation isn&rsquo;t linked here yet.</p>
    </article>
  );
}
