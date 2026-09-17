/**
 * A drawn cover for a book that has no image: a cloth board with a paper
 * label, its title set on the label. Used on the hero's book slide, the
 * vertical banner and the shelf, so a book never appears as a broken image.
 */
export function BookCoverFallback({
  title,
  author,
  spine = false,
}: {
  title: string;
  author?: string | null;
  /** Tall-and-narrow variant for the vertical banner. */
  spine?: boolean;
}) {
  return (
    <svg
      viewBox={spine ? "0 0 100 340" : "0 0 200 300"}
      preserveAspectRatio={spine ? "xMidYMid meet" : "xMidYMid slice"}
      style={spine ? { background: "#4a0f12" } : undefined}
      role="img"
      aria-label={`${title}${author ? ` by ${author}` : ""}`}
    >
      <defs>
        <linearGradient id="cloth" x1="0" x2="1">
          <stop offset="0" stopColor="#3a0c0f" />
          <stop offset="0.12" stopColor="#5a1417" />
          <stop offset="1" stopColor="#4a0f12" />
        </linearGradient>
        <pattern id="weave" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="transparent" />
          <path d="M0 2h4M2 0v4" stroke="rgba(0,0,0,0.12)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cloth)" />
      <rect width="100%" height="100%" fill="url(#weave)" />
      {spine ? (
        <>
          <rect x="14" y="30" width="72" height="280" fill="#f2e4c9" stroke="#d9a441" strokeWidth="2" />
          <text
            transform="translate(56 170) rotate(90)"
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize="12.5"
            fill="#2b1e16"
            letterSpacing="0.5"
          >
            {title.length > 42 ? `${title.slice(0, 41)}…` : title}
          </text>
          {author && (
            <text
              transform="translate(38 170) rotate(90)"
              textAnchor="middle"
              fontFamily="Verdana, sans-serif"
              fontSize="8"
              fill="#6a5340"
              letterSpacing="2"
            >
              {author.toUpperCase()}
            </text>
          )}
        </>
      ) : (
        <>
          <rect x="24" y="80" width="152" height="120" fill="#f2e4c9" stroke="#d9a441" strokeWidth="2" />
          <foreignObject x="30" y="88" width="140" height="104">
            <div
              // @ts-expect-error xmlns is required inside foreignObject and not in React's typings
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 15,
                lineHeight: 1.25,
                color: "#2b1e16",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <div>{title}</div>
              {author && (
                <div style={{ marginTop: 8, fontFamily: "Verdana, sans-serif", fontSize: 8, letterSpacing: 2, color: "#6a5340" }}>
                  {author.toUpperCase()}
                </div>
              )}
            </div>
          </foreignObject>
        </>
      )}
      <rect x="0" y="0" width="10" height="100%" fill="rgba(0,0,0,0.28)" />
    </svg>
  );
}
