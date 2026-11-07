// ============================================================================
// The landing page as written in code: what `/` draws until a `home` page is
// published from the studio, and what the studio opens on for `home` until
// then. A Puck document, so nothing here needs a developer once the studio is
// in use — the editor shows the same props. The ids are fixed so the saved
// document keeps them.
//
// Client-safe and import-free on purpose (a page route and the studio route
// both read it): plain data only.
// ============================================================================

export const DEFAULT_HOME = {
  root: { props: { title: "Katie the Potter" } },
  content: [
    {
      type: "ktp-quick-landing",
      props: {
        id: "ktp-quick-landing-home",
        kicker: "Handmade in small batches",
        title: "Pots for everyday ritual",
        lede: "Wheel-thrown stoneware and porcelain, fired in a small studio kiln. Each piece is made to be used, and no two come out the same.",
        // Uploaded by scripts/seed-katie.ts to her Nextcloud folder; replace from the studio's picker.
        image: "/api/media/EAC_Network/users/katie/Media/Images/katie-sample-hero.png",
        imageAlt: "",
        imagePlacement: "right",
        imageShape: "arch",
        imageRadius: 16,
        align: "left",
        overlayColor: "",
        overlayOpacity: 45,
        titleSize: 64,
        titleStyle: "italic",
        ledeSize: 19,
        minHeight: 560,
        primaryLabel: "See the pieces",
        primaryHref: "#pieces",
        secondaryLabel: "",
        secondaryHref: "",
        ctaStyle: "filled",
        accent: "",
        ink: "",
        ground: "",
      },
    },
    {
      type: "ktp-artwork-grid",
      props: {
        id: "ktp-artwork-grid-home",
        // The generic Style layer's anchor: the hero's button scrolls here.
        blkStyle: { anchor: "pieces" },
        heading: "Pieces",
        intro: "Every piece is one of a kind. Open one for its story and size, then buy it right here: by card, Google Pay or Apple Pay, or by Interac eTransfer through the cart.",
        source: "store",
        chosen: [],
        sort: "newest",
        limit: 24,
        cardClick: "page",
        minColumn: 260,
        gap: 28,
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
        titleSize: 18,
        metaSize: 13,
        popupWidth: "standard",
        popupBackdrop: "",
        popupBackdropOpacity: 70,
        popupImageSide: "left",
        popupRadius: 16,
        buyLabel: "Also listed on Collect Art",
        addToCartLabel: "Add to cart",
        emptyText: "New pieces are coming out of the kiln. Check back soon.",
      },
    },
  ],
};
