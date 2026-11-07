// ============================================================================
// The piece-detail TEMPLATE as written in code: what every /pieces/<slug>
// draws until a `piece-detail` document is published from the Studio
// (/studio/piece-detail). Recomposed from blocks, so the Studio can rearrange
// it: a feature ktp-piece with no binding (= the page's own piece), its
// details, and a "More pieces" grid of its neighbours.
//
// Replaces the hand-written PiecePage and its `ktp:detail` site_config key
// (retired 2026-11-07: nothing had ever written it, and every value it held is
// now a field or a look on these blocks). Plain data, import-free.
// ============================================================================

export const DEFAULT_PIECE_DETAIL = {
  root: { props: { title: "A piece" } },
  content: [
    {
      type: "ktp-piece",
      props: {
        id: "pd-piece",
        artwork: "",
        layout: "feature",
        title: "",
        kicker: "",
        caption: "",
        image: "",
        // Buy now (straight to Stripe) + Add to cart · continue shopping (2026-11-07).
        cardClick: "page",
        ctaMode: "buy-now",
        ctaLabel: "",
        buyNowLabel: "",
        buyNowNote: "",
        pictures: "all",
        showPrice: true,
        showMedium: true,
        showDimensions: true,
        showStatus: true,
        priceFormat: "plain",
      },
    },
    {
      type: "ktp-piece-details",
      props: {
        id: "pd-details",
        artwork: "",
        showNav: true,
        showFacts: true,
        showDescription: true,
        note: "Pay here by card or Interac eTransfer. Each piece is one of a kind and is held for you once you check out.",
      },
    },
    {
      type: "ktp-artwork-grid",
      props: {
        id: "pd-more",
        heading: "More pieces",
        intro: "",
        source: "more",
        chosen: [],
        sort: "newest",
        limit: 4,
        cardClick: "page",
        minColumn: 200,
        gap: 24,
        aspect: "4:5",
        topShape: "rounded",
        radius: 10,
        imageFit: "cover",
        captionPosition: "below",
        showPrice: true,
        showMedium: true,
        showDimensions: false,
        showStatus: true,
        priceFormat: "plain",
        hover: "lift",
        cardBg: "",
        cardInk: "",
        accent: "",
        titleSize: 17,
        metaSize: 13,
        popupWidth: "standard",
        popupBackdrop: "",
        popupBackdropOpacity: 70,
        popupImageSide: "left",
        popupRadius: 16,
        buyLabel: "Also listed on Collect Art",
        addToCartLabel: "Add to cart",
        emptyText: "",
      },
    },
  ],
};
