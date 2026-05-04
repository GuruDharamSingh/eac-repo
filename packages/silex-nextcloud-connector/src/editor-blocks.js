(function () {
  var SLOT_CATEGORY = "Arts Live Slots";
  var LAYOUT_CATEGORY = "EAC Layout";
  var TEMPLATE_CATEGORY = "EAC Templates";
  var WORKSHOP_CATEGORY = "EAC Workshop Template";
  var CONTENT_CATEGORY = "EAC Content";
  var SIMPLE_MODE = new URLSearchParams(window.location.search).get("mode") === "simple";
  var workshopTemplate = window.__eacWorkshopTemplate || null;

  function slot(component, attrs) {
    var out = '<eac-embed data-eac-component="' + component + '" data-variant="inline"';
    Object.keys(attrs || {}).forEach(function (key) {
      out += ' ' + key + '="' + String(attrs[key]).replace(/"/g, "&quot;") + '"';
    });
    out += '><div class="eac-editor-placeholder"><strong>' + (attrs["data-title"] || component) + '</strong><span>Live Arts component renders on the public site.</span></div></eac-embed>';
    return out;
  }

  var liveSlotBlocks = [
    { id: "eac-slot-feed", label: "Feed Slot", content: slot("org-feed", { "data-title": "Latest updates", "data-limit": "4" }) },
    { id: "eac-slot-workshops", label: "Workshop Slot", content: slot("workshop-cards", { "data-title": "Workshop sessions", "data-limit": "3" }) },
    { id: "eac-slot-rsvp", label: "RSVP Slot", content: slot("rsvp", { "data-title": "Reserve your place", "data-limit": "3" }) },
    { id: "eac-slot-poll", label: "Poll Slot", content: slot("poll", { "data-title": "Community poll", "data-question": "What should we offer next?", "data-options": "Practice|Workshop|Open studio" }) },
    { id: "eac-slot-live", label: "Live Slot", content: slot("live", { "data-title": "Live channel", "data-status": "Upcoming" }) },
    { id: "eac-slot-resources", label: "Resource Slot", content: slot("resources", { "data-title": "Resources", "data-items": "Notes|Replay|Worksheet" }) },
  ];

  var structureBlocks = [
    {
      id: "eac-section",
      label: "Section",
      content: '<section class="eac-section" data-bg="surface" data-pad="md"><div class="eac-section-inner"><div class="eac-drop"></div></div></section>',
    },
    {
      id: "eac-hero",
      label: "Hero",
      content: '<section class="eac-hero" data-overlay="true"><div class="eac-hero-bg"></div><div class="eac-hero-inner"><p class="eac-kicker">Eyebrow</p><h1 class="eac-hero-title">Hero heading</h1><p class="eac-hero-sub">Short supporting line.</p></div></section>',
    },
    {
      id: "eac-two-col",
      label: "Two Column",
      content: '<div class="eac-two-col"><div class="eac-drop"></div><div class="eac-drop"></div></div>',
    },
    {
      id: "eac-feature-split",
      label: "Feature Split",
      content: '<div class="eac-feature-split" data-reverse="false"><div class="eac-feature-media"><div class="eac-drop"></div></div><div class="eac-feature-text"><div class="eac-drop"></div></div></div>',
    },
    {
      id: "eac-three-col",
      label: "Three Column",
      content: '<div class="eac-three-col"><div class="eac-drop"></div><div class="eac-drop"></div><div class="eac-drop"></div></div>',
    },
    {
      id: "eac-stack",
      label: "Stack",
      content: '<div class="eac-stack"><div class="eac-drop"></div></div>',
    },
    {
      id: "eac-cta-band",
      label: "CTA Band",
      content: '<section class="eac-cta-band" data-bg="accent"><div class="eac-cta-inner"><h2 class="eac-cta-title">Take the next step</h2><div class="eac-cta-action eac-drop"></div></div></section>',
    },
    {
      id: "eac-footer",
      label: "Footer",
      content: '<footer class="eac-footer" data-bg="dark"><div class="eac-footer-inner"><div class="eac-footer-col"><p class="eac-kicker">Organization</p><h3 class="eac-footer-title">Site name</h3><p class="eac-footer-copy">A short line about who you are and what this surface holds.</p></div><div class="eac-footer-col"><p class="eac-kicker">Explore</p><ul class="eac-footer-list"><li><a href="#">About</a></li><li><a href="#">Workshops</a></li><li><a href="#">Updates</a></li><li><a href="#">Contact</a></li></ul></div><div class="eac-footer-col"><p class="eac-kicker">Stay close</p><ul class="eac-footer-list"><li><a href="#">Newsletter</a></li><li><a href="#">Network feed</a></li><li><a href="#">Calendar</a></li></ul></div></div><div class="eac-footer-base"><span>© Site name</span><span>Built on EAC</span></div></footer>',
    },
  ];

  var templateBlocks = [
    {
      id: "eac-template-workshop",
      label: "Workshop / Offering",
      content: '<main class="eac-template eac-template-workshop">' +
        '<section class="eac-hero" data-overlay="true"><div class="eac-hero-bg"></div><div class="eac-hero-inner"><p class="eac-kicker">Workshop</p><h1 class="eac-hero-title">A focused session for practice and study</h1><p class="eac-hero-sub">Introduce the offering, who it is for, and what participants will leave with.</p></div></section>' +
        '<section class="eac-section" data-bg="bg" data-pad="md"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Overview</p><h2 class="eac-section-title">What this workshop opens</h2><p class="eac-section-copy">Use this space to describe the arc of the session, the tone of the work, and any preparation participants should know about.</p></div></div></section>' +
        '<div class="eac-three-col"><article class="eac-info-card"><p class="eac-kicker">Curriculum</p><h3>Core practice</h3><p>Three to five concrete topics, prompts, or exercises.</p></article><article class="eac-info-card"><p class="eac-kicker">Format</p><h3>How we meet</h3><p>Online, in person, hybrid, group size, rhythm, and access notes.</p></article><article class="eac-info-card"><p class="eac-kicker">Dates</p><h3>Upcoming sessions</h3><p>Use the live workshop slot below for real dates once content exists.</p></article></div>' +
        '<div class="eac-feature-split" data-reverse="false"><div class="eac-feature-media"></div><div class="eac-feature-text"><p class="eac-kicker">Facilitator</p><h2 class="eac-section-title">Guide this section with your voice</h2><p class="eac-section-copy">Add a photo, short bio, lineage, or context for why this offering matters now.</p></div></div>' +
        '<section class="eac-section" data-bg="surface" data-pad="md"><div class="eac-section-inner">' +
        slot("workshop-cards", { "data-title": "Upcoming sessions", "data-limit": "3" }) +
        '</div></section>' +
        '<section class="eac-cta-band" data-bg="accent"><div class="eac-cta-inner"><h2 class="eac-cta-title">Reserve your place</h2><div class="eac-cta-action">' +
        slot("rsvp", { "data-title": "Reserve your place", "data-limit": "3" }) +
        '</div></div></section>' +
        '</main>',
    },
    {
      id: "eac-template-artist",
      label: "Artist Profile",
      content: '<main class="eac-template eac-template-artist">' +
        '<section class="eac-hero" data-overlay="true"><div class="eac-hero-bg"></div><div class="eac-hero-inner"><p class="eac-kicker">City / region</p><h1 class="eac-hero-title">Artist name</h1><p class="eac-hero-sub">A short line about the practice, offering, or body of work.</p></div></section>' +
        '<div class="eac-feature-split" data-reverse="false"><div class="eac-feature-media"></div><div class="eac-feature-text"><p class="eac-kicker">Profile</p><h2 class="eac-section-title">A practice in motion</h2><p class="eac-section-copy">Use this block for a fuller bio, discipline list, or a plainspoken account of what you make and who it serves.</p></div></div>' +
        '<section class="eac-section" data-bg="surface" data-pad="md"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Practice</p><h2 class="eac-section-title">What the work keeps returning to</h2><p class="eac-section-copy">Describe recurring themes, materials, methods, questions, collaborations, or forms.</p></div></div></section>' +
        '<section class="eac-section" data-bg="bg" data-pad="md"><div class="eac-section-inner"><div class="eac-two-col"><div><p class="eac-kicker">Featured work</p><h2 class="eac-section-title">Current focus</h2><p class="eac-section-copy">A highlight, project, service, or experiment can sit here.</p></div><div>' +
        slot("org-feed", { "data-title": "Latest updates", "data-limit": "4" }) +
        '</div></div></div></section>' +
        '<section class="eac-section" data-bg="surface-2" data-pad="md"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Philosophy</p><h2 class="eac-section-title">Why this work matters</h2><p class="eac-section-copy">Close with a statement, working principles, or notes on what kind of contact and collaboration you welcome.</p></div></div></section>' +
        '</main>',
    },
    {
      id: "eac-template-feed",
      label: "Collective Hub",
      content: '<main class="eac-template eac-template-feed">' +
        '<section class="eac-section" data-bg="surface" data-pad="lg"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Collective hub</p><h1 class="eac-hero-title eac-hero-title-inline">A public surface for shared work</h1><p class="eac-section-copy">Use this page when the organization needs a calm feed, a few featured directions, and live collective updates.</p></div></div></section>' +
        '<div class="eac-three-col"><article class="eac-info-card"><p class="eac-kicker">Spotlight</p><h3>Practice</h3><p>Feature an active area of the collective.</p></article><article class="eac-info-card"><p class="eac-kicker">Gathering</p><h3>Meetings</h3><p>Point people toward the next room or session.</p></article><article class="eac-info-card"><p class="eac-kicker">Resources</p><h3>Shared library</h3><p>Surface useful links, notes, or replay material.</p></article></div>' +
        '<section class="eac-section" data-bg="bg" data-pad="md"><div class="eac-section-inner"><div class="eac-two-col"><div>' +
        slot("org-feed", { "data-title": "Latest updates", "data-limit": "6" }) +
        '</div><div>' +
        slot("community-feed", { "data-title": "Across the network", "data-limit": "4" }) +
        '</div></div></div></section>' +
        '<section class="eac-section" data-bg="surface-2" data-pad="md"><div class="eac-section-inner"><div class="eac-stack">' +
        slot("poll", { "data-title": "Community poll", "data-question": "What should we offer next?", "data-options": "Practice|Workshop|Open studio" }) +
        '</div></div></section>' +
        '</main>',
    },
  ];

  var contentBlocks = [
    {
      id: "eac-heading",
      label: "Heading",
      content: '<h2 class="eac-heading">A clear heading</h2>',
    },
    {
      id: "eac-kicker",
      label: "Kicker",
      content: '<p class="eac-kicker">Eyebrow label</p>',
    },
    {
      id: "eac-paragraph",
      label: "Paragraph",
      content: '<p class="eac-prose">Use this for body copy. Keep sentences plain and the rhythm steady; the editor inherits the EAC type scale automatically.</p>',
    },
    {
      id: "eac-button",
      label: "Button",
      content: '<a class="eac-button" data-variant="solid" href="#">Call to action</a>',
    },
    {
      id: "eac-button-ghost",
      label: "Ghost Button",
      content: '<a class="eac-button" data-variant="ghost" href="#">Learn more</a>',
    },
    {
      id: "eac-image",
      label: "Image",
      content: '<figure class="eac-image"><img src="https://placehold.co/1200x720/efe9dd/5a5045?text=Image" alt="Replace with your image" /><figcaption class="eac-image-caption">Optional caption</figcaption></figure>',
    },
    {
      id: "eac-divider",
      label: "Divider",
      content: '<hr class="eac-divider" />',
    },
    {
      id: "eac-quote",
      label: "Quote",
      content: '<blockquote class="eac-quote"><p>"A line that captures what the work feels like in someone else\'s words."</p><footer class="eac-quote-attr">Speaker name, role</footer></blockquote>',
    },
    {
      id: "eac-stats-row",
      label: "Stats Row",
      content: '<div class="eac-stats-row" data-cols="3"><div class="eac-stat"><strong>120+</strong><span>Sessions held</span></div><div class="eac-stat"><strong>14</strong><span>Cities</span></div><div class="eac-stat"><strong>3</strong><span>Years running</span></div></div>',
    },
    {
      id: "eac-faq",
      label: "FAQ Accordion",
      content: '<section class="eac-faq"><h2 class="eac-section-title">Frequently asked</h2><details class="eac-faq-item" open><summary>What is included?</summary><p>Describe what someone gets when they sign up, attend, or join.</p></details><details class="eac-faq-item"><summary>Who is this for?</summary><p>Audience, prerequisites, and any access notes worth being explicit about.</p></details><details class="eac-faq-item"><summary>How do I take part?</summary><p>Mention RSVP, payment, or participation flow in plain language.</p></details></section>',
    },
    {
      id: "eac-team-card",
      label: "Team Card",
      content: '<article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person name</h3><p class="eac-team-bio">A short paragraph about practice, lineage, or current direction.</p></div></article>',
    },
    {
      id: "eac-team-grid",
      label: "Team Grid",
      content: '<div class="eac-team-grid"><article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person one</h3><p class="eac-team-bio">A short paragraph about practice or focus.</p></div></article><article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person two</h3><p class="eac-team-bio">A short paragraph about practice or focus.</p></div></article><article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person three</h3><p class="eac-team-bio">A short paragraph about practice or focus.</p></div></article></div>',
    },
    {
      id: "eac-gallery",
      label: "Gallery Grid",
      content: '<div class="eac-gallery" data-cols="3"><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/efe9dd/5a5045?text=1" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/d8ddd8/5a5045?text=2" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/efe9dd/5a5045?text=3" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/d8ddd8/5a5045?text=4" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/efe9dd/5a5045?text=5" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/d8ddd8/5a5045?text=6" alt="" /></figure></div>',
    },
    {
      id: "eac-video",
      label: "Video Embed",
      content: '<div class="eac-video"><div class="eac-video-frame"><iframe src="about:blank" title="Video" frameborder="0" allowfullscreen></iframe></div><p class="eac-video-caption">Replace src with a YouTube, Vimeo, or PeerTube embed URL.</p></div>',
    },
    {
      id: "eac-logo-wall",
      label: "Logo Wall",
      content: '<section class="eac-logo-wall"><p class="eac-kicker">Trusted by</p><div class="eac-logo-row"><div class="eac-logo">Logo 1</div><div class="eac-logo">Logo 2</div><div class="eac-logo">Logo 3</div><div class="eac-logo">Logo 4</div><div class="eac-logo">Logo 5</div></div></section>',
    },
    {
      id: "eac-event-schedule",
      label: "Event Schedule",
      content: '<section class="eac-schedule"><h2 class="eac-section-title">Schedule</h2><ol class="eac-schedule-list"><li class="eac-schedule-item"><span class="eac-schedule-time">10:00</span><div class="eac-schedule-body"><h3>Opening</h3><p>Set the room and the intent for the day.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">11:00</span><div class="eac-schedule-body"><h3>First practice</h3><p>Move into the core exercise of the morning.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">13:00</span><div class="eac-schedule-body"><h3>Lunch</h3><p>Shared meal and slower conversation.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">14:30</span><div class="eac-schedule-body"><h3>Afternoon session</h3><p>Deepen, share, or move into smaller groups.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">17:00</span><div class="eac-schedule-body"><h3>Close</h3><p>Reflections and what comes next.</p></div></li></ol></section>',
    },
    {
      id: "eac-pricing",
      label: "Pricing Tiers",
      content: '<section class="eac-pricing"><div class="eac-pricing-tier"><p class="eac-kicker">Supporter</p><h3 class="eac-pricing-name">Sliding</h3><p class="eac-pricing-amount">$0+</p><ul class="eac-pricing-list"><li>Pay what you can</li><li>Full access</li><li>Community channel</li></ul><a class="eac-button" data-variant="ghost" href="#">Choose</a></div><div class="eac-pricing-tier" data-featured="true"><p class="eac-kicker">Standard</p><h3 class="eac-pricing-name">Suggested</h3><p class="eac-pricing-amount">$48</p><ul class="eac-pricing-list"><li>Sustaining rate</li><li>Full access</li><li>Replays</li></ul><a class="eac-button" data-variant="solid" href="#">Choose</a></div><div class="eac-pricing-tier"><p class="eac-kicker">Patron</p><h3 class="eac-pricing-name">Sustaining</h3><p class="eac-pricing-amount">$120</p><ul class="eac-pricing-list"><li>Help fund access</li><li>Full access</li><li>One-on-one</li></ul><a class="eac-button" data-variant="ghost" href="#">Choose</a></div></section>',
    },
  ];

  function addEditorCss(editor) {
    var css = [
      ":root{--eac-bg:#f5f0e8;--eac-surface:#fbf8f2;--eac-surface-2:#efe9dd;--eac-overlay:rgba(20,18,14,.55);--eac-text:#1a1612;--eac-text-soft:#5a5045;--eac-text-inv:#faf6ee;--eac-accent:#b85c3a;--eac-accent-2:#0f766e;--eac-border:#d8ddd8;--eac-border-soft:#e8e3d8;--eac-font-serif:Georgia,serif;--eac-font-sans:Inter,system-ui,sans-serif;--eac-s-1:8px;--eac-s-2:16px;--eac-s-3:24px;--eac-s-4:36px;--eac-s-5:56px;--eac-s-6:84px;--eac-radius:8px;--eac-radius-lg:14px;--eac-content-max:1024px}",
      "eac-embed{display:block;min-height:96px;margin:12px 0;padding:14px;border:1px dashed #0f766e;border-radius:8px;background:#eef8f4;color:#17201b;font-family:Inter,Arial,sans-serif}",
      ".eac-editor-placeholder{display:flex;min-height:72px;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px}",
      ".eac-editor-placeholder strong{font-size:16px}.eac-editor-placeholder span{font-size:13px;color:#4f5e55}",
      ".eac-kicker{margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--eac-accent-2)}",
      ".eac-template,.eac-section,.eac-hero,.eac-two-col,.eac-three-col,.eac-feature-split,.eac-stack,.eac-cta-band,.eac-info-card,.eac-drop{box-sizing:border-box;font-family:var(--eac-font-sans);letter-spacing:0}",
      ".eac-section{width:100%;padding:var(--eac-s-5) var(--eac-s-3);color:var(--eac-text)}.eac-section[data-bg=bg]{background:var(--eac-bg)}.eac-section[data-bg=surface]{background:var(--eac-surface)}.eac-section[data-bg=surface-2]{background:var(--eac-surface-2)}.eac-section[data-bg=dark]{background:var(--eac-text);color:var(--eac-text-inv)}.eac-section[data-pad=sm]{padding:var(--eac-s-3) var(--eac-s-3)}.eac-section[data-pad=lg]{padding:var(--eac-s-6) var(--eac-s-3)}.eac-section-inner{max-width:var(--eac-content-max);margin:0 auto}",
      ".eac-hero{position:relative;min-height:60vh;display:grid;place-items:center;padding:var(--eac-s-6) var(--eac-s-3);color:var(--eac-text-inv);overflow:hidden}.eac-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,#2a2118,#4a3a2a)}.eac-hero[data-overlay=true] .eac-hero-bg:after{content:'';position:absolute;inset:0;background:var(--eac-overlay)}.eac-hero-inner{position:relative;max-width:var(--eac-content-max);text-align:center}.eac-hero-title{font-family:var(--eac-font-serif);font-size:clamp(36px,6vw,64px);line-height:1.05;margin:var(--eac-s-2) 0;letter-spacing:0}.eac-hero-title-inline{color:var(--eac-text);text-align:left}.eac-hero-sub{max-width:680px;margin:0 auto;font-size:18px;line-height:1.6;color:inherit}",
      ".eac-section-title{font-family:var(--eac-font-serif);font-size:clamp(26px,4vw,42px);line-height:1.12;margin:0;color:inherit;letter-spacing:0}.eac-section-copy{font-size:16px;line-height:1.7;color:var(--eac-text-soft);margin:var(--eac-s-2) 0 0}.eac-section[data-bg=dark] .eac-section-copy{color:var(--eac-text-inv)}",
      ".eac-two-col:not(.eac-compound-grid){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--eac-s-3);max-width:var(--eac-content-max);margin:0 auto;padding:var(--eac-s-4) var(--eac-s-3)}.eac-three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--eac-s-3);max-width:var(--eac-content-max);margin:0 auto;padding:var(--eac-s-4) var(--eac-s-3)}",
      ".eac-feature-split{display:grid;grid-template-columns:3fr 2fr;gap:var(--eac-s-4);align-items:center;max-width:var(--eac-content-max);margin:0 auto;padding:var(--eac-s-5) var(--eac-s-3);color:var(--eac-text)}.eac-feature-split[data-reverse=true]{grid-template-columns:2fr 3fr;direction:rtl}.eac-feature-split[data-reverse=true]>*{direction:ltr}.eac-feature-media{display:grid;place-items:center;min-height:280px;border-radius:var(--eac-radius);background:var(--eac-surface-2);border:1px solid var(--eac-border-soft)}.eac-feature-text{min-width:0}",
      ".eac-stack{display:flex;flex-direction:column;gap:var(--eac-s-2);max-width:var(--eac-content-max);margin:0 auto;padding:var(--eac-s-4) var(--eac-s-3)}.eac-cta-band{background:var(--eac-accent);color:var(--eac-text-inv);padding:var(--eac-s-5) var(--eac-s-3)}.eac-cta-inner{max-width:var(--eac-content-max);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:var(--eac-s-3);flex-wrap:wrap}.eac-cta-title{font-family:var(--eac-font-serif);font-size:clamp(24px,3vw,36px);line-height:1.12;margin:0;letter-spacing:0}.eac-cta-action{min-width:min(100%,320px)}",
      ".eac-info-card{min-height:160px;padding:var(--eac-s-3);border:1px solid var(--eac-border);border-radius:var(--eac-radius);background:var(--eac-surface);color:var(--eac-text)}.eac-info-card h3{font-family:var(--eac-font-serif);font-size:24px;line-height:1.15;margin:0;letter-spacing:0}.eac-info-card p:not(.eac-kicker){margin:var(--eac-s-2) 0 0;line-height:1.6;color:var(--eac-text-soft)}.eac-drop{min-height:48px;border:1px dashed var(--eac-border);border-radius:var(--eac-radius);background:rgba(255,255,255,.28)}.eac-drop:empty:before{content:'Drop content here';display:flex;min-height:48px;align-items:center;justify-content:center;color:var(--eac-text-soft);font-size:13px}",
      "@media(max-width:780px){.eac-section,.eac-section[data-pad=lg],.eac-feature-split,.eac-two-col:not(.eac-compound-grid),.eac-three-col,.eac-stack,.eac-cta-band{padding-left:var(--eac-s-2);padding-right:var(--eac-s-2)}.eac-two-col:not(.eac-compound-grid),.eac-three-col,.eac-feature-split,.eac-feature-split[data-reverse=true]{grid-template-columns:1fr}.eac-hero{min-height:52vh}.eac-cta-inner{align-items:flex-start}.eac-hero-title{font-size:36px}}",
      // EAC Content blocks
      ".eac-heading{font-family:var(--eac-font-serif);font-size:clamp(24px,3vw,38px);line-height:1.15;margin:var(--eac-s-3) auto var(--eac-s-2);max-width:var(--eac-content-max);padding:0 var(--eac-s-3);color:var(--eac-text);letter-spacing:0}",
      ".eac-prose{font-size:17px;line-height:1.75;color:var(--eac-text-soft);max-width:var(--eac-content-max);margin:var(--eac-s-2) auto;padding:0 var(--eac-s-3)}",
      ".eac-button{display:inline-block;padding:12px 22px;border-radius:999px;font-family:var(--eac-font-sans);font-weight:600;font-size:15px;text-decoration:none;line-height:1;letter-spacing:0;transition:transform .12s ease,opacity .12s ease}.eac-button[data-variant=solid]{background:var(--eac-accent);color:var(--eac-text-inv)}.eac-button[data-variant=ghost]{background:transparent;color:var(--eac-text);border:1px solid var(--eac-border)}.eac-button:hover{transform:translateY(-1px);opacity:.92}",
      ".eac-image{margin:var(--eac-s-3) auto;max-width:var(--eac-content-max);padding:0 var(--eac-s-3)}.eac-image img{display:block;width:100%;height:auto;border-radius:var(--eac-radius);background:var(--eac-surface-2)}.eac-image-caption{margin:var(--eac-s-1) 0 0;font-size:13px;color:var(--eac-text-soft)}",
      ".eac-divider{max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;border:0;border-top:1px solid var(--eac-border);height:0}",
      ".eac-quote{max-width:760px;margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3);font-family:var(--eac-font-serif);font-size:clamp(20px,2.4vw,28px);line-height:1.45;color:var(--eac-text);border-left:3px solid var(--eac-accent)}.eac-quote p{margin:0 0 var(--eac-s-2);padding-left:var(--eac-s-3)}.eac-quote-attr{padding-left:var(--eac-s-3);font-family:var(--eac-font-sans);font-size:14px;color:var(--eac-text-soft)}",
      ".eac-stats-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--eac-s-3);max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3)}.eac-stats-row[data-cols='2']{grid-template-columns:repeat(2,minmax(0,1fr))}.eac-stats-row[data-cols='4']{grid-template-columns:repeat(4,minmax(0,1fr))}.eac-stat{padding:var(--eac-s-3);border:1px solid var(--eac-border);border-radius:var(--eac-radius);background:var(--eac-surface);text-align:left}.eac-stat strong{display:block;font-family:var(--eac-font-serif);font-size:clamp(28px,3.6vw,44px);line-height:1.05;color:var(--eac-text)}.eac-stat span{display:block;margin-top:var(--eac-s-1);font-size:13px;color:var(--eac-text-soft);text-transform:uppercase;letter-spacing:.04em}",
      ".eac-faq{max-width:760px;margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3)}.eac-faq .eac-section-title{margin-bottom:var(--eac-s-2)}.eac-faq-item{border:1px solid var(--eac-border);border-radius:var(--eac-radius);background:var(--eac-surface);margin:var(--eac-s-1) 0;padding:0;overflow:hidden}.eac-faq-item summary{cursor:pointer;list-style:none;padding:var(--eac-s-2) var(--eac-s-3);font-weight:600;font-size:16px;color:var(--eac-text);position:relative}.eac-faq-item summary::-webkit-details-marker{display:none}.eac-faq-item summary:after{content:'+';position:absolute;right:var(--eac-s-3);top:50%;transform:translateY(-50%);font-size:20px;color:var(--eac-text-soft)}.eac-faq-item[open] summary:after{content:'–'}.eac-faq-item p{margin:0;padding:0 var(--eac-s-3) var(--eac-s-3);line-height:1.7;color:var(--eac-text-soft)}",
      ".eac-team-card{display:flex;gap:var(--eac-s-3);align-items:flex-start;padding:var(--eac-s-3);border:1px solid var(--eac-border-soft);border-radius:var(--eac-radius);background:var(--eac-surface)}.eac-team-photo{flex:0 0 96px;height:96px;border-radius:50%;background:var(--eac-surface-2);border:1px solid var(--eac-border-soft)}.eac-team-body{min-width:0}.eac-team-name{font-family:var(--eac-font-serif);font-size:22px;line-height:1.15;margin:0;color:var(--eac-text)}.eac-team-bio{margin:var(--eac-s-1) 0 0;line-height:1.6;color:var(--eac-text-soft)}",
      ".eac-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--eac-s-3);max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3)}.eac-team-grid .eac-team-card{flex-direction:column;align-items:flex-start}.eac-team-grid .eac-team-photo{flex:0 0 auto;width:100%;height:200px;border-radius:var(--eac-radius)}",
      ".eac-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--eac-s-1);max-width:var(--eac-content-max);margin:var(--eac-s-3) auto;padding:0 var(--eac-s-3)}.eac-gallery[data-cols='2']{grid-template-columns:repeat(2,minmax(0,1fr))}.eac-gallery[data-cols='4']{grid-template-columns:repeat(4,minmax(0,1fr))}.eac-gallery-item{margin:0;overflow:hidden;border-radius:var(--eac-radius);background:var(--eac-surface-2)}.eac-gallery-item img{display:block;width:100%;height:100%;aspect-ratio:1/1;object-fit:cover}",
      ".eac-video{max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3)}.eac-video-frame{position:relative;padding-top:56.25%;background:#000;border-radius:var(--eac-radius);overflow:hidden}.eac-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.eac-video-caption{margin:var(--eac-s-1) 0 0;font-size:13px;color:var(--eac-text-soft)}",
      ".eac-logo-wall{max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;padding:var(--eac-s-3);text-align:center}.eac-logo-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--eac-s-2);margin-top:var(--eac-s-2);align-items:center}.eac-logo{padding:var(--eac-s-2);border:1px dashed var(--eac-border);border-radius:var(--eac-radius);background:var(--eac-surface);color:var(--eac-text-soft);font-size:13px}",
      ".eac-schedule{max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3)}.eac-schedule-list{list-style:none;margin:var(--eac-s-2) 0 0;padding:0;border-top:1px solid var(--eac-border-soft)}.eac-schedule-item{display:grid;grid-template-columns:120px 1fr;gap:var(--eac-s-3);padding:var(--eac-s-3) 0;border-bottom:1px solid var(--eac-border-soft);align-items:start}.eac-schedule-time{font-family:var(--eac-font-serif);font-size:22px;color:var(--eac-accent-2);line-height:1}.eac-schedule-body h3{font-family:var(--eac-font-serif);font-size:20px;line-height:1.2;margin:0;color:var(--eac-text)}.eac-schedule-body p{margin:var(--eac-s-1) 0 0;color:var(--eac-text-soft);line-height:1.6}",
      ".eac-pricing{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--eac-s-3);max-width:var(--eac-content-max);margin:var(--eac-s-4) auto;padding:0 var(--eac-s-3)}.eac-pricing-tier{padding:var(--eac-s-3);border:1px solid var(--eac-border);border-radius:var(--eac-radius);background:var(--eac-surface);display:flex;flex-direction:column;gap:var(--eac-s-1)}.eac-pricing-tier[data-featured='true']{border-color:var(--eac-accent);box-shadow:0 0 0 1px var(--eac-accent) inset}.eac-pricing-name{font-family:var(--eac-font-serif);font-size:22px;line-height:1.15;margin:0;color:var(--eac-text)}.eac-pricing-amount{font-family:var(--eac-font-serif);font-size:30px;margin:0;color:var(--eac-text)}.eac-pricing-list{list-style:none;margin:var(--eac-s-2) 0;padding:0;color:var(--eac-text-soft);font-size:14px;line-height:1.7;flex:1}.eac-pricing-list li{padding:6px 0;border-bottom:1px solid var(--eac-border-soft)}.eac-pricing-tier .eac-button{margin-top:var(--eac-s-1)}",
      ".eac-footer{background:var(--eac-text);color:var(--eac-text-inv);padding:var(--eac-s-5) var(--eac-s-3) var(--eac-s-3)}.eac-footer[data-bg=accent]{background:var(--eac-accent)}.eac-footer[data-bg=surface]{background:var(--eac-surface);color:var(--eac-text)}.eac-footer-inner{max-width:var(--eac-content-max);margin:0 auto;display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:var(--eac-s-4)}.eac-footer-col{min-width:0}.eac-footer-title{font-family:var(--eac-font-serif);font-size:24px;line-height:1.15;margin:0;color:inherit}.eac-footer-copy{margin:var(--eac-s-1) 0 0;line-height:1.6;color:inherit;opacity:.78}.eac-footer-list{list-style:none;margin:0;padding:0}.eac-footer-list li{padding:4px 0}.eac-footer-list a{color:inherit;text-decoration:none;opacity:.85}.eac-footer-list a:hover{opacity:1}.eac-footer-base{max-width:var(--eac-content-max);margin:var(--eac-s-4) auto 0;padding-top:var(--eac-s-2);border-top:1px solid rgba(255,255,255,.18);display:flex;justify-content:space-between;font-size:13px;opacity:.7}",
      "@media(max-width:780px){.eac-stats-row,.eac-stats-row[data-cols='4'],.eac-team-grid,.eac-pricing,.eac-logo-row,.eac-footer-inner{grid-template-columns:1fr}.eac-gallery,.eac-gallery[data-cols='4']{grid-template-columns:repeat(2,minmax(0,1fr))}.eac-schedule-item{grid-template-columns:80px 1fr}}",
    ].join("");
    // Inject into project stylesheet so the published page picks it up.
    if (editor.CssComposer && editor.CssComposer.add) {
      try { editor.CssComposer.add(css); } catch (_err) {}
    }
    // Also inject directly into the canvas iframe so the editor preview
    // renders the grids/columns immediately, regardless of CssComposer state.
    function injectCanvasStyle() {
      try {
        var doc = editor.Canvas && typeof editor.Canvas.getDocument === "function"
          ? editor.Canvas.getDocument()
          : null;
        if (!doc || !doc.head) return false;
        if (doc.getElementById("eac-canvas-style")) return true;
        var style = doc.createElement("style");
        style.id = "eac-canvas-style";
        style.type = "text/css";
        style.appendChild(doc.createTextNode(css));
        doc.head.appendChild(style);
        return true;
      } catch (_err) {
        return false;
      }
    }
    if (!injectCanvasStyle()) {
      var tries = 0;
      var iv = window.setInterval(function () {
        tries += 1;
        if (injectCanvasStyle() || tries > 40) window.clearInterval(iv);
      }, 250);
    }
    if (editor.on) {
      editor.on("canvas:frame:load", injectCanvasStyle);
      editor.on("load", injectCanvasStyle);
    }
  }

  function registerComponentType(editor) {
    if (!editor.DomComponents || !editor.DomComponents.addType) return;
    editor.DomComponents.addType("eac-embed", {
      isComponent: function (el) {
        if (!el || !el.tagName) return false;
        return el.tagName.toLowerCase() === "eac-embed" || el.hasAttribute("data-eac-component");
      },
      model: {
        defaults: {
          tagName: "eac-embed",
          draggable: true,
          droppable: false,
          attributes: { "data-eac-component": "org-feed", "data-title": "Latest updates", "data-limit": "4" },
          traits: [
            {
              type: "select",
              name: "data-eac-component",
              label: "Component",
              options: [
                { id: "org-feed", name: "Org feed" },
                { id: "workshop-cards", name: "Workshop cards" },
                { id: "rsvp", name: "RSVP panel" },
                { id: "community-feed", name: "Network feed" },
                { id: "poll", name: "Poll" },
                { id: "countdown", name: "Countdown" },
                { id: "live", name: "Live room" },
                { id: "resources", name: "Resources" },
              ],
            },
            { type: "text", name: "data-title", label: "Title" },
            { type: "number", name: "data-limit", label: "Limit" },
            { type: "text", name: "data-question", label: "Question" },
            { type: "text", name: "data-options", label: "Options" },
            { type: "text", name: "data-items", label: "Items" },
          ],
        },
      },
    });
  }

  // Match a DOM element by class name (used for isComponent on structure/content types).
  function hasClass(el, name) {
    if (!el || !el.classList) return false;
    return el.classList.contains(name);
  }

  function registerStructureTypes(editor) {
    if (!editor.DomComponents || !editor.DomComponents.addType) return;
    var add = editor.DomComponents.addType.bind(editor.DomComponents);

    var bgOptions = [
      { id: "bg", name: "Page" },
      { id: "surface", name: "Surface" },
      { id: "surface-2", name: "Surface 2" },
      { id: "dark", name: "Dark" },
      { id: "accent", name: "Accent" },
    ];
    var padOptions = [
      { id: "sm", name: "Small" },
      { id: "md", name: "Medium" },
      { id: "lg", name: "Large" },
    ];
    var boolOptions = [
      { id: "false", name: "No" },
      { id: "true", name: "Yes" },
    ];

    add("eac-section", {
      isComponent: function (el) { return hasClass(el, "eac-section"); },
      model: { defaults: { name: "Section", traits: [
        { type: "select", name: "data-bg", label: "Background", options: bgOptions },
        { type: "select", name: "data-pad", label: "Padding", options: padOptions },
      ] } },
    });

    add("eac-hero", {
      isComponent: function (el) { return hasClass(el, "eac-hero"); },
      model: { defaults: { name: "Hero", traits: [
        { type: "select", name: "data-overlay", label: "Overlay", options: boolOptions },
      ] } },
    });

    add("eac-two-col", {
      isComponent: function (el) { return hasClass(el, "eac-two-col") && !hasClass(el, "eac-compound-grid"); },
      model: { defaults: { name: "Two Column" } },
    });

    add("eac-three-col", {
      isComponent: function (el) { return hasClass(el, "eac-three-col"); },
      model: { defaults: { name: "Three Column" } },
    });

    add("eac-feature-split", {
      isComponent: function (el) { return hasClass(el, "eac-feature-split"); },
      model: { defaults: { name: "Feature Split", traits: [
        { type: "select", name: "data-reverse", label: "Reverse", options: boolOptions },
      ] } },
    });

    add("eac-stack", {
      isComponent: function (el) { return hasClass(el, "eac-stack") && !hasClass(el, "eac-compound-stack"); },
      model: { defaults: { name: "Stack" } },
    });

    add("eac-cta-band", {
      isComponent: function (el) { return hasClass(el, "eac-cta-band"); },
      model: { defaults: { name: "CTA Band", traits: [
        { type: "select", name: "data-bg", label: "Background", options: bgOptions },
      ] } },
    });

    add("eac-footer", {
      isComponent: function (el) {
        if (!el || !el.tagName) return false;
        return el.tagName.toLowerCase() === "footer" && hasClass(el, "eac-footer");
      },
      model: { defaults: { name: "Footer", traits: [
        { type: "select", name: "data-bg", label: "Background", options: bgOptions },
      ] } },
    });

    add("eac-button", {
      isComponent: function (el) { return hasClass(el, "eac-button"); },
      model: { defaults: { name: "Button", traits: [
        { type: "text", name: "href", label: "Link" },
        { type: "select", name: "data-variant", label: "Variant", options: [
          { id: "solid", name: "Solid" },
          { id: "ghost", name: "Ghost" },
        ] },
      ] } },
    });

    add("eac-stats-row", {
      isComponent: function (el) { return hasClass(el, "eac-stats-row"); },
      model: { defaults: { name: "Stats Row", traits: [
        { type: "select", name: "data-cols", label: "Columns", options: [
          { id: "2", name: "Two" }, { id: "3", name: "Three" }, { id: "4", name: "Four" },
        ] },
      ] } },
    });

    add("eac-gallery", {
      isComponent: function (el) { return hasClass(el, "eac-gallery"); },
      model: { defaults: { name: "Gallery", traits: [
        { type: "select", name: "data-cols", label: "Columns", options: [
          { id: "2", name: "Two" }, { id: "3", name: "Three" }, { id: "4", name: "Four" },
        ] },
      ] } },
    });

    add("eac-pricing-tier", {
      isComponent: function (el) { return hasClass(el, "eac-pricing-tier"); },
      model: { defaults: { name: "Pricing Tier", traits: [
        { type: "select", name: "data-featured", label: "Featured", options: boolOptions },
      ] } },
    });

    add("eac-faq-item", {
      isComponent: function (el) {
        if (!el || !el.tagName) return false;
        return el.tagName.toLowerCase() === "details" && hasClass(el, "eac-faq-item");
      },
      model: { defaults: { name: "FAQ Item" } },
    });
  }

  function addCssToEditor(editor, css, styleId) {
    if (!css) return;
    if (editor.CssComposer && editor.CssComposer.add) {
      try { editor.CssComposer.add(css); } catch (_err) {}
    }

    function injectCanvasStyle() {
      try {
        var doc = editor.Canvas && typeof editor.Canvas.getDocument === "function"
          ? editor.Canvas.getDocument()
          : null;
        if (!doc || !doc.head) return false;
        if (doc.getElementById(styleId)) return true;
        var style = doc.createElement("style");
        style.id = styleId;
        style.type = "text/css";
        style.appendChild(doc.createTextNode(css));
        doc.head.appendChild(style);
        return true;
      } catch (_err) {
        return false;
      }
    }

    if (!injectCanvasStyle()) {
      var tries = 0;
      var iv = window.setInterval(function () {
        tries += 1;
        if (injectCanvasStyle() || tries > 40) window.clearInterval(iv);
      }, 250);
    }
    if (editor.on) {
      editor.on("canvas:frame:load", injectCanvasStyle);
      editor.on("load", injectCanvasStyle);
    }
  }

  function getWorkshopCss() {
    if (!workshopTemplate || !Array.isArray(workshopTemplate.sections)) return "";
    return [workshopTemplate.tokensCss || ""].concat(workshopTemplate.sections.map(function (section) {
      return section.cssContent || "";
    })).join("\n\n");
  }

  function getDossierCss() {
    if (!dossierTemplate || !Array.isArray(dossierTemplate.sections)) return "";
    return [dossierTemplate.tokensCss || ""].concat(dossierTemplate.sections.map(function (section) {
      return section.cssContent || "";
    })).join("\n\n");
  }

  function addWorkshopTemplateCss(editor) {
    addCssToEditor(editor, getWorkshopCss(), "eac-workshop-template-style");
    addCssToEditor(editor, getDossierCss(), "eac-dossier-template-style");
  }

  function registerWorkshopTypes(editor) {
    if (!workshopTemplate || !Array.isArray(workshopTemplate.sections)) return;
    if (!editor.DomComponents || !editor.DomComponents.addType) return;
    workshopTemplate.sections.forEach(function (section) {
      if (!section || !section.id) return;
      editor.DomComponents.addType(section.id, {
        isComponent: function (el) {
          if (!el) return false;
          if (el.getAttribute && el.getAttribute("data-gjs-type") === section.id) return true;
          return hasClass(el, section.id);
        },
        model: {
          defaults: {
            name: section.label || section.id,
            droppable: false,
            copyable: true,
            traits: (section.traits || []).map(function (trait) {
              return { type: "text", name: trait, label: String(trait).replace(/([A-Z])/g, " $1") };
            }),
          },
        },
      });
    });
  }

  function addWorkshopBlocks(editor) {
    if (!workshopTemplate || !Array.isArray(workshopTemplate.sections)) return;
    if (!editor.BlockManager || !editor.BlockManager.add) return;

    var pageBlockId = "eac-template-workshop-page";
    if (!editor.BlockManager.get || !editor.BlockManager.get(pageBlockId)) {
      var pageContent = workshopTemplate.sections
        .filter(function (section) { return section.defaultVisible !== false; })
        .map(function (section) { return section.htmlContent || ""; })
        .join("\n");

      editor.BlockManager.add(pageBlockId, {
        label: "Workshop page",
        category: WORKSHOP_CATEGORY,
        content: pageContent,
      });
    }

    workshopTemplate.sections.forEach(function (section) {
      if (!section || !section.id || !section.htmlContent) return;
      var blockId = section.id + "--block";
      if (editor.BlockManager.get && editor.BlockManager.get(blockId)) return;
      editor.BlockManager.add(blockId, {
        label: section.label || section.id,
        category: WORKSHOP_CATEGORY,
        content: section.htmlContent,
      });
    });
  }

  function addBlocks(editor, blocks, category) {
    if (!editor.BlockManager || !editor.BlockManager.add) return;
    blocks.forEach(function (block) {
      if (editor.BlockManager.get && editor.BlockManager.get(block.id)) return;
      editor.BlockManager.add(block.id, {
        label: block.label,
        category: category,
        content: block.content,
      });
    });
  }

  function openBlocksPanel(editor) {
    if (!SIMPLE_MODE) return;
    try {
      if (editor.Panels && editor.Panels.getButton) {
        var button = editor.Panels.getButton("views", "open-blocks");
        if (button && button.set) button.set("active", true);
      }
    } catch (err) {
      console.warn("[eac-silex-blocks] could not open blocks panel", err);
    }
  }

  function getBlockCount(editor) {
    if (!editor || !editor.BlockManager) return 0;
    if (editor.BlockManager.getAll) {
      var all = editor.BlockManager.getAll();
      if (all && typeof all.length === "number") return all.length;
    }
    return 0;
  }

  function install(editor) {
    if (!editor || editor.__eacBlocksInstalled) return;
    editor.__eacBlocksInstalled = true;
    registerComponentType(editor);
    registerStructureTypes(editor);
    registerWorkshopTypes(editor);
    addEditorCss(editor);
    addWorkshopTemplateCss(editor);
    addBlocks(editor, liveSlotBlocks, SLOT_CATEGORY);
    addBlocks(editor, structureBlocks, LAYOUT_CATEGORY);
    addBlocks(editor, contentBlocks, CONTENT_CATEGORY);
    addBlocks(editor, templateBlocks, TEMPLATE_CATEGORY);
    addWorkshopBlocks(editor);
    window.__eacSilexEditor = editor;
    console.info("[eac-silex-blocks] installed", {
      blocks: getBlockCount(editor),
      categories: [LAYOUT_CATEGORY, CONTENT_CATEGORY, TEMPLATE_CATEGORY, WORKSHOP_CATEGORY, SLOT_CATEGORY],
    });
    window.setTimeout(function () {
      openBlocksPanel(editor);
    }, 500);
    if (editor.on) {
      editor.on("load", function () {
        addBlocks(editor, liveSlotBlocks, SLOT_CATEGORY);
        addBlocks(editor, structureBlocks, LAYOUT_CATEGORY);
        addBlocks(editor, contentBlocks, CONTENT_CATEGORY);
        addBlocks(editor, templateBlocks, TEMPLATE_CATEGORY);
        addWorkshopBlocks(editor);
        window.setTimeout(function () {
          openBlocksPanel(editor);
        }, 250);
      });
    }
  }

  function patchGrapesjs(grapesjs) {
    if (!grapesjs || grapesjs.__eacBlocksPatched || !grapesjs.init) return;
    grapesjs.__eacBlocksPatched = true;
    var originalInit = grapesjs.init.bind(grapesjs);
    grapesjs.init = function initWithEacBlocks() {
      var editor = originalInit.apply(grapesjs, arguments);
      install(editor);
      return editor;
    };
  }

  function getEditorFromEvent(eventOrPayload) {
    if (!eventOrPayload) return null;
    if (eventOrPayload.editor) return eventOrPayload.editor;
    if (eventOrPayload.detail && eventOrPayload.detail.editor) return eventOrPayload.detail.editor;
    return null;
  }

  function scanKnownGlobals() {
    if (window.grapesjs) patchGrapesjs(window.grapesjs);
    var candidates = [
      window.editor,
      window.grapesjsEditor,
      window.__eacSilexEditor,
      window.silex && window.silex.editor,
      window.silex && window.silex.grapesjsEditor,
    ];
    if (window.silex && typeof window.silex.getEditor === "function") {
      try {
        candidates.push(window.silex.getEditor());
      } catch (_err) {}
    }
    candidates.forEach(function (value) {
      if (value && value.BlockManager && value.DomComponents) install(value);
    });
  }

  function listen(target, eventName, handler) {
    if (!target) return;
    var flag = "__eacSilexBlocksListening_" + eventName.replace(/[^a-z0-9]/gi, "_");
    if (target[flag]) return;
    target[flag] = true;
    if (target.addEventListener) {
      target.addEventListener(eventName, handler);
      return;
    }
    if (target.on) target.on(eventName, handler);
  }

  function installFromSilexEvent(eventOrPayload) {
    var editor = getEditorFromEvent(eventOrPayload);
    if (editor) install(editor);
  }

  function attachSilexEvents() {
    listen(window, "silex:grapesjs:end", installFromSilexEvent);
    listen(document, "silex:grapesjs:end", installFromSilexEvent);
    listen(window.silex, "silex:grapesjs:end", installFromSilexEvent);
  }

  window.__eacSilexBlocks = {
    install: install,
    scan: scanKnownGlobals,
    status: function () {
      return {
        editorFound: Boolean(window.__eacSilexEditor),
        installed: Boolean(window.__eacSilexEditor && window.__eacSilexEditor.__eacBlocksInstalled),
        blockCount: getBlockCount(window.__eacSilexEditor),
      };
    },
  };

  var currentGrapesjs = window.grapesjs;
  if (currentGrapesjs) patchGrapesjs(currentGrapesjs);
  try {
    Object.defineProperty(window, "grapesjs", {
      configurable: true,
      get: function () {
        return currentGrapesjs;
      },
      set: function (value) {
        currentGrapesjs = value;
        patchGrapesjs(value);
      },
    });
  } catch (_err) {
    // If Silex has already locked the property, polling still catches the editor.
  }

  attachSilexEvents();
  scanKnownGlobals();
  var attempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;
    attachSilexEvents();
    scanKnownGlobals();
    if (attempts > 80) window.clearInterval(timer);
  }, 250);
})();
