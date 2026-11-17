# Atlas drift

Generated from inventory of 2026-11-17. Do not edit; regenerate with `pnpm --filter @elkdonis/actions atlas:reports`.

Drift is recorded, not fixed. Merging to a `canonical` path is a separate, approved pass.

## Homogenising worklist: one section per canonical target

After consolidation 2 one capability = one row with every host across apps. Sections are grouped by the `canonical` path the hosts should converge on, widest first (apps, then hosts). "Differences" are the per-app notes the merge folded into the row's `drift`. Only groups that span two or more apps or two or more rows are listed.

| canonical target | apps | hosts | rows | service variants |
|---|--:|--:|--:|--:|
| auth-server handleSignup (already shared); keep one route per app, no custom copies | 17 | 17 | 1 | 2 |
| services updateProfile + ensureUniqueUserSlug behind one shared kit action; add URL/media- | 8 | 12 | 1 | 7 |
| a services setProfileSection(userId, key, on) that owns the SQL and the allowed-key list;  | 7 | 20 | 1 | 6 |
| one shared handler in @elkdonis/services (rsvpHandlers, like connectionsHandlers) that eac | 7 | 12 | 2 | 10 |
| one shared action in the planned org-site kit: gate getApiEditor, services/page-builder sa | 7 | 11 | 1 | 11 |
| checkout startPayoutsFor, with origin resolved by publicOriginFrom in every host; one kit  | 7 | 9 | 1 | 4 |
| services savePostContent via one shared org-site kit action; membersMayPost and href/reval | 7 | 8 | 1 | 4 |
| checkout disconnectPayoutsFor via one kit action. | 7 | 7 | 1 | 4 |
| packages/pipeline createPipelineApi + services org-deck (already shared) | 6 | 86 | 15 | 32 |
| services saveMeetingContent / savePostContent (what the hub compose pop-ups already use) b | 6 | 23 | 1 | 12 |
| packages/chat createChatApi | 6 | 8 | 2 | 3 |
| services createWritingPost (+updateWritingPost) behind one shared desk action in the org-s | 6 | 8 | 1 | 5 |
| one post-creation service (createThread) | 6 | 7 | 2 | 4 |
| one upload route in services with a per-app policy object (types, sizes, who) | 6 | 7 | 2 | 6 |
| services saveMeetingContent behind one shared 'use server' action in the planned org-site  | 6 | 7 | 1 | 3 |
| services updateWritingPost + canEditProfile behind one shared desk action. | 6 | 7 | 1 | 7 |
| packages/chat createChatApi (already shared) | 6 | 6 | 1 | 2 |
| services assignOrgDocument | 6 | 6 | 1 | 3 |
| services createOrgDocument (already shared); route is a thin mount | 6 | 6 | 1 | 3 |
| services createOrgQuestionnaire behind a single shared org-site kit action that does viewe | 6 | 6 | 1 | 3 |
| services deleteWritingPost behind one shared desk action. | 6 | 6 | 1 | 4 |
| services saveWhiteboard | 6 | 6 | 1 | 2 |
| the shared rsvp handler | 6 | 6 | 2 | 2 |
| a services setThreadStatus(org, id, status) used by one kit action; the same function shou | 5 | 10 | 1 | 2 |
| the site-section-save hub entry (SiteBuilderAdapter) as the one write, with a services sav | 5 | 10 | 1 | 4 |
| commerce createArtwork/updateArtwork/setArtworkMedia with katie's validation (image path r | 5 | 9 | 1 | 7 |
| services setThreadListings behind the shared desk action. | 5 | 7 | 1 | 4 |
| services createOrgIdea | 5 | 5 | 1 | 3 |
| services removeThreadAs with the org check moved inside (an org id parameter), behind one  | 5 | 5 | 1 | 1 |
| services saveCenterLayout behind one shared route (already a service); keep per-app auth o | 5 | 5 | 1 | 2 |
| One org-site kit action: getApiEditor + services saveSiteTheme + a services saveSiteChrome | 4 | 8 | 1 | 2 |
| one shared guest RSVP handler in services with rate limit and email validation | 4 | 8 | 1 | 6 |
| auth-server login handler (shared); decide whether sign-in should ever join an org (signup | 4 | 5 | 1 | 4 |
| packages/forum-ui handleForumAction with phone routes calling the same connectors | 4 | 5 | 1 | 3 |
| One kit action over startBookingCheckout (booking module, offer-driven) for every site; st | 4 | 4 | 1 | 3 |
| a shared cycle-event handler in services | 4 | 4 | 1 | 3 |
| a shared trigger-email handler in services | 4 | 4 | 1 | 3 |
| commerce setPayoutIdentity with the country/rail/email validation (including the email reg | 4 | 4 | 1 | 1 |
| packages/chat createChatApi. | 4 | 4 | 1 | 2 |
| packages/pipeline createPipelineApi routes mounted once (already the shape); remove the pe | 4 | 4 | 1 | 3 |
| services defineTerm via one shared org-site kit action using requireOrgMember. | 4 | 4 | 1 | 1 |
| services saveOffering via one kit action; currency from site config. | 4 | 4 | 1 | 3 |
| services setMeetingAttendance behind one shared attendance route. | 4 | 4 | 1 | 3 |
| services setOfferingStatus via the kit. | 4 | 4 | 1 | 3 |
| services setOrgPersonRole behind the one kit action already shared with the hub Members ca | 4 | 4 | 1 | 1 |
| services setStandingMeeting (add the org check inside) behind a kit action. | 4 | 4 | 1 | 1 |
| services submitQuote | 4 | 4 | 1 | 2 |
| services updateProfile + upsertOrgProfile in one services saveGuidePage, one kit action. | 4 | 4 | 1 | 1 |
| services upsertOrgFeed behind one kit action. | 4 | 4 | 1 | 1 |
| services connectionsHandlers (already shared) | 3 | 12 | 2 | 2 |
| a shared email-template-settings module in services (the file is copied per app) | 3 | 8 | 1 | 4 |
| site_themes via services saveSiteTheme (the site-style-save path); danamccool migrates its | 3 | 7 | 1 | 6 |
| one shared inquiry handler in services | 3 | 6 | 1 | 4 |
| page-builder deletePage(orgId, slug) plus a one-step undo (keep the last version), behind  | 3 | 6 | 1 | 2 |
| services setThreadReminder behind one shared route | 3 | 6 | 1 | 4 |
| services sitePortfolioRoutes (already shared); mount only | 3 | 6 | 2 | 3 |
| packages/actions server/channel.ts acceptSuggestion, called by all three actions | 3 | 5 | 1 | 2 |
| services setOrgPersonRole (actor check inside services) via one kit action; also mounted i | 3 | 5 | 1 | 4 |
| slot-actions updateSlot on the booking tables. | 3 | 5 | 1 | 4 |
| booking tables cancelSlot, with the refund-due list. | 3 | 4 | 1 | 4 |
| services createOrganizationForUser through the existing registry door, so the dock runs on | 3 | 4 | 1 | 3 |
| services setOrgPersonListed via the kit (and the hub Members card). | 3 | 4 | 1 | 3 |
| slot-actions createSlots on the booking tables; retire addDeparturesAction at the cutover. | 3 | 4 | 1 | 4 |
| @elkdonis/newsletter saveNewsletter behind one route mount. | 3 | 3 | 1 | 3 |
| @elkdonis/newsletter sendNewsletter. | 3 | 3 | 1 | 2 |
| commerce publishArtwork (ownership inside) via one kit action; marketplace URL from siteCo | 3 | 3 | 1 | 2 |
| commerce publishStoreForAuction with displayName resolved inside commerce; one shared kit  | 3 | 3 | 1 | 2 |
| katie's gate (store, manager, method matches) inside a single confirmOrderPaid wrapper. | 3 | 3 | 1 | 3 |
| one shared reminder tick in services, called by each app instrumentation | 3 | 3 | 1 | 2 |
| packages/actions server/channel.ts dismissSuggestion | 3 | 3 | 1 | 2 |
| packages/actions server/channel.ts planStep | 3 | 3 | 1 | 2 |
| packages/actions server/channel.ts saveDeliveryDraft, with scheduling as a separate entry | 3 | 3 | 2 | 2 |
| packages/forum-ui handleForumAction (already shared). | 3 | 3 | 1 | 3 |
| planPiece with a no-proposals option | 3 | 3 | 1 | 2 |
| saveOrgEmailIdentity | 3 | 3 | 1 | 3 |
| services uploadOrgFile with validateUploadBuffer | 3 | 3 | 2 | 2 |
| one /api/meta/* pair, with Instagram and Threads callback URLs pointed at it in the Meta a | 2 | 9 | 1 | 3 |
| handleForumAction | 2 | 8 | 2 | 1 |
| one kit saveGalleryItems(galleryId, items) over services updateUserGallery with url valida | 2 | 8 | 1 | 3 |
| commerce createOrderFromCart / createOrder as the single order maker; one kit checkout act | 2 | 6 | 1 | 5 |
| @elkdonis/astro-corpus/server#recordReview | 2 | 5 | 3 | 4 |
| commerce payee functions via the shared hub Business card. | 2 | 5 | 2 | 5 |
| a services setProfileSection(userId, key, on) with an allow-list of keys (see profile-sect | 2 | 4 | 1 | 3 |
| commerce addToCart via one kit action. | 2 | 4 | 1 | 2 |
| createBooking / startBookingCheckout of packages/booking and packages/checkout, as the sin | 2 | 4 | 1 | 3 |
| one kit action over services updateUserGallery with a patch object, gate by gallery owners | 2 | 4 | 1 | 3 |
| packages/auth-server handlers mounted once per app (already shared). | 2 | 4 | 1 | 3 |
| services pinThread(org, id, on) behind the kit action; one pin concept for the network (th | 2 | 4 | 1 | 2 |
| services updateProfile with url validation inside, behind the edit-my-profile kit action;  | 2 | 4 | 1 | 3 |
| startBookingCheckout on the booking tables. | 2 | 4 | 1 | 4 |
| commerce addStoreMemberByEmail / removeStoreMember with canManageStoreTeam inside both. | 2 | 3 | 2 | 3 |
| packages/booking cancelAs with refund-due, then a single approved refund action. | 2 | 3 | 1 | 3 |
| packages/booking hostConfirmTime / bookerConfirmTime behind one kit action per side. | 2 | 3 | 1 | 3 |
| packages/booking proposeAs behind one kit action. | 2 | 3 | 1 | 3 |
| services createUserGallery behind one kit action taking {ownerResolver, origin, defaults}; | 2 | 3 | 1 | 2 |
| services saveBookingOffer behind a Studio section (design section 2). | 2 | 3 | 1 | 3 |
| services uploadUserFile with validateUploadBuffer and a per-app authorizer. | 2 | 3 | 2 | 3 |
| services upsertWorkshopOffering plus the autosave guard moved into services (as meeting an | 2 | 3 | 1 | 3 |
| the booking module with a capacity-locked createBooking, or services RSVP + startThreadChe | 2 | 3 | 1 | 3 |
| @elkdonis/newsletter deleteNewsletter. | 2 | 2 | 1 | 1 |
| auth-server logout handler (shared) | 2 | 2 | 1 | 1 |
| clearOrgTemplate behind the same shared kit route as save-email-template | 2 | 2 | 1 | 2 |
| commerce chooseOrderShipping. | 2 | 2 | 1 | 2 |
| commerce openOrgStore via a shared hub Business card action when other orgs get stores. | 2 | 2 | 2 | 2 |
| commerce removeCartLine with the ownership check moved inside. | 2 | 2 | 1 | 2 |
| createDeletionRequestHandler (shared); mount only | 2 | 2 | 1 | 2 |
| one shared kit route for the email suite | 2 | 2 | 1 | 2 |
| packages/actions server/channel.ts fillSlot | 2 | 2 | 1 | 1 |
| page-builder saveUserPage | 2 | 2 | 2 | 2 |
| services assignMeetingRole behind one shared kit route | 2 | 2 | 1 | 2 |
| services clearMeetingLight behind one shared kit route | 2 | 2 | 1 | 2 |
| services clearMeetingRole behind one shared kit route | 2 | 2 | 1 | 2 |
| services createCategory via handleForumAction | 2 | 2 | 1 | 1 |
| services createSiteSeries behind the shared org-site kit action; zones from siteConfig. | 2 | 2 | 1 | 1 |
| services createThread (createPostAnywhere should call it) | 2 | 2 | 1 | 2 |
| services deleteUserGallery behind the kit action. | 2 | 2 | 1 | 2 |
| services proposeTopic via handleForumAction | 2 | 2 | 1 | 1 |
| services removeThread via handleForumAction | 2 | 2 | 1 | 1 |
| services saveOccurrenceRecord behind one shared kit route | 2 | 2 | 1 | 2 |
| services saveUserTheme via the kit. | 2 | 2 | 1 | 2 |
| services setMeetingLight / isOccurrenceHost behind one shared kit route | 2 | 2 | 1 | 2 |
| services setOccurrencePlan behind one shared kit route | 2 | 2 | 1 | 2 |
| services setPresence | 2 | 2 | 1 | 2 |
| setOrgPortfolio (per org) behind one kit action; the global portfolio is the fallback when | 2 | 2 | 1 | 2 |
| the page-save kit action with slug = LANDING_SLUG. | 2 | 2 | 1 | 2 |
| packages/lms-ui handleLmsAction (already shared) | 1 | 29 | 5 | 29 |
| one shared reading-circle kit action set in services (reading-circle.ts is already the ser | 1 | 27 | 22 | 26 |
| lib/paath.ts functions as the single path; move them into services reading-circle once a s | 1 | 12 | 7 | 9 |
| extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) wi | 1 | 6 | 3 | 5 |
| packages/actions performHubAction (the registry door) | 1 | 6 | 6 | 1 |
| one experience writer in services with an artist and an office entry | 1 | 4 | 2 | 3 |
| services artistProfile module | 1 | 4 | 2 | 2 |
| services handleUserProvisioning | 1 | 4 | 2 | 2 |
| @elkdonis/page-builder/server#savePage | 1 | 3 | 2 | 3 |
| @elkdonis/services#reviewThread | 1 | 3 | 2 | 3 |
| commerce/server booking functions, with one action file per host | 1 | 3 | 3 | 3 |
| one server action over services setOrgRole/removeOrgMember that takes an org id and checks | 1 | 3 | 3 | 2 |
| one shared upload route in services with a policy per role | 1 | 3 | 2 | 3 |
| services reviewListing | 1 | 2 | 2 | 1 |
| (no canonical recorded) | 24 | 684 | 338 | 392 |

### auth-server handleSignup (already shared); keep one route per app, no custom copies

- apps (17): amrit-canada, art-auction, artdirect, arts-collective, blog-guru-dharam, blog-tester, danamccool, elastrocal, elkdonis-arts-collective, elktours, fourthwayBookreaders, hidden-enneagram, ifac, innergathering, katie-the-potter, pigeonshoot, sunjay
- hosts: 17; rows: 1; distinct service sets: 2

#### create-account (arts-collective.network): Create an account

17 app(s), 17 host(s): amrit-canada, art-auction, artdirect, arts-collective, blog-guru-dharam, blog-tester, danamccool, elastrocal, elkdonis-arts-collective, elktours, fourthwayBookreaders, hidden-enneagram, ifac, innergathering, katie-the-potter, pigeonshoot, sunjay.

Differences:

- admin (was admin-signup): no defaultOrgs (inner_group viewer), and it marks every contact for that email joined and linked.
- amrit-canada (was amrit-signup): wraps handleSignup with defaultOrgs [{ org: amrit-canada, role: viewer }] (the arts-collective copy takes the shared default, the network orgs). Same file in sunjay (apps.sunjay.*.ts: create-account); identical except a comment line.
- blog-guru-dharam (was blog-guru-dharam-signup-create): none (bare wrapper around handleSignup, so the new account joins inner_group, not the blog’s own org).
- blog-tester (was blog-tester-signup-create): none (bare wrapper around handleSignup, so the new account joins inner_group, not the blog’s own org).
- elkdonis-arts-collective (was eac-site-signup-create): none (bare wrapper around handleSignup, default orgs).
- elktours (was elktours-signup-create): wraps handleSignup with defaultOrgs [{ elktours, viewer }] (the shared default joins the network orgs); elktours explains why it cannot re-export the bare handler.
- fourthwayBookreaders (was fourthway-signup): defaultOrgs viewer for this org. Same as create-account and amrit-signup.
- innergathering (was ig-signup-create): this app passes defaultOrgs [{ id: orgId, role: viewer }] so a new person follows inner_group at once, arts-collective passes defaultOrgs [] (no membership, developer decision 2026-10-29). The code comment in this route still says "scoping to amrit_canada" (copy-paste, the code uses siteConfig.orgId).
- katie-the-potter (was katie-signup): same as sunjay-signup. The route comment still says "member here" but the code passes viewer (stale comment).
- sunjay (was sunjay-signup): wraps handleSignup with defaultOrgs [{ org: sunjay, role: viewer }] (the arts-collective copy takes the shared default, the network orgs). Same file in amrit-canada (apps.amrit-canada.*.ts: create-account); identical except a comment line.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services updateProfile + ensureUniqueUserSlug behind one shared kit action; add URL/media-path validation for photoUrl.

- apps (8): amrit-canada, arts-collective, elastrocal, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 12; rows: 1; distinct service sets: 7

#### edit-my-profile (arts-collective.hub): Edit my profile

8 app(s), 12 host(s): amrit-canada, arts-collective, elastrocal, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- sunjay (was profile-update-own): Four byte-identical copies (differ only in the console.error prefix). Self-only by construction. photoUrl is trimmed but not validated as a URL or as one of our media paths (any string is stored as avatarUrl). ifac and arts-collective have separate profile editors (ifac lib/profile-editor-actions.ts is not mapped here).
- amrit-canada (was amrit-profile-edit): no saveProfileDetails (page address, comment colour, details), the ?org= target is only this site's org, and the identity page link goes through ARTDIRECT_URL. Both accept any http(s) avatarUrl. Same file in sunjay (apps.sunjay.*.ts: edit-my-profile); byte-identical bar log prefixes.
- elastrocal (was elastrocal-profile-save): the org listing half is the same upsertOrgProfile call as orgapps.cms:guide-profile-save; differs: one action writes both halves, and any membership may publish the listing (the others require owner or guide).
- elktours (was elktours-center-profile-save): this is the 125-line copy without the target-identity extras of arts-collective, ifac and innergathering; avatarUrl is validated (/api/media/ or http(s)) here, which edit-my-profile lacks.
- ifac (was ifac-profile-edit): avatarUrl must be /api/media/ or http(s); links must be http(s) (12 max); no slug change.
- hidden-enneagram (was he-profile-edit): the write is still gated by canEditOrgIdentity(viewer, org), so another org owner can edit their own org identity through this site.
- innergathering (was ig-profile-save): only the session helper (getViewer vs getCurrentUser) and an unconditional dynamic import of the db; the validation body is the same (name required, 12 links with http(s) only, avatarUrl must be /api/media/ or http(s)).
- sunjay (was sunjay-profile-edit): no saveProfileDetails (page address, comment colour, details), the ?org= target is only this site's org, and the identity page link goes through ARTDIRECT_URL. Both accept any http(s) avatarUrl. Same file in amrit-canada (apps.amrit-canada.*.ts: edit-my-profile); byte-identical bar log prefixes.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.
> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.
> Direction (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.

### a services setProfileSection(userId, key, on) that owns the SQL and the allowed-key list; one kit action.

- apps (7): amrit-canada, artdirect, arts-collective, elktours, ifac, innergathering, sunjay
- hosts: 20; rows: 1; distinct service sets: 6

#### profile-section-toggle (orgapps.people): Switch a section of my page on or off

7 app(s), 20 host(s): amrit-canada, artdirect, arts-collective, elktours, ifac, innergathering, sunjay.

Differences:

- arts-collective (was set-profile-section): Same switches as hub set-where-i-show (services setPresence, row x column) but written by raw SQL here.
- innergathering (was profile-section-toggle-more): Same concept as profile-section-toggle in orgapps.people (sunjay, amrit-canada, elktours, ifac): a merged jsonb UPDATE with an allow-list. This file holds the copies that file did not claim: innergathering's generic and store-only versions (the store-only one is a narrower copy of the generic one in the same file), and artdirect's. innergathering revalidates /hub and /artists/<slug>; the store version only /hub.
- ifac (was ifac-profile-sections-set): profile-blog-set / profile-section-toggle (artdirect). Here an allow-list of four keys, own row only (WHERE id = viewer.userId). Raw SQL, not services setProfileSection.
- artdirect (was artdirect-profile-section-set): A second copy in artdirect: lib/profile-editor-actions.ts setProfileSectionAction (claimed by orgapps.content profile-section-toggle) does the same write from another editor. Also the same family as ifac-profile-sections-set.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### one shared handler in @elkdonis/services (rsvpHandlers, like connectionsHandlers) that each app mounts

- apps (7): amrit-canada, arts-collective, elktours, fourthwayBookreaders, ifac, innergathering, sunjay
- hosts: 12; rows: 2; distinct service sets: 10

#### ig-rsvp-join (apps.innergathering.gatherings): Join a gathering

1 app(s), 2 host(s): innergathering.

Curator note: copy of arts-collective.sites.ts:rsvp-to-event; differs: this one is 287 lines against 149. Extras here: a paid branch (createThreadOrder + startStripeCheckout), workshop materials sharing (shareWorkshopMaterials), a min-attendees nudge to the author, and every query filtered by org_id and status published. arts-collective checks eligibility and syncs Nextcloud materials.

#### rsvp-to-event (arts-collective.sites): RSVP to an event or join a workshop

6 app(s), 10 host(s): amrit-canada, arts-collective, elktours, fourthwayBookreaders, ifac, sunjay.

Differences:

- amrit-canada (was amrit-rsvp-join): differs as in sunjay-rsvp-join. Same file in sunjay (apps.sunjay.*.ts: rsvp-to-event); differs only in EMBLEM_URL (amrit hard-codes its khanda-gold.png, sunjay has none) and log prefixes.
- elktours (was elktours-rsvp-join): this copy does not sync Nextcloud materials, adds the min-attendees notice, and the confirmation uses the Khanda emblem with an amritcanada.ca image fallback; the loadThread helper filters by org and status published.
- fourthwayBookreaders (was fourthway-rsvp-join): org-scoped published-thread check (route.ts:21-27), no email, no workshop or Nextcloud sync, and joining a reading group inserts a viewer row with raw SQL (the other copies never change a role).
- sunjay (was sunjay-rsvp-join): pure thread-of-this-org lookup (route.ts:39-55, status published), no workshop or Nextcloud materials sync, no paid refusal, sends confirmation and owner emails, one-shot min-attendees nudge. Any signed-in person may RSVP (no role needed); a non-affiliate does not become a follower. Email emblem: sunjay uses env SUNJAY_EMAIL_EMBLEM_URL (none by default) but still passes emblemAlt "Khanda" (route.ts:150). Same file in amrit-canada (apps.amrit-canada.*.ts: rsvp-to-event); differs only in EMBLEM_URL (amrit hard-codes https://amritcanada.ca/email/khanda-gold.png) and log prefixes.
- ifac (was ifac-rsvp-set): no Nextcloud material sync.

> Direction (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).
> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.
> Kept separate on purpose (a paid branch and a different risk): ig-rsvp-join and ig-rsvp-cancel (innergathering, paid places, workshop materials); the guest door is sunjay-rsvp-guest (visitor, no account).

### one shared action in the planned org-site kit: gate getApiEditor, services/page-builder savePageContent that does cleanBoxDoc + stripResolved(config RESOLVED_KEYS) + reserved-slug and feed check (hooks per app), then savePage and revalidate by a per-app route map.

- apps (7): art-auction, danamccool, elktours, hidden-enneagram, innergathering, katie-the-potter, sunjay
- hosts: 11; rows: 1; distinct service sets: 11

#### page-save (orgapps.editing): Publish a page from the visual editor

7 app(s), 11 host(s): art-auction, danamccool, elktours, hidden-enneagram, innergathering, katie-the-potter, sunjay.

Differences:

- elktours (was elktours-experience-page-save): Puck page save for tours goes through savePage in publishTourLayoutAction; experiences write metadata.page directly.
- elktours (was mobile-page-save): Single copy (elktours); same shape as page-save restricted to isMobileKey; revalidates the mapped path.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### checkout startPayoutsFor, with origin resolved by publicOriginFrom in every host; one kit action.

- apps (7): art-auction, arts-collective, elktours, ifac, innergathering, katie-the-potter, sunjay
- hosts: 9; rows: 1; distinct service sets: 4

#### payout-stripe-start (orgapps.money): Connect Stripe to get paid

7 app(s), 9 host(s): art-auction, arts-collective, elktours, ifac, innergathering, katie-the-potter, sunjay.

Differences:

- arts-collective (was start-payouts): no drift recorded
- innergathering (was payout-stripe-start-center): Same call as payout-stripe-start in orgapps.money (checkout startPayoutsFor); that file has the sunjay, elktours, katie and ifac copies, this innergathering one sits in blog-actions.ts and was missed. Same localhost fallback as ifac (localhost:3015 here).
- art-auction (was market-payout-stripe-start): Same as payout-stripe-start (orgapps.money).

### services savePostContent via one shared org-site kit action; membersMayPost and href/revalidate supplied from the per-site config.

- apps (7): amrit-canada, arts-collective, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 8; rows: 1; distinct service sets: 4

#### create-content (arts-collective.hub): Create a post, event, meeting or workshop

7 app(s), 8 host(s): amrit-canada, arts-collective, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- sunjay (was post-save): Five copies, two shapes. amrit-canada and elktours are identical logic. sunjay's file is separate (post-actions.ts) and its context action requires viewer.canEdit with the message 'Only an owner or guide of this site can post here'. ifac is the odd one: ANY member (not only owner/guide) may post (membersMayPost:true, owner's call 2026-09-19), canSetVisibility only for editors, href via threadHref, revalidates /hub,/,/forum. innergathering adds workshop in the same file and starts members-only. In all five the action-layer gate for SAVE is 'signed in' only; services savePostContent enforces owner/guide (or members when membersMayPost) with 'Only an owner or guide of this organisation can post here'.
- hidden-enneagram (was he-post-save): hidden-enneagram has its own lib/forms/actions.ts holding post and service forms in one file. Action layer needs only a session (no canEdit); who may post is decided in services savePostContent.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### checkout disconnectPayoutsFor via one kit action.

- apps (7): art-auction, arts-collective, elktours, ifac, innergathering, katie-the-potter, sunjay
- hosts: 7; rows: 1; distinct service sets: 4

#### payout-disconnect (orgapps.money): Disconnect my payout account

7 app(s), 7 host(s): art-auction, arts-collective, elktours, ifac, innergathering, katie-the-potter, sunjay.

Differences:

- arts-collective (was disconnect-payouts): no drift recorded
- innergathering (was payout-disconnect-center): Same as payout-disconnect in orgapps.money (sunjay, elktours, katie, ifac); innergathering copy missed there. No revalidatePath.
- art-auction (was market-payout-disconnect): Same as payout-disconnect (orgapps.money).

### packages/pipeline createPipelineApi + services org-deck (already shared)

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 86; rows: 15; distinct service sets: 32

#### sunjay-pipeline-attachment-add (apps.sunjay.pipeline): Attach a file to a pipeline card

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-attachment-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-attachment-add); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-attachment-add): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-attachment-add): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-attachment-add): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-file-add): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-attachment-delete (apps.sunjay.pipeline): Remove a pipeline attachment

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-attachment-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-attachment-delete); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-attachment-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-attachment-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-attachment-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-file-remove): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-board-create (apps.sunjay.pipeline): Set up the pipeline board

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-board-create): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-board-create); byte-identical bar log prefixes.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-add (apps.sunjay.pipeline): Add a pipeline card

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-add); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-card-create): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-card-create): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-card-create): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-card-add): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-assign (apps.sunjay.pipeline): Assign a pipeline card

3 app(s), 3 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-assign): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-assign); byte-identical bar log prefixes.
- elktours (was elktours-pipeline-card-assign): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-delete (apps.sunjay.pipeline): Delete a pipeline card

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-delete); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-card-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-card-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-card-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-card-delete): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-edit (apps.sunjay.pipeline): Edit a pipeline card

6 app(s), 12 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-edit): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-edit); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-card-edit): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-card-edit): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-card-edit): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-card-edit): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-label (apps.sunjay.pipeline): Label a pipeline card

3 app(s), 3 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-label): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-label); byte-identical bar log prefixes.
- elktours (was elktours-pipeline-card-label): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-move (apps.sunjay.pipeline): Move a pipeline card

6 app(s), 9 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-move): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-move); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-card-move): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-card-move): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-card-move): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-card-arrange): Same four routes in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-card-state (apps.sunjay.pipeline): Tick or archive a pipeline card

3 app(s), 3 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-card-state): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-card-state); byte-identical bar log prefixes.
- elktours (was elktours-pipeline-card-state): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-comment-add (apps.sunjay.pipeline): Comment on a pipeline card

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-comment-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-comment-add); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-comment-add): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-comment-add): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-comment-add): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-comment-add): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-comment-delete (apps.sunjay.pipeline): Delete a pipeline comment

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-comment-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-comment-delete); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-comment-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-comment-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-comment-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-comment-delete): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-list-add (apps.sunjay.pipeline): Add a pipeline list

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-list-add): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-list-add); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-list-add): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-list-add): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-list-create): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-list-add): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-list-delete (apps.sunjay.pipeline): Delete a pipeline list

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-list-delete): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-list-delete); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-list-delete): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-list-delete): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-list-delete): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-list-delete): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-pipeline-list-rename (apps.sunjay.pipeline): Rename a pipeline list

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-pipeline-list-rename): a thin mount of packages/pipeline createPipelineApi: the org is fixed, no board id crosses the wire, services org-deck re-checks the card or stack belongs to the org board (OrgDeckScopeError). Same file in sunjay (apps.sunjay.*.ts: sunjay-pipeline-list-rename); byte-identical bar log prefixes.
- hidden-enneagram (was he-pipeline-list-rename): Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- ifac (was ifac-pipeline-list-rename): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-list-rename): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-list-rename): Same route in the other five org apps.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services saveMeetingContent / savePostContent (what the hub compose pop-ups already use) behind one org-site kit action; retire the per-app cms saveContentAction in favour of it, keeping the merge-metadata, series guard, audience and sanitise behaviour as the superset. Service offerings stay on services upsertServiceOffering.

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 23; rows: 1; distinct service sets: 12

#### manage-content-save (orgapps.cms): Write or edit a post, gathering or service in the site manager

6 app(s), 23 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Curator note: Three families. (1) sunjay, amrit-canada, elktours, innergathering: the same 140-line action, requireOrgEditor then hand-written INSERT/UPDATE on threads. amrit-canada and elktours are byte-identical bar the log prefix and the default-time-zone comment (Toronto/Paris). sunjay adds a series guard (refuses to edit a series row, which would unmake it) and merges metadata (COALESCE(metadata) - own keys || new); amrit and elktours REPLACE metadata wholesale on edit, so any other writer's metadata keys (for example a meeting light, a series object) are lost and an edit can unmake a series there. inn

### packages/chat createChatApi

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 8; rows: 2; distinct service sets: 3

#### sunjay-chat-name-set (apps.sunjay.hub): Choose my chat name

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-chat-name-set): Same file in sunjay (apps.sunjay.*.ts: sunjay-chat-name-set); byte-identical bar log prefixes.
- hidden-enneagram (was he-chat-name-set): Copy of ifac-chat-name-set.
- ifac (was ifac-chat-name-set): Same as hidden-enneagram (comments only differ).
- innergathering (was ig-chat-name-set): Same route in amrit-canada, elktours, hidden-enneagram, ifac, sunjay (all built on createChatApi; not diffed).
- elktours (was elktours-chat-name-set): Same chat package routes mounted in other org apps.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

#### sunjay-chat-room-create (apps.sunjay.hub): Create the group chat room

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-chat-room-create): Same file in sunjay (apps.sunjay.*.ts: sunjay-chat-room-create); byte-identical bar log prefixes.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services createWritingPost (+updateWritingPost) behind one shared desk action in the org-site kit; HE converts to it and drops raw SQL.

- apps (6): artdirect, arts-collective, danamccool, hidden-enneagram, ifac, innergathering
- hosts: 8; rows: 1; distinct service sets: 5

#### writing-piece-start (orgapps.writing): Start a piece of writing

6 app(s), 8 host(s): artdirect, arts-collective, danamccool, hidden-enneagram, ifac, innergathering.

Differences:

- arts-collective (was start-writing-piece): Third post-creation path next to createThreadAction (org compose) and registry org-publish (createThread). Writing uses createWritingPost.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### one post-creation service (createThread)

- apps (6): amrit-canada, blog-guru-dharam, blog-tester, elktours, forum, sunjay
- hosts: 7; rows: 2; distinct service sets: 4

#### blog-tester-post-create (apps.blog-tester): Publish a blog post

2 app(s), 2 host(s): blog-guru-dharam, blog-tester.

Differences:

- blog-guru-dharam (was blog-guru-dharam-post-create): Another post-creation path (createBlogPost over createPost) next to createThread and the forum createTopic; blog-tester has an identical copy for org elkdonis.

#### forum-topic-start (apps.forum): Start a forum topic

4 app(s), 5 host(s): amrit-canada, elktours, forum, sunjay.

Differences:

- elktours (was elktours-forum-topic-start): Third post-creation path next to createThread and createPostAnywhere (see journal agent B question 4); this one goes through the forum service.
- amrit-canada (was amrit-forum-topic-post): Same file in sunjay (apps.sunjay.*.ts: forum-topic-start); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).
- sunjay (was sunjay-forum-topic-post): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-topic-start); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### one upload route in services with a per-app policy object (types, sizes, who)

- apps (6): amrit-canada, fourthwayBookreaders, hidden-enneagram, innergathering, katie-the-potter, sunjay
- hosts: 7; rows: 2; distinct service sets: 6

#### pkg-series-site-media-upload (pkg.series-site): Upload a file into the organisation's media folder

0 app(s), 0 host(s): .

Curator note: same family as apps.sunjay.audience:sunjay-media-upload and the other org upload routes (internal, each with its own policy); this one is the series-site copy used by sunjay and ifac, and adds the week-host path (a member who hosts the occurrence may upload).

#### sunjay-media-upload (apps.sunjay.audience): Upload a file for the site

6 app(s), 7 host(s): amrit-canada, fourthwayBookreaders, hidden-enneagram, innergathering, katie-the-potter, sunjay.

Differences:

- amrit-canada (was amrit-media-upload): Same family as arts-collective.network:upload-image / upload-my-file and art-auction artwork-image-upload, each with its own rules. This copy: owner/guide only, org fixed, validateUploadBuffer refuses SVG. Same file in sunjay (apps.sunjay.*.ts: sunjay-media-upload); byte-identical bar log prefixes.
- fourthwayBookreaders (was fourthway-media-upload): Same family as sunjay-media-upload and the other upload routes; differs: uses the consolidated uploadOrgFile (no media table row, no visibility field) and refuses SVG after sniffing; the org-app copies write a media row via raw SQL.
- katie-the-potter (was katie-media-upload): Same family as sunjay-media-upload, sunjay-media-upload and art-auction artwork-image-upload. Differs: images only, files go to the ARTIST's own tree (users/<slug>/Media/Images or Galleries/<gallery>), never the org tree, via resolveUserPath; the gallery slug is regex-checked; HEIC is refused with a message for Katie.
- hidden-enneagram (was he-media-upload): Fourth upload family (ifac api/upload, artdirect api/upload, danamccool api/media/upload). This one writes the org tree, not a person folder, and supports audio.
- innergathering (was ig-media-upload): Same upload route in 10 other apps (amrit-canada, art-auction, artdirect, elktours, fourthwayBookreaders, hidden-enneagram, ifac, inner-gathering, pigeonshoot, sunjay): not diffed. arts-collective has a different upload/image route.

> Direction (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.
> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services saveMeetingContent behind one shared 'use server' action in the planned org-site kit (packages/org-site) taking {siteConfig, viewerResolver, hrefFor(record), revalidate(record)} so only the route templates are per-app.

- apps (6): amrit-canada, arts-collective, elktours, ifac, innergathering, sunjay
- hosts: 7; rows: 1; distinct service sets: 3

#### meeting-save (orgapps.meetings): Save a meeting or event

6 app(s), 7 host(s): amrit-canada, arts-collective, elktours, ifac, innergathering, sunjay.

Differences:

- arts-collective (was save-meeting): meeting-actions.ts is copied in six apps; the org-publish entry has a "meeting" kind option but only saves a plain draft post.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### services updateWritingPost + canEditProfile behind one shared desk action.

- apps (6): amrit-canada, artdirect, arts-collective, danamccool, hidden-enneagram, ifac
- hosts: 7; rows: 1; distinct service sets: 7

#### writing-piece-save (orgapps.writing): Save changes to a piece of writing

6 app(s), 7 host(s): amrit-canada, artdirect, arts-collective, danamccool, hidden-enneagram, ifac.

Differences:

- arts-collective (was save-writing-piece): Publishing is a status field in a general patch here; the org side has publishDraftAction / thread-publish.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### packages/chat createChatApi (already shared)

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 6; rows: 1; distinct service sets: 2

#### sunjay-chat-post (apps.sunjay.hub): Post in the group chat

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-chat-post): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-chat-post); byte-identical bar one comment.
- hidden-enneagram (was he-chat-post): Copy of sunjay-chat-post (identical logic).
- ifac (was ifac-chat-post): hidden-enneagram copy is the same route over packages/chat createChatApi.
- innergathering (was ig-chat-message-send): Same route in the other five org apps (not diffed).
- elktours (was elktours-chat-message-post): Same chat package routes mounted in other org apps.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### services assignOrgDocument

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 6; rows: 1; distinct service sets: 3

#### sunjay-document-assign (apps.sunjay.hub): Attach a document to an idea

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-document-assign): Same file in sunjay (apps.sunjay.*.ts: sunjay-document-assign); byte-identical bar log prefixes.
- hidden-enneagram (was he-document-assign): Copy of ifac-document-assign.
- ifac (was ifac-document-assign): Any member can re-assign any org document (no author check); delete is editor-only.
- innergathering (was ig-document-assign): Same route in the other five org apps (not diffed).
- elktours (was elktours-hub-document-assign): None: single copy.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### services createOrgDocument (already shared); route is a thin mount

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 6; rows: 1; distinct service sets: 3

#### sunjay-document-create (apps.sunjay.hub): Start a shared document

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-document-create): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-document-create); byte-identical bar log prefixes.
- hidden-enneagram (was he-document-create): ifac passes no author name. HE has no DELETE route.
- ifac (was ifac-document-create): Same route family exists in hidden-enneagram (member gate, authorName from email, no delete route). ifac passes no authorName and adds DELETE (editor only).
- innergathering (was ig-document-create): Same route in amrit-canada, elktours, hidden-enneagram, ifac and sunjay (not diffed; other agents).
- elktours (was elktours-hub-document-create): None: single copy.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### services createOrgQuestionnaire behind a single shared org-site kit action that does viewer + canManageQuestionnaires; ifac converges once the ownerEmails and global-admin branches of canManageIfac are dropped (owners are seeded: 2 owners, 4 guides).

- apps (6): amrit-canada, arts-collective, elktours, ifac, innergathering, sunjay
- hosts: 6; rows: 1; distinct service sets: 3

#### questionnaire-create (orgapps.questionnaires): Create a questionnaire or poll

6 app(s), 6 host(s): amrit-canada, arts-collective, elktours, ifac, innergathering, sunjay.

Differences:

- arts-collective (was create-questionnaire): Same file copied into elktours and amrit-canada (lib/cms/questionnaire-actions.ts); all call createOrgQuestionnaire.

### services deleteWritingPost behind one shared desk action.

- apps (6): amrit-canada, artdirect, arts-collective, danamccool, hidden-enneagram, ifac
- hosts: 6; rows: 1; distinct service sets: 4

#### writing-piece-delete (orgapps.writing): Delete (archive) a piece of writing

6 app(s), 6 host(s): amrit-canada, artdirect, arts-collective, danamccool, hidden-enneagram, ifac.

Differences:

- arts-collective (was delete-writing-piece): no drift recorded

### services saveWhiteboard

- apps (6): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay
- hosts: 6; rows: 1; distinct service sets: 2

#### sunjay-whiteboard-save (apps.sunjay.hub): Draw on the group's whiteboard

6 app(s), 6 host(s): amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-whiteboard-save): Same file in sunjay (apps.sunjay.*.ts: sunjay-whiteboard-save); byte-identical bar log prefixes.
- hidden-enneagram (was he-whiteboard-save): Copy of sunjay-whiteboard-save (18 diff lines, comments only).
- ifac (was ifac-whiteboard-save): hidden-enneagram has the same route (same gate). Only checks that scene.elements is an array.
- innergathering (was ig-whiteboard-save): Same route in amrit-canada, elktours, hidden-enneagram, ifac, sunjay (not diffed).
- elktours (was elktours-hub-whiteboard-save): None: single copy.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### the shared rsvp handler

- apps (6): amrit-canada, arts-collective, elktours, fourthwayBookreaders, innergathering, sunjay
- hosts: 6; rows: 2; distinct service sets: 2

#### cancel-rsvp (arts-collective.sites): Cancel an RSVP or leave a workshop

5 app(s), 5 host(s): amrit-canada, arts-collective, elktours, fourthwayBookreaders, sunjay.

Differences:

- amrit-canada (was amrit-rsvp-cancel): no workshop or Nextcloud materials revoke, sends no email. Same file in sunjay (apps.sunjay.*.ts: cancel-rsvp); byte-identical bar log prefixes.
- elktours (was elktours-rsvp-cancel): same service deleteRsvp, org check via loadThread here.
- fourthwayBookreaders (was fourthway-rsvp-cancel): no Nextcloud revoke; the viewer role is not removed.
- sunjay (was sunjay-rsvp-cancel): no workshop or Nextcloud materials revoke, sends no email. Same file in amrit-canada (apps.amrit-canada.*.ts: cancel-rsvp); byte-identical bar log prefixes.

> Direction (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).
> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### ig-rsvp-cancel (apps.innergathering.gatherings): Cancel your RSVP

1 app(s), 1 host(s): innergathering.

Curator note: copy of arts-collective.sites.ts:cancel-rsvp; differs: org_id and published filter, and workshop-materials unshare.

### a services setThreadStatus(org, id, status) used by one kit action; the same function should drive the hub review-queue publish.

- apps (5): amrit-canada, elktours, hidden-enneagram, innergathering, sunjay
- hosts: 10; rows: 1; distinct service sets: 2

#### manage-content-status-set (orgapps.cms): Publish or unpublish a post

5 app(s), 10 host(s): amrit-canada, elktours, hidden-enneagram, innergathering, sunjay.

Curator note: Five byte-near-identical copies (log prefix only). All filter the UPDATE by org_id and require requireOrgEditor, so they are equally strong. It writes status directly, so it skips services statusForNewThread (ifac moderation) and any notification a meeting publish would send. It does not sync the calendar mirror (ifac mirrors dated posts to the Nextcloud calendar on save; this path does not).

### the site-section-save hub entry (SiteBuilderAdapter) as the one write, with a services saveSiteSection that validates sectionKey against the page layout and merges.

- apps (5): amrit-canada, elktours, fourthwayBookreaders, innergathering, sunjay
- hosts: 10; rows: 1; distinct service sets: 4

#### site-section-copy-save (orgapps.cms): Edit a page's wording

5 app(s), 10 host(s): amrit-canada, elktours, fourthwayBookreaders, innergathering, sunjay.

Differences:

- fourthwayBookreaders (was fourthway-section-save): STRICTER. Keys are an allowlist (route.ts:30-38), body is sanitiseRichText on write, content must be an object, 400 KB cap; the org-app copies take free-text sectionKey and content with no cap or sanitising. Replaces whole content, like them.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### commerce createArtwork/updateArtwork/setArtworkMedia with katie's validation (image path rule, currency list, bounds) moved into commerce; one kit action built on guardStore.

- apps (5): art-auction, arts-collective, ifac, innergathering, katie-the-potter
- hosts: 9; rows: 1; distinct service sets: 7

#### artwork-draft-save (orgapps.artwork): Save an artwork

5 app(s), 9 host(s): art-auction, arts-collective, ifac, innergathering, katie-the-potter.

Differences:

- arts-collective (was save-artwork): Also lib/cms/artwork-actions.ts (saveArtworkDraftAction, publishArtworksAction) in the /learn journey: createArtwork/updateArtwork vs createArtwork/publishArtwork here.
- innergathering (was ig-art-piece-create): price major units to minor on the server (Math.round(x*100), min 0), imageUrl stored as given, no currency choice, no publish step here.
- art-auction (was artwork-create): Single copy in the app.
- ifac (was ifac-art-piece-create): Studio forms (packages/studio) save artwork through arts-collective artwork-draft-save, which ignores the org and has editions, credit and auction; this ifac composer is one picture, publishes on save, and has the org-store switch. See docs/open/IFAC_STUDIO_STORES_AND_KIT_2026-11-12.md.

> Related: artwork-journey-publish (publish step) and ifac-store-open.

### services setThreadListings behind the shared desk action.

- apps (5): artdirect, arts-collective, hidden-enneagram, ifac, innergathering
- hosts: 7; rows: 1; distinct service sets: 4

#### choose-sites-for-post (arts-collective.hub): Show a post on other sites

5 app(s), 7 host(s): artdirect, arts-collective, hidden-enneagram, ifac, innergathering.

Differences:

- ifac (was writing-piece-listing): Same services call; per-app revalidatePath only. HE gated getApiEditor, the others author check.
- innergathering (was ig-post-listing-set): session helper only.

### services createOrgIdea

- apps (5): amrit-canada, elktours, fourthwayBookreaders, ifac, sunjay
- hosts: 5; rows: 1; distinct service sets: 3

#### sunjay-idea-submit (apps.sunjay.hub): Suggest an idea

5 app(s), 5 host(s): amrit-canada, elktours, fourthwayBookreaders, ifac, sunjay.

Differences:

- amrit-canada (was amrit-idea-submit): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-idea-submit); byte-identical bar log prefixes.
- elktours (was elktours-hub-idea-submit): The forum topic form can also create kind idea (forum-topic-start); two idea paths.
- ifac (was ifac-idea-add): No hidden-enneagram copy found.
- fourthwayBookreaders (was fourthway-book-suggest): Same service as sunjay-idea-submit / sunjay-idea-submit (createOrgIdea) but open to any signed-in person (the hub copies require a member).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### services removeThreadAs with the org check moved inside (an org id parameter), behind one kit action.

- apps (5): amrit-canada, elktours, hidden-enneagram, innergathering, sunjay
- hosts: 5; rows: 1; distinct service sets: 1

#### manage-content-remove (orgapps.cms): Take a post off the site

5 app(s), 5 host(s): amrit-canada, elktours, hidden-enneagram, innergathering, sunjay.

Curator note: All five check org membership of the thread before calling services removeThreadAs with editor:true (which trusts the caller). Same strength everywhere; hidden-enneagram reads the section back from the service result instead of a pre-SELECT.

### services saveCenterLayout behind one shared route (already a service); keep per-app auth only

- apps (5): amrit-canada, elktours, hidden-enneagram, innergathering, sunjay
- hosts: 5; rows: 1; distinct service sets: 2

#### sunjay-center-layout-save (apps.sunjay.center): Arrange the organisation's Center page

5 app(s), 5 host(s): amrit-canada, elktours, hidden-enneagram, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-center-layout-save): No arts-collective copy mapped. Same file in sunjay (apps.sunjay.*.ts: sunjay-center-layout-save); byte-identical bar log prefixes.
- hidden-enneagram (was he-center-layout-save): No ifac copy found. org comes from the query string (default the site org), so an owner of ANOTHER org can edit that org layout through this site (gate is per target org, not per site).
- elktours (was elktours-center-layout-save): Same route is mounted in the other org apps.
- innergathering (was ig-center-layout-save): Same route exists in amrit-canada, elktours, hidden-enneagram and sunjay (not in arts-collective); those copies are curated by other agents and not diffed here.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### One org-site kit action: getApiEditor + services saveSiteTheme + a services saveSiteChrome (moves the raw site_config SQL out of apps) + revalidatePath('/', 'layout'); the SITE_STYLE schema stays per app as config.

- apps (4): elktours, hidden-enneagram, katie-the-potter, sunjay
- hosts: 8; rows: 1; distinct service sets: 2

#### site-style-save (orgapps.site-style): Change the site's look (colours, fonts, header and footer)

4 app(s), 8 host(s): elktours, hidden-enneagram, katie-the-potter, sunjay.

Curator note: Four copies of the same pair of files. saveSiteStyleAction is byte-identical in sunjay, elktours, katie-the-potter (md5 f2092db3/607303ab family: getApiEditor then saveSiteStyle, NO revalidatePath in sunjay and elktours (katie revalidates, like HE; corrected 2026-11-16 by lane siteform), so the public site may show the old style until a cache expiry). hidden-enneagram adds revalidatePath('/', 'layout') and its error text says 'owners and editors' (actually owner/guide, same getApiEditor). site-style.ts differs only in comments (sunjay/elktours/katie/HE). Each app has its own site-style-schema.

### one shared guest RSVP handler in services with rate limit and email validation

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 8; rows: 1; distinct service sets: 6

#### sunjay-rsvp-guest (apps.sunjay.audience): RSVP as a guest, without an account

4 app(s), 8 host(s): amrit-canada, elktours, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-rsvp-guest): No arts-collective guest route (arts-collective has only the member RSVP). Same file in sunjay (apps.sunjay.*.ts: sunjay-rsvp-guest); byte-identical bar log prefixes.
- innergathering (was ig-rsvp-guest): Same route (guest RSVP) in amrit-canada, elktours, sunjay and admin: not diffed here (other agents). The member door is ig-rsvp-join (arts-collective.sites.ts:rsvp-to-event is its twin).
- elktours (was elktours-rsvp-guest): Same route exists in the other org apps (inner-gathering original); member RSVP is a separate route (rsvp-to-event).

> Direction (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).
> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.
> Related, not merged: rsvp-to-event (signed-in member RSVP).

### auth-server login handler (shared); decide whether sign-in should ever join an org (signup already does)

- apps (4): admin, fourthwayBookreaders, katie-the-potter, sunjay
- hosts: 5; rows: 1; distinct service sets: 4

#### sunjay-login (apps.sunjay.center): Sign in

4 app(s), 5 host(s): admin, fourthwayBookreaders, katie-the-potter, sunjay.

Differences:

- fourthwayBookreaders (was fourthway-login): Thin wrapper over handleLogin, like amrit-canada (a re-export there); sunjay-login adds a viewer join.
- katie-the-potter (was katie-login): Same as sunjay-login (createLoginHandler with a viewer join); amrit-canada and fourthway do not join on sign-in.
- admin (was admin-login): adds the contacts backfill that no other site has.

### packages/forum-ui handleForumAction with phone routes calling the same connectors

- apps (4): amrit-canada, elktours, forum, sunjay
- hosts: 5; rows: 1; distinct service sets: 3

#### forum-reply (apps.forum): Reply in the forum

4 app(s), 5 host(s): amrit-canada, elktours, forum, sunjay.

Differences:

- elktours (was elktours-forum-reply): The board form (/api/forum/reply) and the phone route (/api/hub/forum/replies) call the same postReply; the phone route has no signed-in check of its own (the viewer comes from getForumViewer).
- amrit-canada (was amrit-forum-reply): Same file in sunjay (apps.sunjay.*.ts: forum-reply); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).
- sunjay (was sunjay-forum-reply): Same file in amrit-canada (apps.amrit-canada.*.ts: forum-reply); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### One kit action over startBookingCheckout (booking module, offer-driven) for every site; startServiceCheckout is the older path and createServiceBooking/service_bookings is the table it feeds.

- apps (4): artdirect, elastrocal, hidden-enneagram, sunjay
- hosts: 4; rows: 1; distinct service sets: 3

#### service-book-and-pay (orgapps.commerce.booking): Book and pay for a service

4 app(s), 4 host(s): artdirect, elastrocal, hidden-enneagram, sunjay.

Differences:

- elastrocal (was elastrocal-service-book): none beyond the app and its basePath (/astro); same startServiceCheckout call as artdirect and sunjay.

> Direction (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).

### a shared cycle-event handler in services

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 3

#### sunjay-cycle-confirm (apps.sunjay.audience): Confirm or cancel this cycle's gathering

4 app(s), 4 host(s): amrit-canada, elktours, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-cycle-confirm): Not in arts-collective. inner-gathering uses the same vocabulary (route comment). Same file in sunjay (apps.sunjay.*.ts: sunjay-cycle-confirm); byte-identical bar log prefixes.
- elktours (was elktours-cycle-confirm): Copy of the inner-gathering route (named in the code comment).
- innergathering (was ig-cycle-mark): Same route in amrit-canada, elktours and sunjay (not diffed). Writes raw SQL where every other write here goes through a service.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### a shared trigger-email handler in services

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 3

#### sunjay-trigger-email-send (apps.sunjay.audience): Email everyone who said they are coming

4 app(s), 4 host(s): amrit-canada, elktours, innergathering, sunjay.

Differences:

- amrit-canada (was amrit-trigger-email-send): Not in arts-collective. inner-gathering has a version that links a confirmUrl that 404s (route comment). Same file in sunjay (apps.sunjay.*.ts: sunjay-trigger-email-send); differs only in EMBLEM_URL and log prefixes.
- elktours (was elktours-trigger-email-send): elktours dropped it, per the route comment).
- innergathering (was ig-gathering-email-send): Same route in amrit-canada, elktours and sunjay (not diffed).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### commerce setPayoutIdentity with the country/rail/email validation (including the email regex) moved into commerce, behind one kit action gated on 'signed-in person'.

- apps (4): art-auction, elktours, katie-the-potter, sunjay
- hosts: 4; rows: 1; distinct service sets: 1

#### payout-setup-save (orgapps.money): Save where I get paid (country and payout method)

4 app(s), 4 host(s): art-auction, elktours, katie-the-potter, sunjay.

Differences:

- art-auction (was market-payout-setup-save): Same payout idea as payout-setup-save (orgapps.money: sunjay, katie, elktours and ifac copies). This copy re-checks country against rail on the server; setPayoutIdentity is the shared service.

### packages/chat createChatApi.

- apps (4): elktours, hidden-enneagram, ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 2

#### he-chat-provision (apps.hidden-enneagram.hub): Set up the team chat room

4 app(s), 4 host(s): elktours, hidden-enneagram, ifac, innergathering.

Differences:

- ifac (was ifac-chat-provision): Same as hidden-enneagram.
- innergathering (was ig-chat-room-provision): Same route in the other five org apps.
- elktours (was elktours-chat-provision): Same chat package routes mounted in other org apps.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### packages/pipeline createPipelineApi routes mounted once (already the shape); remove the per-app route files in favour of one catch-all mount.

- apps (4): elktours, hidden-enneagram, ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 3

#### he-pipeline-provision (apps.hidden-enneagram.hub): Set up the board

4 app(s), 4 host(s): elktours, hidden-enneagram, ifac, innergathering.

Differences:

- ifac (was ifac-pipeline-provision): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.
- elktours (was elktours-pipeline-board-provision): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.
- innergathering (was ig-pipeline-board-provision): Same pipeline routes in amrit-canada, elktours, hidden-enneagram, ifac, sunjay; the shared package @elkdonis/pipeline/routes holds the auth wrappers and the OrgDeckScopeError to 404 mapping (lib/pipeline-api.ts says ~55 lines were duplicated in two apps).

### services defineTerm via one shared org-site kit action using requireOrgMember.

- apps (4): amrit-canada, elktours, fourthwayBookreaders, sunjay
- hosts: 4; rows: 1; distinct service sets: 1

#### dictionary-term-define (orgapps.dictionary): Define a term in the network dictionary

4 app(s), 4 host(s): amrit-canada, elktours, fourthwayBookreaders, sunjay.

Curator note: None: four byte-identical files, gate requireOrgMember (any member-or-above role, deliberately looser than requireOrgEditor because the wiki is network-wide). Arts-collective has its own dictionary path (other agents).

### services saveOffering via one kit action; currency from site config.

- apps (4): artdirect, arts-collective, ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 3

#### own-service-save (orgapps.money): Save one of my services

4 app(s), 4 host(s): artdirect, arts-collective, ifac, innergathering.

Differences:

- arts-collective (was save-my-service): Org offerings go through service-form-actions (upsertServiceOffering); personal ones here (saveOffering).
- artdirect (was artdirect-offering-save): own-service-save / orgapps.money own-service-save, here through services saveOffering for meetings and services and shareToNetwork defaulting to true.

### services setMeetingAttendance behind one shared attendance route.

- apps (4): hidden-enneagram, ifac, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 3

#### he-attendance-set (apps.hidden-enneagram.hub): Say how you will come to a meeting

4 app(s), 4 host(s): hidden-enneagram, ifac, innergathering, sunjay.

Differences:

- ifac (was ifac-attendance-set): hidden-enneagram center/attendance is the same handler without the series guard and promiseNext (he-attendance-set).
- innergathering (was ig-meeting-attendance-set): Same route in ifac (not diffed). A second door to the same thread_rsvps rows as ig-rsvp-join (api/threads/[id]/rsvp): this one has no payment branch and no published-status filter; checkRsvpEligibility (services/thread-rsvp.ts:29-60) tests only enabled, deadline and capacity.
- sunjay (was sunjay-meeting-attendance): No amrit-canada copy. Same shape as ifac /api/hub/meeting/attendance (route comment). Thread must belong to the org (route.ts:50-54): good.

### services setOfferingStatus via the kit.

- apps (4): artdirect, arts-collective, ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 3

#### own-service-status (orgapps.money): Publish or unpublish one of my services

4 app(s), 4 host(s): artdirect, arts-collective, ifac, innergathering.

Differences:

- arts-collective (was set-my-service-status): no drift recorded
- artdirect (was artdirect-offering-status-set): Same as arts-collective own-service-status / orgapps.money own-service-status.

### services setOrgPersonRole behind the one kit action already shared with the hub Members card (entry org-person-role); delete the per-app wrappers.

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 1

#### manage-member-role-set (orgapps.cms): Change a member's role from the owner console

4 app(s), 4 host(s): amrit-canada, elktours, innergathering, sunjay.

Curator note: Byte-identical in the four apps. Stricter than the Center-table copy (org-person-role-set in orgapps.people: ifac and innergathering setOrgPersonRoleAction gate on canManageOrgPeople, which admits guides, leaving the owner rule to services): this one checks editor.role === 'owner' in the action AND calls the same services setOrgPersonRole. Same concept, two actions per app (innergathering has both).

### services setStandingMeeting (add the org check inside) behind a kit action.

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 1

#### standing-meeting-set (orgapps.cms): Choose the gathering the hub leads with

4 app(s), 4 host(s): amrit-canada, elktours, innergathering, sunjay.

Curator note: Byte-identical in the four apps (log prefix). Org check by SELECT then services setStandingMeeting.

### services submitQuote

- apps (4): amrit-canada, elktours, hidden-enneagram, sunjay
- hosts: 4; rows: 1; distinct service sets: 2

#### sunjay-quote-submit (apps.sunjay.center): Add a line to the Center quote band

4 app(s), 4 host(s): amrit-canada, elktours, hidden-enneagram, sunjay.

Differences:

- amrit-canada (was amrit-quote-submit): Related to arts-collective.hub:add-quote (the desk action for owners). This is the person-submit route. Same file in sunjay (apps.sunjay.*.ts: sunjay-quote-submit); byte-identical bar log prefixes.
- hidden-enneagram (was he-quote-add): that one is an owner/guide action, this route lets any signed-in person submit (pending).
- elktours (was elktours-center-quote-submit): Copy of the quotes route in the other org apps (arts-collective quote-actions is a server action, not this route).

> Related to arts-collective.hub:add-quote (the desk action for owners). This is the person-submit route. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-quote-submit); byte-identical bar log prefixes.
> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.
> Related, not merged: add-quote (arts-collective.hub), an owner/guide action; the routes here let any signed-in person submit a pending line.

### services updateProfile + upsertOrgProfile in one services saveGuidePage, one kit action.

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 1

#### guide-profile-save (orgapps.cms): Publish or update a teacher or guide page

4 app(s), 4 host(s): amrit-canada, elktours, innergathering, sunjay.

Curator note: Byte-identical in the four apps. Writes another person's GLOBAL users row (name, bio, avatar, city, slug) as well as the org-scoped org_profiles row: an owner of one org edits an identity shared by every org. photoUrl is stored unvalidated (same as the profile-update path).

### services upsertOrgFeed behind one kit action.

- apps (4): amrit-canada, elktours, innergathering, sunjay
- hosts: 4; rows: 1; distinct service sets: 1

#### site-feed-save (orgapps.cms): Add or edit a site page (name, tagline, visibility)

4 app(s), 4 host(s): amrit-canada, elktours, innergathering, sunjay.

Curator note: Byte-identical in the four apps (log prefix only). Gate requireOrgEditor. hidden-enneagram and ifac have no feed editor. This is the legacy "feeds" model; the Site Builder (hub) adds pages through site-page-create, a different concept (Puck documents).

### services connectionsHandlers (already shared)

- apps (3): amrit-canada, fourthwayBookreaders, sunjay
- hosts: 12; rows: 2; distinct service sets: 2

#### sunjay-org-channel-set (apps.sunjay.center): Set the organisation's posting channel

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-org-channel-set): Same mount of connectionsHandlers as arts-collective.hub:set-org-posting-channel, no real drift: the route is 14 lines in every app. Same file in sunjay (apps.sunjay.*.ts: sunjay-org-channel-set); byte-identical bar log prefixes.

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-social-account-manage (apps.sunjay.center): Edit or check a connected account

3 app(s), 10 host(s): amrit-canada, fourthwayBookreaders, sunjay.

Differences:

- amrit-canada (was amrit-social-account-manage): Same mount of connectionsHandlers as arts-collective.hub:edit-social-account, no real drift: the route is 14 lines in every app. Same file in sunjay (apps.sunjay.*.ts: sunjay-social-account-manage); byte-identical bar log prefixes.
- fourthwayBookreaders (was fourthway-social-account-manage): Same 14-line mount of connectionsHandlers as connect-social-account and the arts-collective rows; no real drift (here it serves YouTube for the Akhand Path).

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### a shared email-template-settings module in services (the file is copied per app)

- apps (3): amrit-canada, elktours, sunjay
- hosts: 8; rows: 1; distinct service sets: 4

#### sunjay-email-settings-save (apps.sunjay.audience): Write the gathering emails

3 app(s), 8 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-email-settings-save): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-email-settings-save); byte-identical bar log prefixes.
- elktours (was elktours-email-template-save): Copy of the inner-gathering/amrit email settings route.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### site_themes via services saveSiteTheme (the site-style-save path); danamccool migrates its palette/fonts into site_themes vars.

- apps (3): arts-collective, danamccool, ifac
- hosts: 7; rows: 1; distinct service sets: 6

#### site-theme-save (orgapps.site-style): Change the site's theme (palette and fonts)

3 app(s), 7 host(s): arts-collective, danamccool, ifac.

Differences:

- arts-collective (was save-site-theme): no drift recorded

### one shared inquiry handler in services

- apps (3): amrit-canada, elktours, sunjay
- hosts: 6; rows: 1; distinct service sets: 4

#### sunjay-inquiry-send (apps.sunjay.audience): Send an inquiry about a service

3 app(s), 6 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-inquiry-send): No arts-collective copy. Same file in sunjay (apps.sunjay.*.ts: sunjay-inquiry-send); byte-identical bar log prefixes.
- elktours (was elktours-inquiry-send): Elktours also has sendExperienceInquiryAction (elktours-experience-inquiry-send) which emails owners and hosts and stores nothing; two inquiry paths.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### page-builder deletePage(orgId, slug) plus a one-step undo (keep the last version), behind a kit action.

- apps (3): elktours, innergathering, sunjay
- hosts: 6; rows: 1; distinct service sets: 2

#### landing-restore (orgapps.editing): Put the home page back as it was written in code

3 app(s), 6 host(s): elktours, innergathering, sunjay.

Curator note: Three copies. sunjay revalidates '/', elktours and innergathering do not. No history is kept of the deleted tree in any of them, so Restore is a hard delete of the person's design.

### services setThreadReminder behind one shared route

- apps (3): amrit-canada, elktours, sunjay
- hosts: 6; rows: 1; distinct service sets: 4

#### sunjay-reminder-set (apps.sunjay.audience): Set when a gathering reminder goes out

3 app(s), 6 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-reminder-set): Not in arts-collective. Ported from inner-gathering (reminders.ts header). Same file in sunjay (apps.sunjay.*.ts: sunjay-reminder-set); byte-identical bar log prefixes.
- elktours (was elktours-reminder-set): Copy of the inner-gathering route.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### services sitePortfolioRoutes (already shared); mount only

- apps (3): hidden-enneagram, innergathering, sunjay
- hosts: 6; rows: 2; distinct service sets: 3

#### ig-portfolio-save (apps.innergathering.center): Choose a portfolio for this site

3 app(s), 3 host(s): hidden-enneagram, innergathering, sunjay.

Differences:

- sunjay (was sunjay-portfolio-save): No amrit-canada copy (amrit has no portfolio route). ifac and artdirect save a gallery through profile-editor actions (orgapps.editing:profile-portfolio-save), a different path to the same data idea.
- hidden-enneagram (was he-portfolio-choose): Shared packages/services sitePortfolioRoutes mount; URLs must be in the person's own /api/media folder, their home list or the current site list (good).

#### ig-portfolio-upload (apps.innergathering.center): Upload a portfolio image

3 app(s), 3 host(s): hidden-enneagram, innergathering, sunjay.

Differences:

- sunjay (was sunjay-portfolio-upload): Same factory handler as the PUT; step inside portfolio-save.
- hidden-enneagram (was he-portfolio-upload): Shared sitePortfolioRoutes POST; unlike ifac center/avatar it sniffs bytes (validateUploadBuffer).

### packages/actions server/channel.ts acceptSuggestion, called by all three actions

- apps (3): arts-collective, katie-the-potter, sunjay
- hosts: 5; rows: 1; distinct service sets: 2

#### accept-channel-suggestion (arts-collective.channel): Accept a suggested post

3 app(s), 5 host(s): arts-collective, katie-the-potter, sunjay.

Differences:

- sunjay (was sunjay-channel-suggestion-accept): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).
- katie-the-potter (was katie-channel-suggestion-accept): one host serves six entries (SITE_DOOR_ALLOW).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.
> Related, not merged: sunjay-channel-slot-fill and sunjay-channel-slot-fill (their own registry entry channel-slot-fill).

### services setOrgPersonRole (actor check inside services) via one kit action; also mounted in the hub Members card.

- apps (3): arts-collective, ifac, innergathering
- hosts: 5; rows: 1; distinct service sets: 4

#### org-person-role-set (orgapps.people): Change someone's role in the organisation

3 app(s), 5 host(s): arts-collective, ifac, innergathering.

Differences:

- arts-collective (was change-person-role): Three paths: setOrgPersonRoleAction (setOrgPersonRole, never owner), members route (setOrgRole, may set owner), and hub entry org-person-role (setOrgPersonRole through performHubAction). The route can grant owner; the others refuse.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### slot-actions updateSlot on the booking tables.

- apps (3): booking, commerce, elktours
- hosts: 5; rows: 1; distinct service sets: 4

#### slot-edit (orgapps.commerce.booking): Change a tour date

3 app(s), 5 host(s): booking, commerce, elktours.

Curator note: updateSlot refuses another guide for non-owners and scopes by denyUnlessMine; saveDepartureAction does neither. updateDeparture (legacy) can lower capacity below seats already taken and does not email bookers; the booking-tables updateSlot is the careful one.

### booking tables cancelSlot, with the refund-due list.

- apps (3): booking, commerce, elktours
- hosts: 4; rows: 1; distinct service sets: 4

#### slot-cancel (orgapps.commerce.booking): Cancel a tour date

3 app(s), 4 host(s): booking, commerce, elktours.

Curator note: The booking-tables cancelSlot returns refundsDue per booking. The legacy cancelDeparture cancels only confirmed bookings: an awaiting_payment booking stays and, if the buyer then pays, markTourBookingPaid still confirms seats on a cancelled departure (no status check on the departure).

### services createOrganizationForUser through the existing registry door, so the dock runs one path.

- apps (3): arts-collective, ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 3

#### org-site-create (orgapps.journeys): Start an organisation site

3 app(s), 4 host(s): arts-collective, ifac, innergathering.

Differences:

- arts-collective (was create-organisation): Registry runner `org` calls the same service as this route (same path, good).

### services setOrgPersonListed via the kit (and the hub Members card).

- apps (3): arts-collective, ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 3

#### org-person-listed-set (orgapps.people): List or unlist a person on the org page

3 app(s), 4 host(s): arts-collective, ifac, innergathering.

Differences:

- arts-collective (was list-person-in-directory): no drift recorded

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### slot-actions createSlots on the booking tables; retire addDeparturesAction at the cutover.

- apps (3): booking, commerce, elktours
- hosts: 4; rows: 1; distinct service sets: 4

#### slots-create (orgapps.commerce.booking): Add tour dates (slots)

3 app(s), 4 host(s): booking, commerce, elktours.

Curator note: Two stores behind a flag (BOOKING_TABLES): legacy tour_departures and new booking_slots. slot-actions createSlots plans against clashes and per-slot settings; tour-actions addDeparturesAction does none of that and does not check that the guide is the tour's author.

### @elkdonis/newsletter saveNewsletter behind one route mount.

- apps (3): hidden-enneagram, ifac, innergathering
- hosts: 3; rows: 1; distinct service sets: 3

#### he-newsletter-save (apps.hidden-enneagram.site): Save a newsletter letter

3 app(s), 3 host(s): hidden-enneagram, ifac, innergathering.

Differences:

- ifac (was ifac-series-mailing-save): Series-audience version of hidden-enneagram he-newsletter-save (api/newsletter/[slug]); ifac adds findIfacSeries and an audience.
- innergathering (was ig-newsletter-save): Same route in hidden-enneagram (api/newsletter/[slug]); not diffed. ifac has api/newsletter/series.

### @elkdonis/newsletter sendNewsletter.

- apps (3): hidden-enneagram, ifac, innergathering
- hosts: 3; rows: 1; distinct service sets: 2

#### he-newsletter-send (apps.hidden-enneagram.site): Send a newsletter letter

3 app(s), 3 host(s): hidden-enneagram, ifac, innergathering.

Differences:

- ifac (was ifac-series-mailing-send): As he-newsletter-send, with series audience and unsubscribe URL.
- innergathering (was ig-newsletter-send): Same route in hidden-enneagram; not diffed.

### commerce publishArtwork (ownership inside) via one kit action; marketplace URL from siteConfig.

- apps (3): arts-collective, ifac, innergathering
- hosts: 3; rows: 1; distinct service sets: 2

#### artwork-journey-publish (orgapps.artwork): Put artworks on sale

3 app(s), 3 host(s): arts-collective, ifac, innergathering.

Differences:

- arts-collective (was publish-artworks): Studio saveArtworkFormAction publishes one artwork through the same publishArtwork.

### commerce publishStoreForAuction with displayName resolved inside commerce; one shared kit action.

- apps (3): arts-collective, ifac, innergathering
- hosts: 3; rows: 1; distinct service sets: 2

#### auction-store-publish (orgapps.journeys): Open my store on the marketplace

3 app(s), 3 host(s): arts-collective, ifac, innergathering.

Differences:

- arts-collective (was open-your-store): Org stores open through openOrgStore (hub open-org-store); a person's through publishStoreForAuction.

### katie's gate (store, manager, method matches) inside a single confirmOrderPaid wrapper.

- apps (3): admin, commerce, katie-the-potter
- hosts: 3; rows: 1; distinct service sets: 3

#### order-payment-confirm (orgapps.commerce.shop): Confirm an order is paid (eTransfer or manual)

3 app(s), 3 host(s): admin, commerce, katie-the-potter.

Curator note: katie requires a manager of the store AND that the order is this store's AND that its method is etransfer. art-auction confirmPaidAction requires an admin or a manager of the selling store (canConfirmSeriesPayment) and lets the caller pick method etransfer or manual with no check against the order's own payment method. The admin route accepts any orderId from an admin.

### one shared reminder tick in services, called by each app instrumentation

- apps (3): amrit-canada, elktours, sunjay
- hosts: 3; rows: 1; distinct service sets: 2

#### sunjay-reminders-send (apps.sunjay.audience): Send due gathering reminders

3 app(s), 3 host(s): amrit-canada, elktours, sunjay.

Differences:

- amrit-canada (was amrit-reminders-send): Ported from apps/inner-gathering/src/lib/reminders.ts. Same file in sunjay (apps.sunjay.*.ts: sunjay-reminders-send); differs only in EMBLEM_URL and log prefixes. Recurring occurrences beyond the first are not handled (header: v1).
- elktours (was elktours-reminder-tick): Ported from apps/inner-gathering; the same emblem constants (Khanda image, amritcanada.ca default) came with it.

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### packages/actions server/channel.ts dismissSuggestion

- apps (3): arts-collective, katie-the-potter, sunjay
- hosts: 3; rows: 1; distinct service sets: 2

#### dismiss-channel-suggestion (arts-collective.channel): Dismiss a suggestion

3 app(s), 3 host(s): arts-collective, katie-the-potter, sunjay.

Differences:

- sunjay (was sunjay-channel-suggestion-dismiss): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).
- katie-the-potter (was katie-channel-suggestion-dismiss): one host serves six entries (SITE_DOOR_ALLOW).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### packages/actions server/channel.ts planStep

- apps (3): arts-collective, katie-the-potter, sunjay
- hosts: 3; rows: 1; distinct service sets: 2

#### tick-plan-step (arts-collective.channel): Tick a plan step

3 app(s), 3 host(s): arts-collective, katie-the-potter, sunjay.

Differences:

- sunjay (was sunjay-channel-plan-step): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).
- katie-the-potter (was katie-channel-plan-step): one host serves six entries (SITE_DOOR_ALLOW).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### packages/actions server/channel.ts saveDeliveryDraft, with scheduling as a separate entry

- apps (3): arts-collective, katie-the-potter, sunjay
- hosts: 3; rows: 2; distinct service sets: 2

#### plan-or-schedule-post (arts-collective.channel): Plan or schedule a post for a piece

1 app(s), 1 host(s): arts-collective.

Curator note: The app's lib/channel/actions.ts and the registry's packages/actions/src/server/channel.ts each carry their own copy of acting/ownerFor/mayTouch and the delivery + plan-step writes (both call @elkdonis/services/channel). Registry channel-delivery-save only ever writes drafts; this action can set status scheduled.

#### sunjay-channel-delivery-save (apps.sunjay.hub): Plan a post

2 app(s), 2 host(s): katie-the-potter, sunjay.

Differences:

- katie-the-potter (was katie-channel-delivery-save): one host serves six entries (SITE_DOOR_ALLOW).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.
> Related, not merged: plan-or-schedule-post (arts-collective.channel), which can set a post to scheduled (risk public); the site-door copies write plans only.

### packages/forum-ui handleForumAction (already shared).

- apps (3): hidden-enneagram, ifac, innergathering
- hosts: 3; rows: 1; distinct service sets: 3

#### he-forum-act (apps.hidden-enneagram.hub): Forum actions (door)

3 app(s), 3 host(s): hidden-enneagram, ifac, innergathering.

Differences:

- ifac (was ifac-forum-act): Same route in hidden-enneagram (identical). The unclaimed `forum` package app hosts are mapped by whoever maps the forum.
- innergathering (was ig-forum-act): Mounted the same way in amrit-canada, elktours, hidden-enneagram, ifac and sunjay (not diffed). inner-gathering (legacy) had its own forum routes.

### planPiece with a no-proposals option

- apps (3): arts-collective, katie-the-potter, sunjay
- hosts: 3; rows: 1; distinct service sets: 2

#### start-piece-plan (arts-collective.channel): Start a plan for a piece

3 app(s), 3 host(s): arts-collective, katie-the-potter, sunjay.

Differences:

- sunjay (was sunjay-channel-plan): this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).
- katie-the-potter (was katie-channel-plan): one host serves six entries (SITE_DOOR_ALLOW).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### saveOrgEmailIdentity

- apps (3): arts-collective, ifac, innergathering
- hosts: 3; rows: 1; distinct service sets: 3

#### save-org-email-identity (arts-collective.hub): Save the organisation's sending name and reply address

3 app(s), 3 host(s): arts-collective, ifac, innergathering.

Differences:

- ifac (was ifac-email-identity-save): save-org-email-identity (entry org-email, canonical saveOrgEmailIdentity).
- innergathering (was ig-email-identity-save): single-org route (siteConfig.orgId), gate getApiEditor instead of guardOrgEmailWrite(slug).

> Direction (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.

### services uploadOrgFile with validateUploadBuffer

- apps (3): blog-guru-dharam, blog-server, blog-tester
- hosts: 3; rows: 2; distinct service sets: 2

#### blog-tester-media-upload (apps.blog-tester): Upload a picture or file for a blog post

2 app(s), 2 host(s): blog-guru-dharam, blog-tester.

Differences:

- blog-guru-dharam (was blog-guru-dharam-media-upload): Shared handler with apps/blog-tester. Other apps upload through services uploadOrgFile with validateUploadBuffer (sniffed bytes); this one trusts the browser MIME type.

> Direction (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.

#### pkg-blog-server-media-upload (pkg.blog-server): Store an uploaded blog file

1 app(s), 1 host(s): blog-server.

Curator note: backs blog-tester-media-upload and blog-tester-media-upload

### one /api/meta/* pair, with Instagram and Threads callback URLs pointed at it in the Meta app config

- apps (2): arts-collective, innergathering
- hosts: 9; rows: 1; distinct service sets: 3

#### receive-meta-events (arts-collective.network): Meta, Instagram and Threads webhooks and deletion callbacks

2 app(s), 9 host(s): arts-collective, innergathering.

Differences:

- innergathering (was ig-meta-deletion-receive): files the request under this site’s orgId (arts-collective passes null) and uses lib/public-origin for the status URL; 24 diff lines, same factory.

### handleForumAction

- apps (2): amrit-canada, sunjay
- hosts: 8; rows: 2; distinct service sets: 1

#### sunjay-forum-line-draw (apps.sunjay.hub): Draw a line between two topics

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-forum-line-draw): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-line-draw); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

#### sunjay-forum-reader-state (apps.sunjay.hub): Mark forum items read and set reading looks

2 app(s), 6 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-forum-reader-state): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-reader-state); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### one kit saveGalleryItems(galleryId, items) over services updateUserGallery with url validation inside services; the fine-grained operations become client-side helpers that compute the new list.

- apps (2): danamccool, ifac
- hosts: 8; rows: 1; distinct service sets: 3

#### gallery-items-save (orgapps.content): Change the pictures in a gallery

2 app(s), 8 host(s): danamccool, ifac.

Curator note: danamccool has eight fine-grained actions that each read the gallery, rewrite items and call updateUserGallery; ifac has one replace-all saveGalleryItemsAction. Image URL validation differs: danamccool addPictures requires /api/media/ and link text goes through cleanGalleryLink; ifac saves item urls as sent (so a public gallery can hot-link any URL). All routes end in services updateUserGallery.

### commerce createOrderFromCart / createOrder as the single order maker; one kit checkout action.

- apps (2): commerce, katie-the-potter
- hosts: 6; rows: 1; distinct service sets: 5

#### shop-checkout (orgapps.commerce.shop): Buy pieces (checkout)

2 app(s), 6 host(s): commerce, katie-the-potter.

Curator note: katie-the-potter only (the marketplace has its own checkout under art-auction app/checkout, left to G). Amounts are never accepted from the browser: lines come from the cart rows and the order total from commerce. placeOrder re-checks every line is still available because createOrder does not re-check artwork status; buyPieceNow checks it in sellableVariant.

### @elkdonis/astro-corpus/server#recordReview

- apps (2): astro-corpus, elastrocal
- hosts: 5; rows: 3; distinct service sets: 4

#### astro-question-review (apps.elastrocal): Answer a review-deck question

1 app(s), 2 host(s): elastrocal.

Curator note: The web studio and the app both end in recordReview with the reviewer taken from the session or token. The reasoning-explorer reviews use the same service with questionId null (astro-reasoning-review).

#### pkg-astro-corpus-reasoning-review (pkg.astro-corpus): Record a review of an interpretation chain, step or passage

1 app(s), 1 host(s): astro-corpus.

Curator note: backs apps.elastrocal.ts:astro-reasoning-review (also reached through recordReview)

#### pkg-astro-corpus-review-record (pkg.astro-corpus): Record a review-deck answer

1 app(s), 2 host(s): astro-corpus.

Curator note: backs apps.elastrocal.ts:astro-question-review

### commerce payee functions via the shared hub Business card.

- apps (2): arts-collective, ifac
- hosts: 5; rows: 2; distinct service sets: 5

#### add-charity-beneficiary (arts-collective.hub): Suggest a charity to receive a share of sales

1 app(s), 1 host(s): arts-collective.

Curator note: Same capability as orgapps.money:ifac-store-payees (that row maps the org-site apps; different hosts).

#### ifac-store-payees (orgapps.money): Manage the store's charity and beneficiary payees

1 app(s), 4 host(s): ifac.

Curator note: IFAC only; all four go through getIfacManager then a commerce function that takes actorUserId and is expected to authorise. Same capability as arts-collective.hub:add-charity-beneficiary (the arts-collective hosts); both rows share this canonical path.

### a services setProfileSection(userId, key, on) with an allow-list of keys (see profile-section-toggle in orgapps.people), one kit action; drop blogScope.

- apps (2): ifac, innergathering
- hosts: 4; rows: 1; distinct service sets: 3

#### profile-blog-set (orgapps.content): Turn my blog on or off

2 app(s), 4 host(s): ifac, innergathering.

Curator note: Two near-identical copies, each a raw merged UPDATE on users.profile_sections (blog, blogScope). Differences: gate (ifac getHubViewer: a member; innergathering getApiMember: member); the written href (ifac chooses /dealers or /artists from org_profiles.tags, innergathering always /artists, wrong for any dealer). The scope value is still written but no longer read since 2026-09-26 (comment). Same concept is also toggled by profile-section-toggle (key blog) in other apps, so there are three routes to profile_sections.blog.

### commerce addToCart via one kit action.

- apps (2): commerce, katie-the-potter
- hosts: 4; rows: 1; distinct service sets: 2

#### cart-add-piece (orgapps.commerce.shop): Add a piece to the cart

2 app(s), 4 host(s): commerce, katie-the-potter.

Curator note: katie-the-potter only. The action reads the sellable variant from the database (store, price > 0, status available): the browser sends only the artwork id.

### createBooking / startBookingCheckout of packages/booking and packages/checkout, as the single booking path for every site and for elktours departures.

- apps (2): artdirect, booking
- hosts: 4; rows: 1; distinct service sets: 3

#### booking-offer-book (orgapps.commerce.booking): Book a time on a bookable offering

2 app(s), 4 host(s): artdirect, booking.

Curator note: artdirect only has a UI for it today. Capacity: createBooking recounts seats under the slot lock (good). The order is created after the booking and linked; a failure releases the hold. markBookingPaid (called by confirmOrderPaid) revives a booking whose hold expired when the money lands, so an expired hold that is then paid can overlap another booking (logged only).

### one kit action over services updateUserGallery with a patch object, gate by gallery ownership.

- apps (2): danamccool, ifac
- hosts: 4; rows: 1; distinct service sets: 3

#### gallery-details-save (orgapps.content): Change a gallery's title, description, page or privacy

2 app(s), 4 host(s): danamccool, ifac.

Curator note: ifac splits it into three actions (field, public, settings) with the owner-or-admin gate; danamccool has one action with owner-or-guide gate and extra fields (showOnIfac, pagePath). ifac settings go through sanitizeThemeVars; titles are length-capped in neither read copy (services decides). All call services updateUserGallery.

### packages/auth-server handlers mounted once per app (already shared).

- apps (2): hidden-enneagram, ifac
- hosts: 4; rows: 1; distinct service sets: 3

#### he-sign-in-out (apps.hidden-enneagram.site): Sign in and out of the site

2 app(s), 4 host(s): hidden-enneagram, ifac.

Differences:

- ifac (was ifac-sign-in-out): hidden-enneagram login is handleLogin(req) with no joinOrgs (does not enrol the person as a viewer); ifac enrols every login as viewer. Both are mounts of packages/auth-server.

### services pinThread(org, id, on) behind the kit action; one pin concept for the network (threads.pinned).

- apps (2): amrit-canada, elktours
- hosts: 4; rows: 1; distinct service sets: 2

#### manage-content-pin (orgapps.cms): Pin a post to the top of the landing page

2 app(s), 4 host(s): amrit-canada, elktours.

Curator note: Byte-identical in amrit-canada and elktours. sunjay, innergathering and hidden-enneagram have no pin action; arts-collective's togglePinAction is a different host (other agents).

### services updateProfile with url validation inside, behind the edit-my-profile kit action; ownership by canEditProfile.

- apps (2): artdirect, ifac
- hosts: 4; rows: 1; distinct service sets: 3

#### profile-field-save (orgapps.editing): Edit my bio or photo on my page

2 app(s), 4 host(s): artdirect, ifac.

Curator note: ifac and artdirect are a copy with the session lookup (getServerSession vs getCurrentUser) and revalidate paths (/artists|/dealers/<slug> vs /<slug>) swapped. Gate in both: canEditProfile (the person or a global admin), so an org owner cannot edit a member's profile here. avatarUrl is stored unvalidated (as in edit-my-profile).

### startBookingCheckout on the booking tables.

- apps (2): commerce, elktours
- hosts: 4; rows: 1; distinct service sets: 4

#### tour-places-book (orgapps.commerce.booking): Book places on a tour

2 app(s), 4 host(s): commerce, elktours.

Curator note: Two flows behind BOOKING_TABLES: startTourCheckout (order first, then locked tour_bookings insert) and startBookingCheckout (locked booking first, then order). Price is never taken from the client: createThreadOrder prices per person from the thread and quantity is party size (1-20, tour maxParty), so the total cannot be altered. The order is created before the departure is locked in the legacy flow, so a full departure leaves an unpaid orphan order that expires later.

### commerce addStoreMemberByEmail / removeStoreMember with canManageStoreTeam inside both.

- apps (2): arts-collective, ifac
- hosts: 3; rows: 2; distinct service sets: 3

#### add-store-team-member (arts-collective.hub): Add someone to the store team

1 app(s), 1 host(s): arts-collective.

Curator note: Same capability as orgapps.money:ifac-store-team (that row maps the org-site apps; different hosts).

#### ifac-store-team (orgapps.money): Change the store's team

1 app(s), 2 host(s): ifac.

Curator note: Within the file, removal re-checks canManageStoreTeam(viewer, store.id) before removing, but addIfacStoreMemberAction only checks the ifac-manager gate and relies on commerce addStoreMemberByEmail (actorUserId) to check; the two are not symmetrical. Same capability as arts-collective.hub:add-store-team-member (the arts-collective hosts); both rows share this canonical path.

### packages/booking cancelAs with refund-due, then a single approved refund action.

- apps (2): artdirect, booking
- hosts: 3; rows: 1; distinct service sets: 3

#### booking-cancel (orgapps.commerce.booking): Cancel a booking

2 app(s), 3 host(s): artdirect, booking.

Curator note: Booker cancel is by token and refused once scheduled_at has passed; host cancel needs the session user to be the offer host. No payment is moved by either.

### packages/booking hostConfirmTime / bookerConfirmTime behind one kit action per side.

- apps (2): artdirect, booking
- hosts: 3; rows: 1; distinct service sets: 3

#### booking-time-confirm (orgapps.commerce.booking): Confirm a time for a booking

2 app(s), 3 host(s): artdirect, booking.

Curator note: Host path authorises by the session user = offers.host_user_id (lockBooking kind host); booker path by the private buyer token (bearer). Same transition function confirmAs.

### packages/booking proposeAs behind one kit action.

- apps (2): artdirect, booking
- hosts: 3; rows: 1; distinct service sets: 3

#### booking-times-propose (orgapps.commerce.booking): Suggest other times for a booking

2 app(s), 3 host(s): artdirect, booking.

Curator note: As booking-time-confirm: host by session + offer host, booker by token.

### services createUserGallery behind one kit action taking {ownerResolver, origin, defaults}; ownership always read from the row.

- apps (2): danamccool, ifac
- hosts: 3; rows: 1; distinct service sets: 2

#### gallery-create (orgapps.content): Start a new gallery

2 app(s), 3 host(s): danamccool, ifac.

Curator note: Same services createUserGallery, two shapes. ifac: actor is the profile owner or a global admin (canEditProfile) acting on profileUserId passed from the client, gallery starts as services default (public? not read) with origin ifac. danamccool: any owner or guide of the site acts on the SITE OWNER's galleries (getSiteOwnerUserId), so a guide edits the owner's personal galleries; starts private, hidden_on ifac, a storage folder. Different default visibility.

### services saveBookingOffer behind a Studio section (design section 2).

- apps (2): artdirect, booking
- hosts: 3; rows: 1; distinct service sets: 3

#### booking-offer-save (orgapps.commerce.booking): Save how a service is booked

2 app(s), 3 host(s): artdirect, booking.

Curator note: artdirect only. The action checks signed-in only; services saveBookingOffer enforces canEditBookingOffer (verified, booking-offers.ts:62), and saveOffer re-checks the thread belongs to the org.

### services uploadUserFile with validateUploadBuffer and a per-app authorizer.

- apps (2): artdirect, danamccool
- hosts: 3; rows: 2; distinct service sets: 3

#### artdirect-image-upload (apps.artdirect.dossier): Upload a picture to my page

1 app(s), 1 host(s): artdirect.

Curator note: Upload family (ifac api/upload, hidden-enneagram api/upload, danamccool api/media/upload). artdirect has the cleanest gate: authorised by canEditProfile of the slug, no editor override. Note it writes the whole portfolio array (read then write, not atomic).

#### dana-media-upload (apps.danamccool.site): Upload a picture to the site

1 app(s), 2 host(s): danamccool.

Curator note: Upload family (ifac api/upload, artdirect api/upload, hidden-enneagram api/upload). Here the destination is the owner personal folder under the site org, whoever uploads.

### services upsertWorkshopOffering plus the autosave guard moved into services (as meeting and post already do).

- apps (2): arts-collective, innergathering
- hosts: 3; rows: 1; distinct service sets: 3

#### workshop-save (orgapps.meetings): Save a workshop offering

2 app(s), 3 host(s): arts-collective, innergathering.

Differences:

- arts-collective (was save-workshop): no drift recorded
- innergathering (was ig-workshop-save): also revalidates /, the section, the piece and /hub; same service call.

> Direction (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.

### the booking module with a capacity-locked createBooking, or services RSVP + startThreadCheckout.

- apps (2): commerce, inner-gathering
- hosts: 3; rows: 1; distinct service sets: 3

#### workshop-join (orgapps.commerce.shop): Join a workshop (free or paid)

2 app(s), 3 host(s): commerce, inner-gathering.

Curator note: inner-gathering (the hyphenated app, likely legacy next to innergathering) only. The price is read from the database; the amount row workshop_join_requests.amount_minor is computed from it.

### @elkdonis/newsletter deleteNewsletter.

- apps (2): hidden-enneagram, ifac
- hosts: 2; rows: 1; distinct service sets: 1

#### he-newsletter-delete (apps.hidden-enneagram.site): Delete a newsletter letter

2 app(s), 2 host(s): hidden-enneagram, ifac.

Differences:

- ifac (was ifac-series-mailing-delete): As he-newsletter-delete, with the series audience.

### auth-server logout handler (shared)

- apps (2): admin, fourthwayBookreaders
- hosts: 2; rows: 1; distinct service sets: 1

#### fourthway-logout (apps.fourthwayBookreaders.site): Sign out

2 app(s), 2 host(s): admin, fourthwayBookreaders.

Differences:

- admin (was admin-logout): the GET handler in the same file is NOT shared (only a plain signOut).

### clearOrgTemplate behind the same shared kit route as save-email-template

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-email-template-reset (apps.innergathering.hub): Put an email back to the default wording

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-email-template-reset): arts-collective save-email-template covers save only; reset is a separate DELETE here.

### commerce chooseOrderShipping.

- apps (2): art-auction, commerce
- hosts: 2; rows: 1; distinct service sets: 2

#### order-shipping-choose (orgapps.commerce.shipping): Choose shipping for an unpaid marketplace order

2 app(s), 2 host(s): art-auction, commerce.

Curator note: Server-side: the amount comes from the quote matched by option id (not from the client) and the write is guarded to unpaid statuses. An eTransfer order has its instructions rewritten with the new total.

### commerce openOrgStore via a shared hub Business card action when other orgs get stores.

- apps (2): arts-collective, ifac
- hosts: 2; rows: 2; distinct service sets: 2

#### ifac-store-open (orgapps.money): Open the organisation's store

1 app(s), 1 host(s): ifac.

Curator note: IFAC only. Gate is getIfacManager = canManageIfac (ownerEmails allowlist, global admin, or owner/guide row; ifac now has 2 owners and 4 guides), the same broad gate as the ifac questionnaire. Same capability as arts-collective.hub:open-org-store (the arts-collective hosts); both rows share this canonical path.

#### open-org-store (arts-collective.hub): Open the organisation's store

1 app(s), 1 host(s): arts-collective.

Curator note: Person store: runner `store` (publishStoreForAuction); org store: openOrgStore. Same capability as orgapps.money:ifac-store-open (that row maps the org-site apps; different hosts).

### commerce removeCartLine with the ownership check moved inside.

- apps (2): commerce, katie-the-potter
- hosts: 2; rows: 1; distinct service sets: 2

#### shop-cart-remove-line (orgapps.commerce.shop): Remove a piece from the cart

2 app(s), 2 host(s): commerce, katie-the-potter.

Curator note: The action checks that the line belongs to the cart token (cartOwnsLine); removeCartLine itself does not.

### createDeletionRequestHandler (shared); mount only

- apps (2): arts-collective, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### request-data-deletion (arts-collective.network): Ask for your data to be deleted

2 app(s), 2 host(s): arts-collective, innergathering.

Differences:

- innergathering (was ig-data-deletion-ask): 14 diff lines, the notify email body is built here by hand.

### one shared kit route for the email suite

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-email-template-test (apps.innergathering.hub): Send yourself a test of an email

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-email-template-test): No arts-collective row found for test send. Recipient is the editor own account email, not an input.

### packages/actions server/channel.ts fillSlot

- apps (2): katie-the-potter, sunjay
- hosts: 2; rows: 1; distinct service sets: 1

#### sunjay-channel-slot-fill (apps.sunjay.hub): Fill a routine slot

2 app(s), 2 host(s): katie-the-potter, sunjay.

Differences:

- katie-the-potter (was katie-channel-slot-fill): one host serves six entries (SITE_DOOR_ALLOW).

### page-builder saveUserPage

- apps (2): art-auction, page-builder
- hosts: 2; rows: 2; distinct service sets: 2

#### market-store-panel-save (apps.art-auction.rest): Save a store panel draft

1 app(s), 1 host(s): art-auction.

Curator note: Same page-builder writer (saveUserPage) as the ArtDirect person pages (artdirect-person-page-draft-save) and the IFAC store panels; this is the art-auction copy of the editor page.

#### pkg-page-builder-user-page-save (pkg.page-builder): Write a person’s own page draft

1 app(s), 1 host(s): page-builder.

Curator note: backs apps.art-auction.rest.ts:market-store-panel-save and apps.artdirect.dossier.ts:artdirect-person-page-draft-save

### services assignMeetingRole behind one shared kit route

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-meeting-rota-assign (apps.innergathering.hub): Put someone on a meeting’s rota

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-meeting-host-assign): Only ifac and sunjay-style rota; no hidden-enneagram copy.

### services clearMeetingLight behind one shared kit route

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-meeting-light-clear (apps.innergathering.hub): Clear the light on a meeting

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-meeting-light-clear): See ifac-meeting-light-set.

### services clearMeetingRole behind one shared kit route

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-meeting-rota-clear (apps.innergathering.hub): Take someone off a meeting’s rota

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-meeting-host-clear): See ifac-meeting-host-assign.

### services createCategory via handleForumAction

- apps (2): amrit-canada, sunjay
- hosts: 2; rows: 1; distinct service sets: 1

#### sunjay-forum-category-add (apps.sunjay.hub): Add a forum category

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-forum-category-add): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-category-add); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services createSiteSeries behind the shared org-site kit action; zones from siteConfig.

- apps (2): ifac, sunjay
- hosts: 2; rows: 1; distinct service sets: 1

#### org-series-create (orgapps.meetings): Start a new series

2 app(s), 2 host(s): ifac, sunjay.

Curator note: Near-identical. Both check siteOrg and viewer.canEdit (sunjay via getViewer().canEdit; ifac via getHubViewer, which is member-gated first, then canEdit = owner or guide). Differences: the extra display zones (sunjay [siteConfig.timeZone]; ifac hard-coded ALSO_ZONES Los_Angeles/New_York/Paris), and revalidatePath (sunjay /hub,/hub/series,/manage; ifac adds /). Auth is equally strong in both (explicit canEdit).

### services createThread (createPostAnywhere should call it)

- apps (2): arts-collective, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### post-to-a-site (arts-collective.hub): Post to a site from anywhere

2 app(s), 2 host(s): arts-collective, innergathering.

Differences:

- innergathering (was ig-post-create): blog is homed in this site’s org (blogOrgId = inner_group) instead of PERSONAL_ORG_ID (ArtDirect); blog link is a relative /artists/<slug>/writing/<piece>, other-org link is built from the org’s own domain; a post to this org links to /forum/t/<id>/<slug> here.

### services deleteUserGallery behind the kit action.

- apps (2): danamccool, ifac
- hosts: 2; rows: 1; distinct service sets: 2

#### gallery-delete (orgapps.content): Delete a gallery

2 app(s), 2 host(s): danamccool, ifac.

Curator note: Same services deleteUserGallery; gate differs as in gallery-create (profile owner or global admin in ifac, owner or guide of the site in danamccool). Hard delete of the row in both (not read in services).

### services proposeTopic via handleForumAction

- apps (2): amrit-canada, sunjay
- hosts: 2; rows: 1; distinct service sets: 1

#### sunjay-forum-topic-propose (apps.sunjay.hub): Propose a forum topic tag

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-forum-topic-propose): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-topic-propose); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services removeThread via handleForumAction

- apps (2): amrit-canada, sunjay
- hosts: 2; rows: 1; distinct service sets: 1

#### sunjay-forum-topic-remove (apps.sunjay.hub): Take down my own forum topic

2 app(s), 2 host(s): amrit-canada, sunjay.

Differences:

- amrit-canada (was amrit-forum-topic-remove): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-topic-remove); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).

> amrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.

### services saveOccurrenceRecord behind one shared kit route

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-meeting-record-save (apps.innergathering.hub): Write up what happened at a meeting

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-meeting-record-save): Light and rota planning have host-or-editor rules; the record has none.

### services saveUserTheme via the kit.

- apps (2): arts-collective, ifac
- hosts: 2; rows: 1; distinct service sets: 2

#### user-theme-save (orgapps.site-style): Change my own profile look

2 app(s), 2 host(s): arts-collective, ifac.

Differences:

- arts-collective (was save-my-theme): no drift recorded

### services setMeetingLight / isOccurrenceHost behind one shared kit route

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-meeting-light-set (apps.innergathering.hub): Set the light on a meeting

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-meeting-light-set): Owner/guide may set any; a member only for an occurrence they host (isOccurrenceHost). Compare ig-meeting-record-save, which has no host gate.

### services setOccurrencePlan behind one shared kit route

- apps (2): ifac, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### ig-meeting-plan-save (apps.innergathering.hub): Say what a week’s meeting covers

2 app(s), 2 host(s): ifac, innergathering.

Differences:

- ifac (was ifac-meeting-plan-set): Editor or that week's host or co-host.

### services setPresence

- apps (2): arts-collective, innergathering
- hosts: 2; rows: 1; distinct service sets: 2

#### set-where-i-show (arts-collective.hub): Choose where I show

2 app(s), 2 host(s): arts-collective, innergathering.

Differences:

- innergathering (was ig-presence-set): session helper only (8 diff lines).

### setOrgPortfolio (per org) behind one kit action; the global portfolio is the fallback when an org has none.

- apps (2): artdirect, ifac
- hosts: 2; rows: 1; distinct service sets: 2

#### profile-portfolio-save (orgapps.editing): Arrange the pictures on my page

2 app(s), 2 host(s): artdirect, ifac.

Curator note: Different stores: ifac writes the per-org portfolio (setOrgPortfolio) and requires roster membership; artdirect writes the global users portfolio via updateProfile. Item urls stored as sent in both.

### the page-save kit action with slug = LANDING_SLUG.

- apps (2): elktours, sunjay
- hosts: 2; rows: 1; distinct service sets: 2

#### landing-save (orgapps.editing): Publish the home page tree

2 app(s), 2 host(s): elktours, sunjay.

Curator note: Same as page-save with a fixed slug. sunjay revalidates "/", elktours does not revalidate at all (the home page may stay stale until its cache expires).

### packages/lms-ui handleLmsAction (already shared)

- apps (1): sophia
- hosts: 29; rows: 5; distinct service sets: 29

#### sophia-course-author (apps.sophia): Author and run a course

1 app(s), 8 host(s): sophia.

Curator note: copy of arts-collective.learn:create-course, save-course, publish-course, create-course-run, save-course-run, set-workshop-listing, sync-run-rsvps, set-realm; differs: none in code (same lms-ui handler), different host app and connectors (sophia supplies its own uploadMedia, hrefs and taskElsewhere).

#### sophia-course-authoring-internal (apps.sophia): Edit a course outline, step or pool

1 app(s), 6 host(s): sophia.

Curator note: copy of arts-collective.learn:edit-course-outline, save-course-step, upload-course-media, add-to-course-pool, edit-course-pool-item, use-course-pool-item; differs: none in code (same lms-ui handler), different host app and connectors (sophia supplies its own uploadMedia, hrefs and taskElsewhere).

#### sophia-course-guide (apps.sophia): Guide a course group

1 app(s), 5 host(s): sophia.

Curator note: copy of arts-collective.learn:acknowledge-response, waive-step, open-course-discussions, adopt-latest-version, add-run-guide; differs: none in code (same lms-ui handler), different host app and connectors (sophia supplies its own uploadMedia, hrefs and taskElsewhere).

#### sophia-course-learn (apps.sophia): Take a course

1 app(s), 5 host(s): sophia.

Curator note: copy of arts-collective.learn:begin-course, complete-step, respond-to-step, delete-response, withdraw-from-course; differs: none in code (same lms-ui handler), different host app and connectors (sophia supplies its own uploadMedia, hrefs and taskElsewhere).

#### sophia-registry-admin (apps.sophia): Curate traditions and listed guides

1 app(s), 5 host(s): sophia.

Curator note: copy of arts-collective.learn:save-tradition, delete-tradition, add-listed-guide, save-listed-guide, remove-listed-guide; differs: none in code (same lms-ui handler), different host app and connectors (sophia supplies its own uploadMedia, hrefs and taskElsewhere).

### one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)

- apps (1): fourthwayBookreaders
- hosts: 27; rows: 22; distinct service sets: 26

#### fourthway-circle-cover-save (apps.fourthwayBookreaders.circle): Choose the circle's cover picture

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-create (apps.fourthwayBookreaders.circle): Start a reading group

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere. Related to elktours/ifac "create a series" (orgapps.meetings:org-series-create): a different model (reading_group thread with circle metadata, not a series).

#### fourthway-circle-excerpt-save (apps.fourthwayBookreaders.circle): Post or clear the home-page passage

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-featured-set (apps.fourthwayBookreaders.circle): Feature a group on the home page

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-schedule-save (apps.fourthwayBookreaders.circle): Set a circle's schedule

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-space-setup (apps.fourthwayBookreaders.circle): Set up the circle's space

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere. createReadingGroup also calls ensureCircleSpace (best effort); this is the retry.

#### fourthway-circle-stop-record (apps.fourthwayBookreaders.circle): Record where the group stopped

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-structure-save (apps.fourthwayBookreaders.circle): Write the circle's structure

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-unit-move (apps.fourthwayBookreaders.circle): Move a reading up or down

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-unit-remove (apps.fourthwayBookreaders.circle): Remove a reading from the plan

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-unit-status (apps.fourthwayBookreaders.circle): Set a reading as planned, done or skipped

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-circle-units-add (apps.fourthwayBookreaders.circle): Add readings to a circle's plan

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-group-bookmark-set (apps.fourthwayBookreaders.circle): Move a group's bookmark

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere. recordCircleStopAction is the circle-model way to say where a sitting stopped; this older group panel writes metadata.currentPage directly.

#### fourthway-group-sitting-record (apps.fourthwayBookreaders.circle): Record a sitting as a post

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere. Overlaps recordCircleStopAction and saveSessionNotes: three ways to record a sitting (old group panel, circle manage, circle sessions).

#### fourthway-session-comment-post (apps.fourthwayBookreaders.circle): Comment on a sitting

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-doc-create (apps.fourthwayBookreaders.circle): Start a sitting's shared document

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-host-set (apps.fourthwayBookreaders.circle): Choose who hosts a sitting

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-notes-save (apps.fourthwayBookreaders.circle): Write a sitting's notes

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-plan-save (apps.fourthwayBookreaders.circle): Say what a sitting is for

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-rsvp (apps.fourthwayBookreaders.circle): Say you are coming to a sitting

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-stage (apps.fourthwayBookreaders.circle): Open session topics ahead of time

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

#### fourthway-session-thread-start (apps.fourthwayBookreaders.circle): Start a thread from a sitting

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: Only fourthwayBookreaders has reading circles; no copies elsewhere.

### lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern

- apps (1): fourthwayBookreaders
- hosts: 12; rows: 7; distinct service sets: 9

#### fourthway-paath-call-record (apps.fourthwayBookreaders.paath): Start or stop recording the call

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

#### fourthway-paath-day-note-save (apps.fourthwayBookreaders.paath): Write the day's note

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

#### fourthway-paath-note-add (apps.fourthwayBookreaders.paath): Leave a thought on a passage

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

#### fourthway-paath-note-remove (apps.fourthwayBookreaders.paath): Remove my own thought

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

#### fourthway-paath-read (apps.fourthwayBookreaders.paath): Check a passage off as read

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

#### fourthway-paath-recording-upload (apps.fourthwayBookreaders.paath): Save a recorded reading

1 app(s), 1 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

#### fourthway-paath-unread (apps.fourthwayBookreaders.paath): Put passages back as unread

1 app(s), 2 host(s): fourthwayBookreaders.

Curator note: No copy elsewhere: the Akhand Path is a fourthwayBookreaders-only reading of the Guru Granth Sahib over circle_units (see project SGGS corpus).

### extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks

- apps (1): katie-the-potter
- hosts: 6; rows: 3; distinct service sets: 5

#### katie-claim-link-create (apps.katie-the-potter.claim): Create the hand-over link

1 app(s), 2 host(s): katie-the-potter.

Curator note: No other app has a claim link (elktours business_claims is a different mechanism; the session doc item 9 says extraction to @elkdonis/services/claim-links is on hold).

#### katie-claim-link-revoke (apps.katie-the-potter.claim): Cancel the hand-over link

1 app(s), 2 host(s): katie-the-potter.

Curator note: No other app has a claim link (elktours business_claims is a different mechanism; the session doc item 9 says extraction to @elkdonis/services/claim-links is on hold).

#### katie-claim-redeem (apps.katie-the-potter.claim): Take over the site with a hand-over link

1 app(s), 2 host(s): katie-the-potter.

Curator note: No other app has a claim link (elktours business_claims is a different mechanism; the session doc item 9 says extraction to @elkdonis/services/claim-links is on hold).

### packages/actions performHubAction (the registry door)

- apps (1): sunjay
- hosts: 6; rows: 6; distinct service sets: 1

#### sunjay-site-identity-save (apps.sunjay.hub): Save the identity card

1 app(s), 1 host(s): sunjay.

Curator note: thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).

#### sunjay-site-page-create (apps.sunjay.hub): Add a page

1 app(s), 1 host(s): sunjay.

Curator note: thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).

#### sunjay-site-page-meta-save (apps.sunjay.hub): Save page notes and settings

1 app(s), 1 host(s): sunjay.

Curator note: thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).

#### sunjay-site-section-save (apps.sunjay.hub): Save a page's copy

1 app(s), 1 host(s): sunjay.

Curator note: thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).

#### sunjay-site-template-save (apps.sunjay.hub): Save a page as a template

1 app(s), 1 host(s): sunjay.

Curator note: thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).

#### sunjay-site-theme-exception-remove (apps.sunjay.hub): Remove a page's colour exception

1 app(s), 1 host(s): sunjay.

Curator note: thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).

### one experience writer in services with an artist and an office entry

- apps (1): elktours
- hosts: 4; rows: 2; distinct service sets: 3

#### elktours-experience-draft-save (apps.elktours.wizards): Save your experience draft

1 app(s), 2 host(s): elktours.

Curator note: Differs from the office writer elktours-experience-save: artists cannot set status, visibility or cover; an artist may only change their own draft (author or linked artist), checked in the SELECT.

#### elktours-experience-save (apps.elktours.experiences): Save an experience

1 app(s), 2 host(s): elktours.

Curator note: Different from the tour save (tour-actions saveTourAction) and the artist draft save (elktours-experience-draft-save): three writers of the same thread kind with different fields.

### services artistProfile module

- apps (1): arts-collective
- hosts: 4; rows: 2; distinct service sets: 2

#### save-business-wizard (arts-collective.network): Save your business questionnaire as you go

1 app(s), 2 host(s): arts-collective.

Curator note: See artist-wizard-save.

#### submit-business-wizard (arts-collective.network): Finish your business questionnaire

1 app(s), 2 host(s): arts-collective.

Curator note: See artist-wizard-save.

### services handleUserProvisioning

- apps (1): admin
- hosts: 4; rows: 2; distinct service sets: 2

#### admin-nextcloud-sync-user (apps.admin): Create one user’s Nextcloud account

1 app(s), 2 host(s): admin.

Curator note: Same provisioning service as arts-collective.network:link-cloud-sign-in (the person’s own path) and the bulk route below; only the group differs (this one always uses EAC_Network, the bulk one uses org ids).

#### admin-nextcloud-sync-users (apps.admin): Create Nextcloud accounts for every unsynced user

1 app(s), 2 host(s): admin.

Curator note: Bulk twin of admin-nextcloud-sync-user; the group list differs (org ids vs EAC_Network).

### @elkdonis/page-builder/server#savePage

- apps (1): elktours
- hosts: 3; rows: 2; distinct service sets: 3

#### elktours-experience-default-layout-publish (apps.elktours.experiences): Publish the default experience page layout

1 app(s), 2 host(s): elktours.

Curator note: Same shape as publishTourLayoutAction (tours file); both write site_config puck:<slug> but through different writers (one through page-builder savePage, one direct SQL).

#### elktours-tour-layout-publish (apps.elktours.tours): Publish the tour page layout

1 app(s), 1 host(s): elktours.

Curator note: Same job as publishExperienceDefaultLayoutAction (elktours-experience-default-layout-publish) but that one writes site_config directly; this one uses the shared page-builder savePage.

### @elkdonis/services#reviewThread

- apps (1): elktours
- hosts: 3; rows: 2; distinct service sets: 3

#### elktours-experience-decide (apps.elktours.wizards): Decide on an artist experience

1 app(s), 2 host(s): elktours.

Curator note: Feed posts use the same pattern in elktours-feed-post-review (owner decides through reviewThread).

#### elktours-feed-post-review (apps.elktours.site): Confirm or decline a guide post

1 app(s), 1 host(s): elktours.

Curator note: Same pattern as elktours-experience-decide: owner decides through reviewThread with approverRoles owner.

### commerce/server booking functions, with one action file per host

- apps (1): arts-collective
- hosts: 3; rows: 3; distinct service sets: 3

#### confirm-booking-time (arts-collective.hub): Confirm a time for a booking

1 app(s), 1 host(s): arts-collective.

Curator note: Buyer side of the same booking: arts-collective.network:confirm-booking-time-as-buyer (the buyer’s confirm takes payment; the seller’s does not).

#### confirm-booking-time-as-buyer (arts-collective.network): Confirm a booking time (buyer)

1 app(s), 1 host(s): arts-collective.

Curator note: Seller side: arts-collective.hub:confirm-booking-time.

#### propose-booking-times-as-buyer (arts-collective.network): Suggest other times (buyer)

1 app(s), 1 host(s): arts-collective.

Curator note: Seller side of the same flow is agent B’s app/hub/bookings/actions.ts (propose, confirm, cancel); both call commerce/server.

### one server action over services setOrgRole/removeOrgMember that takes an org id and checks isOrgOwner (see sites.members capability)

- apps (1): arts-collective
- hosts: 3; rows: 3; distinct service sets: 2

#### add-pureland-member (arts-collective.media): Give someone access to Pureland

1 app(s), 1 host(s): arts-collective.

Curator note: The same setOrgRole and removeOrgMember are called from api/org/[slug]/members, the hub members panel, cms/org-people-actions and here, each with its own role check.

#### change-pureland-role (arts-collective.media): Change someone’s Pureland role

1 app(s), 1 host(s): arts-collective.

Curator note: The same setOrgRole and removeOrgMember are called from api/org/[slug]/members, the hub members panel, cms/org-people-actions and here, each with its own role check.

#### remove-pureland-member (arts-collective.media): Remove someone from Pureland

1 app(s), 1 host(s): arts-collective.

Curator note: The same setOrgRole and removeOrgMember are called from api/org/[slug]/members, the hub members panel, cms/org-people-actions and here, each with its own role check.

### one shared upload route in services with a policy per role

- apps (1): elktours
- hosts: 3; rows: 2; distinct service sets: 3

#### elktours-upload-forum-media (apps.elktours.hub-api): Add a photo or video to a forum post

1 app(s), 2 host(s): elktours.

Curator note: Narrower sibling of elktours-upload-media.

#### elktours-upload-media (apps.elktours.hub-api): Upload a file for the site

1 app(s), 1 host(s): elktours.

Curator note: Close to the inner-gathering route; /api/upload/forum is a narrower copy for followers.

### services reviewListing

- apps (1): arts-collective
- hosts: 2; rows: 2; distinct service sets: 1

#### approve-post-from-other-site (arts-collective.hub): Show a post from another site

1 app(s), 1 host(s): arts-collective.

Curator note: Org side of choose-sites-for-post (the poster’s side). Not the same as answer-listing-request (people list).

#### decline-post-from-other-site (arts-collective.hub): Turn down a post from another site

1 app(s), 1 host(s): arts-collective.

### (no canonical recorded)

338 rows have no canonical path recorded yet (mostly single-app writers); ids: about-media-upload, about-page-save, accept-agreement, accept-terms, acknowledge-response, add-associated-org, add-channel-routine, add-channel-todo, add-email-contacts, add-facebook-page, add-listed-guide, add-org-beneficiary, add-quote, add-run-guide, add-to-course-pool, admin-contact-status-set, admin-content-moderate, admin-nextcloud-files, admin-nextcloud-setup-folders, admin-nextcloud-talk, admin-nextcloud-upload, admin-oidc-issue-code, admin-oidc-token-exchange, admin-org-grant-set, admin-work-question-set, adopt-latest-version, answer-listing-request, app-records-sync, approve-beneficiary, archive-channel-routine, archive-social-post, archive-video-project, arrival-respond-route, artwork-archive, artwork-favorite-toggle, artwork-hide, artwork-present, artwork-publish, artwork-unpresent, artwork-update, astro-claim-review, astro-correspondence-cell-add, astro-foundation-item-add, astro-foundation-review, astro-interpretation-create, astro-interpretation-requeue, astro-library-note, astro-passage-mark-delete, astro-question-interpretation-create, astro-reasoning-review, astro-reference-vote, astro-vocab-review, astro-vocab-term-add, begin-course, bidder-register, book-outline-save, booking-hold-lifecycle, cancel-booking, capture-from-phone, cart-add, cart-remove-line, chart-cache-refresh, chart-delete, chart-guest-claim, chart-save, chart-update, check-social-account, collect-page-pulse, commerce-internal-writes, complete-step, confirm-org-address, connect-social-account, control-broadcast-booth, create-course, create-course-run, create-pen-name, create-video-project, delete-my-file, delete-org-file, delete-quote, delete-recording, delete-response, delete-tradition, device-link, device-unlink, disconnect-social-account, dock-course-choose, dock-step-leave-return, dock-step-record, draft-agreement, eac-site-inquiry-record, edit-agreement-draft, edit-associated-org, edit-channel-routine, edit-course-outline, edit-course-pool-item, edit-email-contact, edit-social-account, edit-social-post, edit-workshop-live, elktours-artist-availability-save, elktours-asset-archive, elktours-asset-copy-to-stop, elktours-asset-save, elktours-asset-visible-set, elktours-business-claim-decide, elktours-business-facts-save, elktours-business-link-place, elktours-business-remove, elktours-business-restore, elktours-business-unlink-place, elktours-experience-link-to-stop, elktours-experience-people-set, elktours-experience-status-set, elktours-experience-submit, elktours-flyover-accept, elktours-flyover-cancel, elktours-flyover-reject, elktours-flyover-request, elktours-flyover-requeue, elktours-flyover-worker, elktours-forum-prefs, elktours-forum-topic-audience, elktours-hero-lead-set, elktours-invitation-respond, elktours-place-add-from-search, elktours-place-archive, elktours-place-create-from-pin, elktours-place-favourite-toggle, elktours-place-link-approve, elktours-place-link-reject, elktours-place-photo-discard, elktours-place-photo-pin, elktours-place-update-from-stop, elktours-place-website-set, elktours-review-delete-own, elktours-review-hide, elktours-review-save, elktours-settings-save, elktours-stop-excerpt-set, elktours-stop-note-add, elktours-stop-note-delete, elktours-stop-note-promote, elktours-suggest-lead, elktours-suggest-route, elktours-suggest-spot, elktours-suggestion-accept, elktours-suggestion-reject, follow-organisation, forum-drawing-save, forum-moderate, forum-react, forum-wiki-edit, go-live-relay, home-hero-save, home-welcome-save, installation-create, installation-delete, installation-layout-save, installation-publish-toggle, installation-rename, installation-scene-save, installation-venue-set, jerusalem-media-upload, jerusalem-video-publish, lamrim-review-delete, lamrim-review-save, landing-loft-publish, landing-loft-revert, landing-loft-save, link-cloud-sign-in, log-pureland-diagnostics, lot-cancel, mark-inbox-message, market-store-apply, market-store-profile-save, market-store-team-remove, marketplace-settings-save, message-artist, message-mark-read, message-send, never-suggest, nextcloud-access-sync-route, open-course-discussions, open-silex-editor, order-cancel, order-fulfil, order-mark-shipped, order-pay-card, order-pay-etransfer, order-place, order-refund, order-refund-record, order-tracking-record, parcel-save, pigeon-card-moderate, pigeon-card-rate, pigeon-card-report, pigeon-card-submit, pigeon-criterion-retire, pigeon-criterion-save, pigeon-guest-block, pigeon-guest-claim, pigeon-guest-create, pigeon-rate-event, pigeon-report-resolve, pigeon-species-promote, pigeon-species-status, pigeon-tier-save, pkg-astro-corpus-chart-cache, pkg-astro-corpus-claim-review, pkg-astro-corpus-draft-store, pkg-astro-corpus-engine-candidate, pkg-astro-corpus-foundation-add, pkg-astro-corpus-foundation-review, pkg-astro-corpus-interpretation-write, pkg-astro-corpus-library-note, pkg-astro-corpus-ref-vote, pkg-astro-corpus-seed-and-import, pkg-astro-corpus-vocab-write, pkg-auth-server-device-token-revoke, pkg-auth-server-device-token-use, pkg-blog-server-app-user-ensure, pkg-blog-server-post-media-attach, pkg-mcp-key-last-used, post-to-elkdonis-forum, propose-booking-times, publish-agreement, publish-course, publish-org-landing-page, publish-video, receive-email-events, reclassify-inbox-message, release-held-funds, remove-associated-org, remove-email-contact, remove-listed-guide, remove-meeting, remove-org-beneficiary, remove-org-landing-page, remove-store-team-member, rename-recording, render-video, respond-to-step, restore-pen-name, retire-agreement, retire-pen-name, review-vetting-response, revoke-agreement-acceptance, save-classifieds-page, save-course, save-course-run, save-course-step, save-email-template, save-feed-card-design, save-listed-guide, save-piece-plan, save-silex-layout, save-tradition, save-video-project, scenario-question-draft, send-org-contact-message, series-audience-route, series-create, series-editor-add, series-editor-remove, series-follow, series-hub-route, series-invitation-decide, series-listing-add, series-lot-attach, series-lot-create, series-lot-remove, series-lots-renumber, series-media-upload, series-media-upload-route, series-order-handover, series-order-received, series-org-invite, series-org-remove, series-publication-attach, series-publication-detach, series-reply, series-status-set, series-submit-own-piece, series-week-featured-set, series-week-item-add, series-week-item-approve, series-week-item-remove, serve-mcp, set-org-posting-channel, set-realm, set-up-relay-destinations, set-workshop-listing, ship-from-save, shipping-address-correct, shipping-label-buy, shipping-mark-shipped, shipping-mode-set, shipping-packing-save, shipping-rates-refresh, shipping-rechoose, shipping-shipment-internal, shipping-tracking-webhook, shop-order-cancel, shop-order-pay-card, shop-order-pay-etransfer, show-or-hide-quote, slot-booking-window, slot-run, stop-email-to-address, stop-relay, store-application-approve, store-application-reject, store-pause, store-shipping-mode-set, stripe-webhook-market, sync-run-rsvps, thread-admin-route, thread-gather-route, tick-channel-todo, tour-booking-cancel, tour-booking-defaults-save, tour-status-set, tour-stops-save, tour-type-set, unfollow-organisation, unpublish-video, upload-course-media, upload-org-file, upload-profile-photo, upload-recording, upload-reel-media, use-course-pool-item, use-video-extras, waive-step, weight-quote, withdraw-from-course

## Rows whose hosts call different services

### about-page-save (apps.art-auction.admin)

Save the About page.

- calls: (lib) saveAbout
  - `sa:apps/art-auction/src/app/about/actions.ts#saveAboutAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/about-content.ts#saveAbout`

### accept-channel-suggestion (arts-collective.channel)

Accept a suggested post. Canonical: `packages/actions server/channel.ts acceptSuggestion, called by all three actions`.

- calls: @elkdonis/actions/server#performSiteChannelAction
  - `sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction`
  - `sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction`
- calls: addChannelPlanStep, createChannelDelivery
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#acceptAdjustedAction`
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#acceptSuggestionAction`
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#acceptSuggestionsAction`

### add-email-contacts (arts-collective.hub)

Add people to the organisation's mailing list.

- calls: (getApiEditor: owner or guide), @elkdonis/email#addAddresses
  - `api:apps/ifac/src/app/api/hub/email/addresses/route.ts#POST`
- calls: @elkdonis/email#addAddresses
  - `api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#POST`
- calls: addAddresses
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#POST`

### admin-contact-status-set (apps.admin)

Mark a contact as contacted or joined.

- calls: (raw UPDATE contacts)
  - `api:apps/admin/src/app/api/contacts/route.ts#PATCH`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/auth-server#isAdmin, @elkdonis/db#db
  - `sql:apps/admin/src/app/api/contacts/route.ts#PATCH`

### admin-meeting-create (apps.admin)

Create a meeting from the admin app. Canonical: `services saveMeetingContent / createMeeting behind a kit action (see orgapps.meetings)`.

- calls: ./data#createMeeting
  - `sa:apps/admin/src/lib/actions.ts#createMeetingAction`
- calls: @elkdonis/db#db
  - `sql:apps/admin/src/lib/data.ts#createMeeting`

### admin-nextcloud-setup-folders (apps.admin)

Create Nextcloud folders for every organisation.

- calls: (raw UPDATE organizations), @/lib/nextcloud#webdavService.createOrgFolders
  - `api:apps/admin/src/app/api/nextcloud/setup-folders/route.ts#POST`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/auth-server#isAdmin, @elkdonis/db#db
  - `sql:apps/admin/src/app/api/nextcloud/setup-folders/route.ts#POST`

### admin-nextcloud-sync-user (apps.admin)

Create one user’s Nextcloud account. Canonical: `services handleUserProvisioning`.

- calls: @elkdonis/auth-server#getServerSession, @elkdonis/auth-server#isAdmin, @elkdonis/db#db, @elkdonis/services#handleUserProvisioning
  - `sql:apps/admin/src/app/api/nextcloud/sync-user/[userId]/route.ts#POST`
- calls: @elkdonis/services#handleUserProvisioning
  - `api:apps/admin/src/app/api/nextcloud/sync-user/[userId]/route.ts#POST`

### admin-nextcloud-sync-users (apps.admin)

Create Nextcloud accounts for every unsynced user. Canonical: `services handleUserProvisioning`.

- calls: @elkdonis/auth-server#getServerSession, @elkdonis/auth-server#isAdmin, @elkdonis/db#db, @elkdonis/services#handleUserProvisioning
  - `sql:apps/admin/src/app/api/nextcloud/sync-users/route.ts#POST`
- calls: @elkdonis/services#handleUserProvisioning
  - `api:apps/admin/src/app/api/nextcloud/sync-users/route.ts#POST`

### admin-oidc-token-exchange (apps.admin)

Exchange a code for a token, or mint a delegated token.

- calls: (raw DELETE oidc_codes)
  - `sql:apps/admin/src/lib/oidc.ts#validateAuthCode`
- calls: ./lib/oidc#validateAuthCode, generateDelegatedToken, generateIdToken
  - `api:apps/admin/src/app/api/oidc/token/route.ts#POST`

### admin-user-update (apps.admin)

Edit a user or make them a site administrator. Canonical: `a services setUserAdmin with a last-admin guard and an audit row`.

- calls: (raw UPDATE users), @elkdonis/auth-server#isAdmin
  - `api:apps/admin/src/app/api/users/[userId]/route.ts#PATCH`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/auth-server#isAdmin, @elkdonis/db#db
  - `sql:apps/admin/src/app/api/users/[userId]/route.ts#PATCH`

### admin-work-question-set (apps.admin)

Set the inner group’s question of the week.

- calls: (raw UPDATE + INSERT work_questions)
  - `api:apps/admin/src/app/api/work-question/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/admin/src/app/api/work-question/route.ts#POST`

### admin-workshop-promote (apps.admin)

Promote a meeting on the workshops page. Canonical: `one workshop-listing writer (the studio-workshop-listing case behind api/lms/[action])`.

- calls: (raw UPDATE threads)
  - `api:apps/admin/src/app/api/meetings/[id]/workshop/route.ts#PATCH`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/auth-server#isAdmin, @elkdonis/db#db
  - `sql:apps/admin/src/app/api/meetings/[id]/workshop/route.ts#PATCH`

### artdirect-dossier-field-save (apps.artdirect.dossier)

Edit one field of my page. Canonical: `services updateProfile with url validation inside, behind the edit-my-profile kit action (orgapps.editing canonical).`.

- calls: (authorize: canEditProfile = the profile owner or a global admin), (dossierFieldRegistry allow-list of traits), (raw UPDATE users SET oad_dossier = oad_dossier || {col: value} for json fields), @elkdonis/services#updateProfile
  - `sa:apps/artdirect/src/lib/dossier-editor-actions.ts#saveDossierFieldAction`
- calls: @elkdonis/db#db, @elkdonis/services#updateProfile
  - `sql:apps/artdirect/src/lib/dossier-editor-actions.ts#saveDossierFieldAction`

### artdirect-page-background-set (apps.artdirect.dossier)

Set my page colour. Canonical: `services setPersonTheme.`.

- calls: (getCurrentUser: any signed-in person), (hex check and luminance cap), (raw UPDATE users SET theme = theme || {--oad-page-bg})
  - `sa:apps/artdirect/src/lib/space-actions.ts#setPageBackgroundAction`
- calls: @elkdonis/db#db
  - `sql:apps/artdirect/src/lib/space-actions.ts#setPageBackgroundAction`

### artdirect-profile-layout-set (apps.artdirect.dossier)

Choose the layout of my page. Canonical: `services setProfileLayout.`.

- calls: (authorize: canEditProfile = the profile owner or a global admin), (raw UPDATE users SET profile_layout), @elkdonis/cms-ui/profile#isKnownLayout
  - `sa:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileLayoutAction`
- calls: @elkdonis/cms-ui/profile#isKnownLayout, @elkdonis/db#db
  - `sql:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileLayoutAction`

### artdirect-social-section-set (apps.artdirect.dossier)

Show or hide my Instagram or YouTube feed. Canonical: `one services setProfileSection(userId, key, on).`.

- calls: (getCurrentUser: any signed-in person), (raw UPDATE users SET profile_sections WHERE id = own), @elkdonis/services#forgetSocialFeeds
  - `sa:apps/artdirect/src/lib/social-actions.ts#setSocialSectionAction`
- calls: @elkdonis/db#db, @elkdonis/services#forgetSocialFeeds
  - `sql:apps/artdirect/src/lib/social-actions.ts#setSocialSectionAction`

### artwork-display-set (orgapps.artwork)

Change how an artwork is shown on the site. Canonical: `a commerce setArtworkListing(id, mode) that owns these status transitions; danamccool calls it.`.

- calls: (wrapper over changeArtwork)
  - `sa:apps/danamccool/src/lib/artwork-actions.ts#updateArtwork`
- calls: @elkdonis/db#db
  - `sa:apps/danamccool/src/lib/artwork-actions.ts#changeArtwork`
  - `sql:apps/danamccool/src/lib/artwork-actions.ts#changeArtwork`

### artwork-draft-save (orgapps.artwork)

Save an artwork. Canonical: `commerce createArtwork/updateArtwork/setArtworkMedia with katie's validation (image path rule, currency list, bounds) moved into commerce; one kit action built on guardStore.`.

- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), @elkdonis/commerce/server#canActForStore (org store), @elkdonis/commerce/server#createArtwork, @elkdonis/commerce/server#publishArtwork
  - `sa:apps/ifac/src/lib/cms/art-piece-actions.ts#createArtPieceAction`
- calls: @elkdonis/commerce/server#createArtwork
  - `sa:apps/art-auction/src/app/studio/actions.ts#createArtworkAction`
  - `sa:apps/innergathering/src/lib/cms/art-piece-actions.ts#createArtPieceAction`
- calls: @elkdonis/commerce/server#createArtwork, @elkdonis/commerce/server#publishArtwork, @elkdonis/commerce/server#setArtworkMedia, @elkdonis/commerce/server#updateArtwork
  - `sa:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkSaveAction`
- calls: @elkdonis/commerce/server#createArtwork, @elkdonis/commerce/server#updateArtwork
  - `sa:apps/ifac/src/lib/cms/artwork-actions.ts#saveArtworkDraftAction`
  - `sa:apps/innergathering/src/lib/cms/artwork-actions.ts#saveArtworkDraftAction`
- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkSaveAction`
- calls: createArtwork, publishArtwork, setArtworkAvailability, setArtworkMedia
  - `sa:apps/arts-collective/src/lib/artwork-form-actions.ts#saveArtworkFormAction`
- calls: createArtwork, updateArtwork
  - `sa:apps/arts-collective/src/lib/cms/artwork-actions.ts#saveArtworkDraftAction`

### artwork-hide (apps.art-auction.admin)

Hide or show an artwork on the site.

- calls: @elkdonis/commerce/server#adminHideArtwork
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminHideArtworkAction`
- calls: @elkdonis/commerce/server#adminShowArtwork
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminShowArtworkAction`

### artwork-journey-publish (orgapps.artwork)

Put artworks on sale. Canonical: `commerce publishArtwork (ownership inside) via one kit action; marketplace URL from siteConfig.`.

- calls: @elkdonis/commerce/links#marketplaceLinks, @elkdonis/commerce/server#publishArtwork
  - `sa:apps/ifac/src/lib/cms/artwork-actions.ts#publishArtworksAction`
  - `sa:apps/innergathering/src/lib/cms/artwork-actions.ts#publishArtworksAction`
- calls: publishArtwork
  - `sa:apps/arts-collective/src/lib/cms/artwork-actions.ts#publishArtworksAction`

### astro-passage-mark-save (apps.elastrocal)

Mark a passage. Canonical: `@elkdonis/astro-corpus/server#recordReview (so the checks live in one place)`.

- calls: @elkdonis/astro-corpus#isFactorKey
  - `api:apps/elastrocal/src/app/api/mobile/v1/marks/route.ts#POST`
- calls: @elkdonis/astro-corpus#isFactorKey, @elkdonis/db#db
  - `sql:apps/elastrocal/src/app/api/mobile/v1/marks/route.ts#POST`

### auction-store-publish (orgapps.journeys)

Open my store on the marketplace. Canonical: `commerce publishStoreForAuction with displayName resolved inside commerce; one shared kit action.`.

- calls: @elkdonis/commerce/server#publishStoreForAuction, @elkdonis/db#db (display_name read)
  - `sa:apps/ifac/src/lib/cms/journey-actions.ts#publishStoreAction`
  - `sa:apps/innergathering/src/lib/cms/journey-actions.ts#publishStoreAction`
- calls: publishStoreForAuction, runAction(store)
  - `sa:apps/arts-collective/src/lib/cms/journey-actions.ts#publishStoreAction`

### booking-cancel (orgapps.commerce.booking)

Cancel a booking. Canonical: `packages/booking cancelAs with refund-due, then a single approved refund action.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/bookings.ts#cancelAs`
- calls: @elkdonis/booking#bookerCancelBooking
  - `sa:apps/artdirect/src/lib/booking-actions.ts#bookerCancelAction`
- calls: @elkdonis/booking#hostCancelBooking
  - `sa:apps/artdirect/src/lib/booking-actions.ts#hostCancelAction`

### booking-offer-book (orgapps.commerce.booking)

Book a time on a bookable offering. Canonical: `createBooking / startBookingCheckout of packages/booking and packages/checkout, as the single booking path for every site and for elktours departures.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/bookings.ts#createBooking`
- calls: @elkdonis/checkout/booking#startBookingCheckout, @elkdonis/services#bookFreeOffering, @elkdonis/services#getPublicBookingOffer
  - `sa:apps/artdirect/src/lib/booking-actions.ts#bookOfferAction`
- calls: @elkdonis/db#db
  - `sql:packages/booking/src/server/bookings.ts#attachOrder`
  - `sql:packages/booking/src/server/bookings.ts#releaseBooking`

### booking-offer-save (orgapps.commerce.booking)

Save how a service is booked. Canonical: `services saveBookingOffer behind a Studio section (design section 2).`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/offers.ts#saveOffer`
- calls: @elkdonis/db#db
  - `sql:packages/booking/src/server/offers.ts#setOfferStatus`
- calls: @elkdonis/services#saveBookingOffer
  - `sa:apps/artdirect/src/lib/booking-actions.ts#saveBookingSettingsAction`

### booking-time-confirm (orgapps.commerce.booking)

Confirm a time for a booking. Canonical: `packages/booking hostConfirmTime / bookerConfirmTime behind one kit action per side.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/bookings.ts#confirmAs`
- calls: @elkdonis/booking#bookerConfirmTime
  - `sa:apps/artdirect/src/lib/booking-actions.ts#bookerConfirmAction`
- calls: @elkdonis/booking#hostConfirmTime
  - `sa:apps/artdirect/src/lib/booking-actions.ts#hostConfirmAction`

### booking-times-propose (orgapps.commerce.booking)

Suggest other times for a booking. Canonical: `packages/booking proposeAs behind one kit action.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/bookings.ts#proposeAs`
- calls: @elkdonis/booking#bookerProposeTimes
  - `sa:apps/artdirect/src/lib/booking-actions.ts#bookerProposeAction`
- calls: @elkdonis/booking#hostProposeTimes
  - `sa:apps/artdirect/src/lib/booking-actions.ts#hostProposeAction`

### cancel-rsvp (arts-collective.sites)

Cancel an RSVP or leave a workshop. Canonical: `the shared rsvp handler`.

- calls: @elkdonis/services#deleteRsvp
  - `api:apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts#DELETE`
  - `api:apps/elktours/src/app/api/threads/[id]/rsvp/route.ts#DELETE`
  - `api:apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts#DELETE`
- calls: deleteRsvp, isEnrolledInWorkshop, nextcloud#revokeMaterialsAccess
  - `api:apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts#DELETE`

### capture-from-phone (arts-collective.studio)

Capture from a phone.

- calls: captureCreate
  - `api:apps/arts-collective/src/app/api/capture/route.ts#POST`
- calls: captureMark, captureUploadFinish, captureUploadPart, captureUploadStart
  - `api:apps/arts-collective/src/app/api/capture/[code]/route.ts#POST`

### cart-add-piece (orgapps.commerce.shop)

Add a piece to the cart. Canonical: `commerce addToCart via one kit action.`.

- calls: @elkdonis/checkout/server#withCartToken, @elkdonis/commerce/server#addToCart
  - `sa:apps/katie-the-potter/src/lib/shop-actions.ts#addPieceToCart`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/index.ts#addToCart`
  - `sql:packages/commerce/src/server/index.ts#createReservation`
  - `sql:packages/commerce/src/server/index.ts#getOrCreateCart`

### chart-delete (apps.elastrocal)

Delete a chart.

- calls: (lib) deleteChart
  - `api:apps/elastrocal/src/app/api/charts/[id]/route.ts#DELETE`
- calls: @elkdonis/db#db
  - `sql:apps/elastrocal/src/lib/charts.ts#deleteChart`

### chart-save (apps.elastrocal)

Save a chart.

- calls: (lib) claimGuestCharts, (lib) createChart
  - `api:apps/elastrocal/src/app/api/charts/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/elastrocal/src/lib/charts.ts#createChart`

### chart-update (apps.elastrocal)

Rename, favourite or annotate a chart.

- calls: (lib) updateChart
  - `api:apps/elastrocal/src/app/api/charts/[id]/route.ts#PATCH`
- calls: @elkdonis/db#db
  - `sql:apps/elastrocal/src/lib/charts.ts#updateChart`

### choose-sites-for-post (arts-collective.hub)

Show a post on other sites. Canonical: `services setThreadListings behind the shared desk action.`.

- calls: (local helper)
  - `sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#setPublishListing`
- calls: @elkdonis/services#getProfile, @elkdonis/services#setThreadListings
  - `sa:apps/innergathering/src/lib/writing-actions.ts#setPieceListingAction`
- calls: @elkdonis/services#setThreadListings
  - `api:apps/innergathering/src/app/api/center/listings/route.ts#POST`
  - `sa:apps/artdirect/src/lib/writing-actions.ts#setPieceListingAction`
  - `sa:apps/ifac/src/lib/writing-actions.ts#setPieceListingAction`
- calls: setThreadListings
  - `api:apps/arts-collective/src/app/api/center/listings/route.ts#POST`
  - `sa:apps/arts-collective/src/lib/studio-actions.ts#setStudioListing`

### collect-page-pulse (arts-collective.network)

Page-view pulse.

- calls: @elkdonis/analytics#createCollectHandler
  - `api:apps/art-auction/src/app/api/pulse/route.ts#POST`
  - `api:apps/artdirect/src/app/api/pulse/route.ts#POST`
  - `api:apps/danamccool/src/app/api/pulse/route.ts#POST`
  - `api:apps/hidden-enneagram/src/app/api/pulse/route.ts#POST`
  - `api:apps/ifac/src/app/api/pulse/route.ts#POST`
- calls: @elkdonis/analytics/route#createCollectHandler
  - `api:apps/amrit-canada/src/app/api/pulse/route.ts#POST`
  - `api:apps/elktours/src/app/api/pulse/route.ts#POST`
  - `api:apps/forum/src/app/api/pulse/route.ts#POST`
  - `api:apps/fourthwayBookreaders/src/app/api/pulse/route.ts#POST`
  - `api:apps/innergathering/src/app/api/pulse/route.ts#POST`
  - `api:apps/katie-the-potter/src/app/api/pulse/route.ts#POST`
  - `api:apps/sunjay/src/app/api/pulse/route.ts#POST`
- calls: analytics/route#createCollectHandler
  - `api:apps/arts-collective/src/app/api/pulse/route.ts#POST`

### commerce-internal-writes (orgapps.commerce.shop)

Commerce internals (ledger, stock, payout identity).

- calls: (none resolved)
  - `sql:packages/commerce/src/server/ledger.ts#recordPayout`
  - `sql:packages/commerce/src/server/ledger.ts#writeEntry`
  - `sql:packages/commerce/src/server/stock.ts#syncArtworkStatus`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/index.ts#setPayoutIdentity`
  - `sql:packages/commerce/src/server/series-orders.ts#setSeriesOrderHandover`
  - `sql:packages/commerce/src/server/series-orders.ts#setSeriesOrderReceived`

### commerce-shipping-store-writes (orgapps.commerce.shipping)

Marketplace shipping writes (labels, parcels, ship-from). Canonical: `decide one: commerce/shipping (marketplace) or katie's order_shipment flow, then merge.`.

- calls: (none resolved)
  - `sql:packages/commerce/src/server/shipping-label.ts#accrueShippingPayment`
  - `sql:packages/commerce/src/server/shipping-label.ts#run`
  - `sql:packages/commerce/src/shipping/index.ts#recordSellerTracking`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/shipping-label.ts#recordShippingLabelPaid`
  - `sql:packages/commerce/src/server/shipping-label.ts#recordShippingLabelSessionExpired`
  - `sql:packages/commerce/src/shipping/index.ts#buyPlatformLabel`
  - `sql:packages/commerce/src/shipping/index.ts#setArtworkParcel`
  - `sql:packages/commerce/src/shipping/index.ts#setShipFrom`
  - `sql:packages/commerce/src/shipping/index.ts#setStoreShippingMode`

### connect-social-account (arts-collective.hub)

Connect or adjust a social account.

- calls: (who = getViewer userId), @elkdonis/services#centerRoutes
  - `api:apps/hidden-enneagram/src/app/api/center/connections/route.ts#POST`
  - `api:apps/ifac/src/app/api/center/connections/route.ts#POST`
- calls: @elkdonis/services#centerRoutes (connections)
  - `api:apps/amrit-canada/src/app/api/center/connections/route.ts#POST`
  - `api:apps/sunjay/src/app/api/center/connections/route.ts#POST`
- calls: @elkdonis/services#connectionsHandlers
  - `api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#POST`
  - `api:apps/innergathering/src/app/api/center/connections/route.ts#POST`
- calls: createConnection
  - `api:apps/arts-collective/src/app/api/center/connections/route.ts#POST`

### control-broadcast-booth (arts-collective.studio)

Control the booth (scene, record, stream, graphics).

- calls: cameraUploadAbort, cameraUploadFinish, cameraUploadPart, cameraUploadStart
  - `api:apps/arts-collective/src/app/api/broadcast/camera-upload/route.ts#POST`
- calls: obsClaim
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastClaim`
- calls: obsDoorToken
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastDoorToken`
- calls: obsGraphicsCommand
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastGraphics`
- calls: obsGraphicsDelete
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastDeleteGraphic`
- calls: obsGraphicsUpload
  - `api:apps/arts-collective/src/app/api/broadcast/graphics/route.ts#POST`
- calls: obsRecord
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastRecord`
- calls: obsRelease
  - `api:apps/arts-collective/src/app/api/broadcast/release/route.ts#POST`
- calls: obsSetBrowserUrl
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastSetBrowserUrl`
- calls: obsSetScene
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastSetScene`
- calls: obsStream
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastStream`
- calls: obsStreamSettings
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastStreamSettings`
- calls: obsStudioCommand
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastStudioCommand`

### create-account (arts-collective.network)

Create an account. Canonical: `auth-server handleSignup (already shared); keep one route per app, no custom copies`.

- calls: @elkdonis/auth-server#handleSignup
  - `api:apps/amrit-canada/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/art-auction/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/artdirect/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/blog-guru-dharam/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/blog-tester/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/danamccool/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/elastrocal/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/elkdonis-arts-collective/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/elktours/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/fourthwayBookreaders/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/hidden-enneagram/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/ifac/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/innergathering/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/katie-the-potter/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/pigeonshoot/src/app/api/auth/signup/route.ts#POST`
  - `api:apps/sunjay/src/app/api/auth/signup/route.ts#POST`
- calls: auth-server#handleSignup
  - `api:apps/arts-collective/src/app/api/auth/signup/route.ts#POST`

### create-content (arts-collective.hub)

Create a post, event, meeting or workshop. Canonical: `services savePostContent via one shared org-site kit action; membersMayPost and href/revalidate supplied from the per-site config.`.

- calls: (getViewer: any signed-in person; rule inside services), @elkdonis/services#savePostContent, @elkdonis/site-forms/server#siteOrg
  - `sa:apps/hidden-enneagram/src/lib/forms/actions.ts#sitePostSaveAction`
- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#replaceWorkshopSessions, @elkdonis/services#resolveActor, @elkdonis/utils#deriveExcerpt
  - `sql:apps/arts-collective/src/lib/cms/actions.ts#createThreadAction`
- calls: @elkdonis/services#savePostContent, @elkdonis/site-forms/server#siteOrg
  - `sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#sitePostSaveAction`
  - `sa:apps/elktours/src/lib/forms/meeting-actions.ts#sitePostSaveAction`
  - `sa:apps/ifac/src/lib/forms/meeting-actions.ts#sitePostSaveAction`
  - `sa:apps/innergathering/src/lib/forms/meeting-actions.ts#sitePostSaveAction`
  - `sa:apps/sunjay/src/lib/forms/post-actions.ts#sitePostSaveAction`
- calls: ensureUniqueThreadSlug, replaceWorkshopSessions, resolveActor
  - `sa:apps/arts-collective/src/lib/cms/actions.ts#createThreadAction`

### create-social-post (arts-collective.studio)

Save a social post draft. Canonical: `services createSocialPost/updateSocialPost via one action`.

- calls: createSocialPost
  - `sa:apps/arts-collective/src/lib/post-actions.ts#createSocialPostAction`
- calls: createSocialPost, updateSocialPost
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#saveNewPostAction`

### dana-media-upload (apps.danamccool.site)

Upload a picture to the site. Canonical: `services uploadUserFile with validateUploadBuffer and a per-app authorizer.`.

- calls: (getSiteOwnerUserId storage slug), (getViewer().canEdit = owner or guide), @elkdonis/services#createUserFolder, @elkdonis/services#resolveUserPath, @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/danamccool/src/app/api/media/upload/route.ts#POST`
- calls: @elkdonis/db#db, @elkdonis/services#createUserFolder, @elkdonis/services#getProxyFileUrl, @elkdonis/services#getStorageSlug, @elkdonis/services#resolveUserPath, @elkdonis/services#uploadFile, @elkdonis/services#uploadFilename, @elkdonis/utils#validateUploadBuffer
  - `sql:apps/danamccool/src/app/api/media/upload/route.ts#POST`

### dana-navigation-save (apps.danamccool.site)

Edit the site menu. Canonical: `a shared site_config save helper (org-scoped, cleaned).`.

- calls: (cleanNav: labels 60, hrefs 200, protocol-relative and non-http(s) refused), (getViewer().canEdit = owner or guide; the error text says only the site owner)
  - `sa:apps/danamccool/src/lib/navigation-actions.ts#saveNavAction`
- calls: @elkdonis/db#db
  - `sql:apps/danamccool/src/lib/navigation-store.ts#saveNav`

### delete-booth-recording (arts-collective.studio)

Remove a booth recording. Canonical: `obsRemoveRecording`.

- calls: obsDeleteRecording
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastDeleteRecording`
- calls: obsRemoveRecording
  - `sa:apps/arts-collective/src/lib/recording-actions.ts#boothRemoveRecordingAction`

### disconnect-social-account (arts-collective.hub)

Disconnect a social account.

- calls: (who = getViewer userId), @elkdonis/services#centerRoutes
  - `api:apps/hidden-enneagram/src/app/api/center/connections/route.ts#DELETE`
  - `api:apps/ifac/src/app/api/center/connections/route.ts#DELETE`
- calls: @elkdonis/services#centerRoutes (connections)
  - `api:apps/amrit-canada/src/app/api/center/connections/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/center/connections/route.ts#DELETE`
- calls: @elkdonis/services#connectionsHandlers
  - `api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#DELETE`
  - `api:apps/innergathering/src/app/api/center/connections/route.ts#DELETE`
- calls: deleteConnection
  - `api:apps/arts-collective/src/app/api/center/connections/route.ts#DELETE`

### dismiss-channel-suggestion (arts-collective.channel)

Dismiss a suggestion. Canonical: `packages/actions server/channel.ts dismissSuggestion`.

- calls: @elkdonis/actions/server#performSiteChannelAction
  - `sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction`
  - `sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction`
- calls: createChannelDelivery
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#dismissSuggestionAction`

### dock-course-choose (arts-collective.dock)

Choose a course in the dock.

- calls: @elkdonis/actions/server#dockChoose
  - `sa:apps/arts-collective/src/lib/actions/dock-actions.ts#dockChooseCourse`
- calls: @elkdonis/db#db
  - `sql:packages/actions/src/server/dock-state.ts#dockChoose`

### dock-step-leave-return (arts-collective.dock)

Leave a step and come back to the trail.

- calls: @elkdonis/actions/server#dockDepart
  - `sa:apps/arts-collective/src/lib/actions/dock-actions.ts#dockDepart`
- calls: @elkdonis/actions/server#dockReturn
  - `sa:apps/arts-collective/src/lib/actions/dock-actions.ts#dockReturn`
- calls: @elkdonis/db#db
  - `sql:packages/actions/src/server/dock-state.ts#dockDepart`

### dock-step-record (arts-collective.dock)

Record a finished step in the dock.

- calls: @elkdonis/actions/server#dockMarkDoneSeen
  - `sa:apps/arts-collective/src/lib/actions/dock-actions.ts#dockAckDone`
- calls: @elkdonis/db#db
  - `sql:packages/actions/src/server/dock-state.ts#dockMarkDone`
  - `sql:packages/actions/src/server/dock-state.ts#dockMarkDoneSeen`
  - `sql:packages/actions/src/server/dock-state.ts#writeDockStep`

### eac-site-config-save (apps.elkdonis-arts-collective)

Edit the landing page content. Canonical: `one site_config writer with an allow-list of keys (see pkg-page-builder-page-save for the validated one)`.

- calls: (raw INSERT ... ON CONFLICT site_config)
  - `api:apps/elkdonis-arts-collective/src/app/api/admin/site-config/route.ts#PATCH`
- calls: @elkdonis/db#db
  - `sql:apps/elkdonis-arts-collective/src/app/api/admin/site-config/route.ts#PATCH`

### eac-site-inquiry-record (apps.elkdonis-arts-collective)

Answer the landing page’s question.

- calls: (none resolved)
  - `sql:apps/elkdonis-arts-collective/src/app/api/inquiries/route.ts#POST`
- calls: (raw INSERT landing_inquiries)
  - `api:apps/elkdonis-arts-collective/src/app/api/inquiries/route.ts#POST`

### edit-email-contact (arts-collective.hub)

Edit a mailing-list contact.

- calls: (getApiEditor: owner or guide), @elkdonis/email#updateContact
  - `api:apps/ifac/src/app/api/hub/email/addresses/route.ts#PATCH`
- calls: @elkdonis/email#updateContact
  - `api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#PATCH`
- calls: updateContact
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#PATCH`

### edit-my-profile (arts-collective.hub)

Edit my profile. Canonical: `services updateProfile + ensureUniqueUserSlug behind one shared kit action; add URL/media-path validation for photoUrl.`.

- calls: (getViewer; org target only when org is ifac and canEditOrgIdentity), @elkdonis/services#updateProfile
  - `api:apps/ifac/src/app/api/center/profile/route.ts#PATCH`
- calls: (getViewer; org target when canEditOrgIdentity), @elkdonis/services#updateProfile
  - `api:apps/hidden-enneagram/src/app/api/center/profile/route.ts#PATCH`
- calls: @elkdonis/services#canEditOrgIdentity, @elkdonis/services#saveProfileDetails, @elkdonis/services#updateProfile
  - `api:apps/innergathering/src/app/api/center/profile/route.ts#PATCH`
- calls: @elkdonis/services#canEditOrgIdentity, @elkdonis/services#updateProfile
  - `api:apps/amrit-canada/src/app/api/center/profile/route.ts#PATCH`
  - `api:apps/elktours/src/app/api/center/profile/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/center/profile/route.ts#PATCH`
- calls: @elkdonis/services#ensureUniqueUserSlug, @elkdonis/services#updateProfile
  - `sa:apps/amrit-canada/src/lib/account-actions.ts#updateOwnProfileAction`
  - `sa:apps/elktours/src/lib/account-actions.ts#updateOwnProfileAction`
  - `sa:apps/innergathering/src/lib/account-actions.ts#updateOwnProfileAction`
  - `sa:apps/sunjay/src/lib/account-actions.ts#updateOwnProfileAction`
- calls: @elkdonis/services#updateProfile, @elkdonis/services#upsertOrgProfile
  - `sa:apps/elastrocal/src/app/hub/profile/actions.ts#saveProfileAction`
- calls: saveProfileDetails, updateProfile
  - `api:apps/arts-collective/src/app/api/center/profile/route.ts#PATCH`

### edit-social-account (arts-collective.hub)

Edit a connected social account.

- calls: (who = getViewer userId), @elkdonis/services#centerRoutes
  - `api:apps/hidden-enneagram/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/ifac/src/app/api/center/connections/route.ts#PATCH`
- calls: @elkdonis/services#connectionsHandlers
  - `api:apps/innergathering/src/app/api/center/connections/route.ts#PATCH`
- calls: updateConnection
  - `api:apps/arts-collective/src/app/api/center/connections/route.ts#PATCH`

### edit-workshop-live (arts-collective.hub)

Edit a workshop field in place.

- calls: @elkdonis/db#db
  - `sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldAction`
  - `sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopThemeAction`
  - `sql:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldAction`
  - `sql:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopThemeAction`
- calls: fieldRegistry
  - `sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldByTraitAction`

### elktours-artist-availability-save (apps.elktours.wizards)

Save your free times.

- calls: db.begin, raw SQL DELETE/INSERT artist_availability
  - `sa:apps/elktours/src/lib/artist-wizard-actions.ts#saveAvailabilityAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/artist-wizard-actions.ts#saveAvailabilityAction`

### elktours-artist-invite-for-departure (apps.elktours.wizards)

Invite the artist for one run. Canonical: `one inviteArtist helper in lib/collaborate.ts`.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/collaborate-actions.ts#inviteForDepartureAction`
- calls: raw SQL INSERT service_commissions
  - `sa:apps/elktours/src/lib/collaborate-actions.ts#inviteForDepartureAction`

### elktours-artist-profile-save (apps.elktours.wizards)

Save your artist profile. Canonical: `one profile writer in services behind a shared kit action`.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/artist-wizard-actions.ts#saveArtistProfileAction`
- calls: raw SQL INSERT org_profiles, raw SQL UPDATE users
  - `sa:apps/elktours/src/lib/artist-wizard-actions.ts#saveArtistProfileAction`

### elktours-asset-archive (apps.elktours.assets-renders)

Archive an asset.

- calls: archiveAsset
  - `sa:apps/elktours/src/lib/asset-actions.ts#archiveAssetAction`
- calls: raw SQL UPDATE tour_assets
  - `sql:apps/elktours/src/lib/assets.ts#archiveAsset`

### elktours-asset-copy-to-stop (apps.elktours.assets-renders)

Use a place photo on a stop.

- calls: copyPlaceAssetToStop
  - `sa:apps/elktours/src/lib/asset-actions.ts#copyPlaceAssetToStopAction`
- calls: raw SQL INSERT tour_assets
  - `sql:apps/elktours/src/lib/assets.ts#copyPlaceAssetToStop`

### elktours-asset-save (apps.elktours.assets-renders)

Save a tour, stop or place asset.

- calls: raw SQL INSERT/UPDATE tour_assets
  - `sql:apps/elktours/src/lib/assets.ts#upsertAsset`
- calls: raw SQL INSERT/UPDATE tour_assets (upsertAsset)
  - `sa:apps/elktours/src/lib/asset-actions.ts#upsertAssetAction`

### elktours-asset-visible-set (apps.elktours.assets-renders)

Show or hide an asset.

- calls: publishPrivateFile (Nextcloud WebDAV), setAssetVisible, writeFilmCache
  - `sa:apps/elktours/src/lib/asset-actions.ts#setAssetVisibleAction`
- calls: raw SQL UPDATE threads.metadata.film
  - `sql:apps/elktours/src/lib/assets.ts#writeFilmCache`
- calls: raw SQL UPDATE tour_assets
  - `sql:apps/elktours/src/lib/assets.ts#setAssetVisible`
- calls: raw SQL UPDATE tour_assets + Nextcloud COPY/PUT
  - `sql:apps/elktours/src/lib/assets.ts#publishPrivateFile`

### elktours-experience-decide (apps.elktours.wizards)

Decide on an artist experience. Canonical: `@elkdonis/services#reviewThread`.

- calls: @elkdonis/services#reviewThread, raw SQL UPDATE threads
  - `sa:apps/elktours/src/lib/artist-wizard-actions.ts#decideExperienceAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/artist-wizard-actions.ts#decideExperienceAction`

### elktours-experience-default-layout-publish (apps.elktours.experiences)

Publish the default experience page layout. Canonical: `@elkdonis/page-builder/server#savePage`.

- calls: raw SQL INSERT/DELETE site_config
  - `sql:apps/elktours/src/lib/experience-layout.ts#saveExperienceLayout`
- calls: readExperienceLayout, saveExperienceLayout
  - `sa:apps/elktours/src/app/studio/actions.ts#publishExperienceDefaultLayoutAction`

### elktours-experience-draft-save (apps.elktours.wizards)

Save your experience draft. Canonical: `one experience writer in services with an artist and an office entry`.

- calls: @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/utils#sanitizeRichText, db.begin, raw SQL INSERT/UPDATE threads
  - `sa:apps/elktours/src/lib/artist-wizard-actions.ts#saveExperienceDraftAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/artist-wizard-actions.ts#saveExperienceDraftAction`

### elktours-experience-link-to-stop (apps.elktours.wizards)

Put an experience on a tour stop.

- calls: artistFreeAt, raw SQL INSERT service_commissions, raw SQL UPDATE tour_stops, stopArrivalTimes
  - `sa:apps/elktours/src/lib/collaborate-actions.ts#linkExperienceToStopAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/collaborate-actions.ts#linkExperienceToStopAction`

### elktours-experience-people-set (apps.elktours.experiences)

Set an experience's artists and hosts.

- calls: db.begin, raw SQL DELETE/INSERT experience_people
  - `sa:apps/elktours/src/lib/experience-actions.ts#setExperiencePeopleAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/experience-actions.ts#setExperiencePeopleAction`

### elktours-experience-save (apps.elktours.experiences)

Save an experience. Canonical: `one experience writer in services with an artist and an office entry`.

- calls: @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/utils#sanitizeRichText, raw SQL INSERT/UPDATE threads
  - `sa:apps/elktours/src/lib/experience-actions.ts#saveExperienceAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/experience-actions.ts#saveExperienceAction`

### elktours-experience-status-set (apps.elktours.experiences)

Publish, hide or archive an experience.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/experience-actions.ts#setExperienceStatusAction`
- calls: raw SQL UPDATE threads
  - `sa:apps/elktours/src/lib/experience-actions.ts#setExperienceStatusAction`

### elktours-experience-submit (apps.elktours.wizards)

Send your experience to the office.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/artist-wizard-actions.ts#submitExperienceForReviewAction`
- calls: raw SQL UPDATE threads
  - `sa:apps/elktours/src/lib/artist-wizard-actions.ts#submitExperienceForReviewAction`

### elktours-flyover-accept (apps.elktours.assets-renders)

Accept a fly-over request.

- calls: acceptRequest
  - `sa:apps/elktours/src/lib/render-request-actions.ts#acceptFlyoverAction`
- calls: raw SQL UPDATE tour_render_requests
  - `sql:apps/elktours/src/lib/render-requests.ts#acceptRequest`

### elktours-flyover-cancel (apps.elktours.assets-renders)

Cancel a fly-over request.

- calls: cancelRequest
  - `sa:apps/elktours/src/lib/render-request-actions.ts#cancelFlyoverAction`
- calls: raw SQL UPDATE tour_render_requests
  - `sql:apps/elktours/src/lib/render-requests.ts#cancelRequest`

### elktours-flyover-reject (apps.elktours.assets-renders)

Reject a fly-over request.

- calls: raw SQL UPDATE tour_render_requests
  - `sql:apps/elktours/src/lib/render-requests.ts#rejectRequest`
- calls: rejectRequest
  - `sa:apps/elktours/src/lib/render-request-actions.ts#rejectFlyoverAction`

### elktours-flyover-request (apps.elktours.assets-renders)

Request a fly-over film.

- calls: createRequest
  - `sa:apps/elktours/src/lib/render-request-actions.ts#requestFlyoverAction`
- calls: raw SQL INSERT tour_render_requests
  - `sql:apps/elktours/src/lib/render-requests.ts#createRequest`

### elktours-flyover-requeue (apps.elktours.assets-renders)

Re-queue a failed fly-over.

- calls: raw SQL UPDATE tour_render_requests
  - `sql:apps/elktours/src/lib/render-requests.ts#requeueRequest`
- calls: requeueRequest
  - `sa:apps/elktours/src/lib/render-request-actions.ts#requeueFlyoverAction`

### elktours-flyover-worker (apps.elktours.assets-renders)

Render worker takes and reports jobs.

- calls: raw SQL UPDATE tour_render_requests
  - `sql:apps/elktours/src/lib/render-requests.ts#failJob`
  - `sql:apps/elktours/src/lib/render-requests.ts#heartbeat`
- calls: raw SQL UPDATE tour_render_requests (FOR UPDATE SKIP LOCKED)
  - `sql:apps/elktours/src/lib/render-requests.ts#claimNext`

### elktours-hero-lead-set (apps.elktours.tours)

Choose what guests see first on a tour.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/hero-actions.ts#setHeroLeadAction`
- calls: raw SQL UPDATE threads.metadata
  - `sa:apps/elktours/src/lib/hero-actions.ts#setHeroLeadAction`

### elktours-invitation-respond (apps.elktours.wizards)

Accept or decline an invitation.

- calls: raw SQL UPDATE service_commissions
  - `sql:apps/elktours/src/lib/commissions.ts#respondCommission`
- calls: respondCommission
  - `sa:apps/elktours/src/lib/collaborate-actions.ts#respondInvitationAction`

### elktours-place-archive (apps.elktours.places)

Archive or restore a place.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/place-actions.ts#archivePlaceAction`
- calls: raw SQL UPDATE places
  - `sa:apps/elktours/src/lib/place-actions.ts#archivePlaceAction`

### elktours-place-create-from-photo (apps.elktours.places)

Add a place from a geotagged photo. Canonical: `one shared photo-intake helper in lib/photo-geo.ts used by both the editor and the visitor path`.

- calls: insertPinPlace (raw SQL), raw SQL INSERT tour_assets, readPhotoGeo (exifr), storePrivatePhoto
  - `sa:apps/elktours/src/lib/custom-place-actions.ts#createPlaceFromPhoto`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/custom-place-actions.ts#createPlaceFromPhoto`

### elktours-place-create-from-pin (apps.elktours.places)

Add a place from a map pin.

- calls: insertPinPlace (raw SQL), reverseGeocode (Photon)
  - `sa:apps/elktours/src/lib/custom-place-actions.ts#createPlaceFromPin`
- calls: raw SQL INSERT places, sanitizeRichText
  - `sql:apps/elktours/src/lib/custom-place-actions.ts#insertPinPlace`

### elktours-place-favourite-toggle (apps.elktours.places)

Star a place as a favourite.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/place-favourite-actions.ts#toggleFavouritePlaceAction`
- calls: raw SQL INSERT/DELETE place_favourites
  - `sa:apps/elktours/src/lib/place-favourite-actions.ts#toggleFavouritePlaceAction`

### elktours-place-link-approve (apps.elktours.places)

Confirm a place link.

- calls: db.begin, raw SQL INSERT place_links
  - `sa:apps/elktours/src/lib/place-actions.ts#approvePlaceLinkAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/place-actions.ts#approvePlaceLinkAction`

### elktours-place-photo-discard (apps.elktours.places)

Discard a waiting photo.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/custom-place-actions.ts#discardPendingPhotoAction`
- calls: raw SQL UPDATE tour_assets
  - `sa:apps/elktours/src/lib/custom-place-actions.ts#discardPendingPhotoAction`

### elktours-place-photo-pin (apps.elktours.places)

Pin a waiting photo.

- calls: insertPinPlace (raw SQL), raw SQL UPDATE tour_assets
  - `sa:apps/elktours/src/lib/custom-place-actions.ts#attachPhotoToPinAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/custom-place-actions.ts#attachPhotoToPinAction`

### elktours-place-save (apps.elktours.places)

Save a place in the catalogue. Canonical: `apps/elktours/src/lib/place-actions.ts#writePlace`.

- calls: raw SQL INSERT/UPDATE places
  - `sql:apps/elktours/src/lib/place-actions.ts#writePlace`
- calls: sanitizeRichText, writePlace (raw SQL), zod placeSchema
  - `sa:apps/elktours/src/lib/place-actions.ts#savePlaceAction`

### elktours-place-update-from-stop (apps.elktours.places)

Update the catalogue place from a stop.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/place-actions.ts#updatePlaceFromStopAction`
- calls: raw SQL UPDATE places
  - `sa:apps/elktours/src/lib/place-actions.ts#updatePlaceFromStopAction`

### elktours-place-website-set (apps.elktours.places)

Set a place's website.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/place-website-actions.ts#setPlaceWebsiteAction`
- calls: raw SQL INSERT/UPDATE place_links
  - `sa:apps/elktours/src/lib/place-website-actions.ts#setPlaceWebsiteAction`

### elktours-review-delete-own (apps.elktours.reviews)

Delete your review.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/review-actions.ts#deleteOwnReviewAction`
- calls: raw SQL DELETE org_reviews
  - `sa:apps/elktours/src/lib/review-actions.ts#deleteOwnReviewAction`

### elktours-review-hide (apps.elktours.reviews)

Hide or show a review.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/review-actions.ts#setReviewHiddenAction`
- calls: raw SQL UPDATE org_reviews
  - `sa:apps/elktours/src/lib/review-actions.ts#setReviewHiddenAction`

### elktours-review-save (apps.elktours.reviews)

Write or change your review.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/review-actions.ts#saveReviewAction`
- calls: raw SQL INSERT ... ON CONFLICT org_reviews
  - `sa:apps/elktours/src/lib/review-actions.ts#saveReviewAction`

### elktours-settings-save (apps.elktours.site)

Save the site settings.

- calls: raw SQL INSERT/UPDATE site_config via withOrg
  - `sql:apps/elktours/src/lib/site-settings.ts#saveSiteSettings`
- calls: saveSiteSettings
  - `sa:apps/elktours/src/app/manage/settings/actions.ts#saveSettingsAction`

### elktours-stop-excerpt-set (apps.elktours.stop-notes)

Set a stop's short text.

- calls: raw SQL UPDATE tour_stops
  - `sql:apps/elktours/src/lib/stop-note-actions.ts#writeExcerpt`
- calls: writeExcerpt (raw SQL)
  - `sa:apps/elktours/src/lib/stop-note-actions.ts#setStopExcerptAction`

### elktours-stop-note-add (apps.elktours.stop-notes)

Add a private note to a stop.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/stop-note-actions.ts#addStopNoteAction`
- calls: raw SQL INSERT tour_stop_notes
  - `sa:apps/elktours/src/lib/stop-note-actions.ts#addStopNoteAction`

### elktours-stop-note-delete (apps.elktours.stop-notes)

Delete a private stop note.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/stop-note-actions.ts#deleteStopNoteAction`
- calls: raw SQL DELETE tour_stop_notes
  - `sa:apps/elktours/src/lib/stop-note-actions.ts#deleteStopNoteAction`

### elktours-stop-note-promote (apps.elktours.stop-notes)

Promote a note to the stop text.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/stop-note-actions.ts#promoteStopNoteAction`
- calls: raw SQL UPDATE tour_stop_notes, writeExcerpt (raw SQL)
  - `sa:apps/elktours/src/lib/stop-note-actions.ts#promoteStopNoteAction`

### elktours-suggest-lead (apps.elktours.suggestions)

Suggest an artist or a place.

- calls: assertPublicUrl, raw SQL INSERT visitor_suggestions
  - `sa:apps/elktours/src/lib/suggest-lead-actions.ts#submitSuggestionAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/suggest-lead-actions.ts#submitSuggestionAction`

### elktours-suggest-route (apps.elktours.suggestions)

Suggest a walking route.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/suggestion-actions.ts#suggestRouteAction`
- calls: raw SQL INSERT visitor_suggestions, walkingLegs (FOSSGIS foot routing)
  - `sa:apps/elktours/src/lib/suggestion-actions.ts#suggestRouteAction`

### elktours-suggest-spot (apps.elktours.suggestions)

Suggest a spot.

- calls: insertSpot (raw SQL), reverseGeocode (Photon)
  - `sa:apps/elktours/src/lib/suggestion-actions.ts#suggestSpotAction`
- calls: raw SQL INSERT visitor_suggestions
  - `sql:apps/elktours/src/lib/suggestion-actions.ts#insertSpot`

### elktours-suggest-spot-from-photo (apps.elktours.suggestions)

Suggest a spot from a photo. Canonical: `one shared photo-intake helper (lib/photo-geo.ts)`.

- calls: insertSpot (raw SQL), raw SQL INSERT tour_assets, readPhotoGeo (exifr), storePrivatePhoto
  - `sa:apps/elktours/src/lib/suggestion-actions.ts#suggestSpotFromPhotoAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/suggestion-actions.ts#suggestSpotFromPhotoAction`

### elktours-suggestion-accept (apps.elktours.suggestions)

Accept a suggestion.

- calls: @elkdonis/commerce/server#saveTourStops, @elkdonis/services#ensureUniqueThreadSlug, createPlace (raw SQL), refreshTourRoute
  - `sa:apps/elktours/src/lib/suggestion-actions.ts#acceptSuggestionAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/suggestion-actions.ts#acceptSuggestionAction`
- calls: raw SQL INSERT places
  - `sql:apps/elktours/src/lib/suggestion-actions.ts#createPlace`

### elktours-suggestion-reject (apps.elktours.suggestions)

Reject a suggestion.

- calls: raw SQL
  - `sql:apps/elktours/src/lib/suggestion-actions.ts#rejectSuggestionAction`
- calls: raw SQL UPDATE visitor_suggestions
  - `sa:apps/elktours/src/lib/suggestion-actions.ts#rejectSuggestionAction`

### elktours-upload-forum-media (apps.elktours.hub-api)

Add a photo or video to a forum post. Canonical: `one shared upload route in services with a policy per role`.

- calls: @/lib/assets#stripImageMetadata, @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer, raw SQL INSERT media
  - `api:apps/elktours/src/app/api/upload/forum/route.ts#POST`
- calls: raw SQL
  - `sql:apps/elktours/src/app/api/upload/forum/route.ts#POST`

### follow-organisation (arts-collective.hub)

Follow an organisation.

- calls: (getViewer; no-op if the person already has a role), @elkdonis/services#followOrg
  - `api:apps/hidden-enneagram/src/app/api/center/follow/route.ts#POST`
- calls: @elkdonis/services#followOrg
  - `api:apps/amrit-canada/src/app/api/center/follow/route.ts#POST`
  - `api:apps/elktours/src/app/api/center/follow/route.ts#POST`
  - `api:apps/fourthwayBookreaders/src/app/api/center/follow/route.ts#POST`
  - `api:apps/innergathering/src/app/api/center/follow/route.ts#POST`
  - `api:apps/sunjay/src/app/api/center/follow/route.ts#POST`
- calls: @elkdonis/services#unfollowOrg
  - `api:apps/elktours/src/app/api/center/follow/route.ts#DELETE`
- calls: followOrg
  - `api:apps/arts-collective/src/app/api/org/[slug]/follow/route.ts#POST`

### forum-moderate (apps.forum)

Moderate the forum.

- calls: @elkdonis/forum-ui#handleForumAction, @elkdonis/services#moderateThread, @elkdonis/services#reviewTopicAndNotify
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.createCategory
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.moderateThread
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.proposeTopic
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.removeThread
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.reviewTopic
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`

### forum-react (apps.forum)

Vote, heart, watch or bookmark in the forum.

- calls: @elkdonis/forum-ui#handleForumAction
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, @elkdonis/services#setVote, toggleBookmark, toggleHeart, toggleWatch
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.markAllRead
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.markNotificationsRead
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.setVote
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.toggleBookmark
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.toggleHeart
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.toggleWatch
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`

### forum-reply (apps.forum)

Reply in the forum. Canonical: `packages/forum-ui handleForumAction with phone routes calling the same connectors`.

- calls: @/lib/forum-data#replyAction, postReply
  - `api:apps/elktours/src/app/api/hub/forum/replies/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, @elkdonis/services#postReply
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.postReply
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`

### forum-topic-start (apps.forum)

Start a forum topic. Canonical: `one post-creation service (createThread)`.

- calls: @/lib/forum-data#topicAction, createTopic
  - `api:apps/elktours/src/app/api/hub/forum/topics/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, @elkdonis/services#createTopic
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.createTopic
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`

### forum-wiki-edit (apps.forum)

Edit the forum wiki.

- calls: @elkdonis/forum-ui#handleForumAction, @elkdonis/services#createWikiPage, archiveWikiPage, revertWikiPage, updateWikiPage
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.wiki
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.wiki.archive
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.wiki.create
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.wiki.revert
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.wiki.talkThread
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.wiki.update
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
  - `api:apps/elktours/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, connectors.write.drawLine, connectors.write.eraseLine
  - `api:apps/forum/src/app/api/forum/[action]/route.ts#POST`

### fourthway-circle-create (apps.fourthwayBookreaders.circle)

Start a reading group. Canonical: `one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)`.

- calls: (raw UPDATE threads recurrence), @elkdonis/services#createThread, @elkdonis/services#ensureCircleSpace
  - `sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#createReadingGroup`
- calls: @elkdonis/db#db, @elkdonis/services#createThread, @elkdonis/services#ensureCircleSpace, @elkdonis/utils#sanitizeRichText
  - `sql:apps/fourthwayBookreaders/src/lib/manage-actions.ts#createReadingGroup`

### fourthway-circle-featured-set (apps.fourthwayBookreaders.circle)

Feature a group on the home page. Canonical: `one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)`.

- calls: (raw INSERT org_site_sections featured_group, raw DELETE)
  - `sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setFeaturedGroup`
- calls: @elkdonis/db#db
  - `sql:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setFeaturedGroup`

### fourthway-group-bookmark-set (apps.fourthwayBookreaders.circle)

Move a group's bookmark. Canonical: `one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)`.

- calls: (raw UPDATE threads metadata)
  - `sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#setGroupPage`
- calls: @elkdonis/db#db
  - `sql:apps/fourthwayBookreaders/src/lib/manage-actions.ts#setGroupPage`

### fourthway-group-sitting-record (apps.fourthwayBookreaders.circle)

Record a sitting as a post. Canonical: `one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)`.

- calls: (raw UPDATE threads metadata), @elkdonis/services#createThread, @elkdonis/services#gatherOnto
  - `sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#addSessionNote`
- calls: @elkdonis/db#db, @elkdonis/services#createThread, @elkdonis/services#gatherOnto
  - `sql:apps/fourthwayBookreaders/src/lib/manage-actions.ts#addSessionNote`

### fourthway-paath-day-note-save (apps.fourthwayBookreaders.paath)

Write the day's note. Canonical: `lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern`.

- calls: (lib/paath.ts setDayNote)
  - `api:apps/fourthwayBookreaders/src/app/api/akhand-path/day/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/fourthwayBookreaders/src/lib/paath.ts#setDayNote`

### fourthway-paath-note-add (apps.fourthwayBookreaders.paath)

Leave a thought on a passage. Canonical: `lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern`.

- calls: (lib/paath.ts addNote)
  - `api:apps/fourthwayBookreaders/src/app/api/akhand-path/note/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/fourthwayBookreaders/src/lib/paath.ts#addNote`

### fourthway-paath-note-remove (apps.fourthwayBookreaders.paath)

Remove my own thought. Canonical: `lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern`.

- calls: (lib/paath.ts removeNote)
  - `api:apps/fourthwayBookreaders/src/app/api/akhand-path/note/route.ts#DELETE`
- calls: @elkdonis/db#db
  - `sql:apps/fourthwayBookreaders/src/lib/paath.ts#removeNote`

### fourthway-paath-read (apps.fourthwayBookreaders.paath)

Check a passage off as read. Canonical: `lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern`.

- calls: (lib/paath.ts markRead)
  - `api:apps/fourthwayBookreaders/src/app/api/akhand-path/read/route.ts#POST`
- calls: (none resolved)
  - `sql:apps/fourthwayBookreaders/src/lib/paath.ts#markRead`

### fourthway-paath-unread (apps.fourthwayBookreaders.paath)

Put passages back as unread. Canonical: `lib/paath.ts functions as the single path; move them into services reading-circle once a second circle uses the pattern`.

- calls: (lib/paath.ts markUnread)
  - `api:apps/fourthwayBookreaders/src/app/api/akhand-path/unread/route.ts#POST`
- calls: (none resolved)
  - `sql:apps/fourthwayBookreaders/src/lib/paath.ts#markUnread`

### fourthway-session-stage (apps.fourthwayBookreaders.circle)

Open session topics ahead of time. Canonical: `one shared reading-circle kit action set in services (reading-circle.ts is already the service; these server actions are the only copy: no other app has circle actions)`.

- calls: @elkdonis/services#ensureCircleSessionTopic
  - `sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#stageCircleSession`
- calls: @elkdonis/services#ensureCircleSessionTopic, @elkdonis/services#occurrencesOf
  - `sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#stageNextCircleSessions`

### gallery-create (orgapps.content)

Start a new gallery. Canonical: `services createUserGallery behind one kit action taking {ownerResolver, origin, defaults}; ownership always read from the row.`.

- calls: (getServerSession; canEditProfile = the gallery owner or a global admin; owner read from the gallery row), @elkdonis/services#createUserGallery
  - `sa:apps/ifac/src/lib/gallery-actions.ts#createGalleryAction`
- calls: (getViewer().canEdit = owner or guide of danamccool; gallery must belong to the site owner user), @elkdonis/services#createUserGallery, @elkdonis/services#updateUserGallery
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#createGalleryAction`
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#createSubGalleryAction`

### gallery-delete (orgapps.content)

Delete a gallery. Canonical: `services deleteUserGallery behind the kit action.`.

- calls: (getServerSession; canEditProfile = the gallery owner or a global admin; owner read from the gallery row), @elkdonis/services#deleteUserGallery
  - `sa:apps/ifac/src/lib/gallery-actions.ts#deleteGalleryAction`
- calls: (getViewer().canEdit = owner or guide of danamccool; gallery must belong to the site owner user), @elkdonis/services#deleteUserGallery
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#deleteGalleryAction`

### gallery-details-save (orgapps.content)

Change a gallery's title, description, page or privacy. Canonical: `one kit action over services updateUserGallery with a patch object, gate by gallery ownership.`.

- calls: (getServerSession; canEditProfile = the gallery owner or a global admin; owner read from the gallery row), @elkdonis/services#sanitizeThemeVars, @elkdonis/services#updateUserGallery
  - `sa:apps/ifac/src/lib/gallery-actions.ts#saveGallerySettingsAction`
- calls: (getServerSession; canEditProfile = the gallery owner or a global admin; owner read from the gallery row), @elkdonis/services#updateUserGallery
  - `sa:apps/ifac/src/lib/gallery-actions.ts#saveGalleryFieldAction`
  - `sa:apps/ifac/src/lib/gallery-actions.ts#setGalleryPublicAction`
- calls: (getViewer().canEdit = owner or guide of danamccool; gallery must belong to the site owner user), @elkdonis/services#updateUserGallery
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#updateGalleryAction`

### gallery-items-save (orgapps.content)

Change the pictures in a gallery. Canonical: `one kit saveGalleryItems(galleryId, items) over services updateUserGallery with url validation inside services; the fine-grained operations become client-side helpers that compute the new list.`.

- calls: (getServerSession; canEditProfile = the gallery owner or a global admin; owner read from the gallery row), @elkdonis/services#updateUserGallery
  - `sa:apps/ifac/src/lib/gallery-actions.ts#saveGalleryItemsAction`
- calls: (getViewer().canEdit = owner or guide of danamccool; gallery must belong to the site owner user), @elkdonis/services#cleanGalleryLink, @elkdonis/services#updateUserGallery
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#updateGalleryItemTextAction`
- calls: (getViewer().canEdit = owner or guide of danamccool; gallery must belong to the site owner user), @elkdonis/services#updateUserGallery
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#addArtworksAction`
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#addPicturesAction`
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#copyPicturesToGalleryAction`
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#removeGalleryPicturesAction`
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#saveGalleryItemsAction`
  - `sa:apps/danamccool/src/lib/gallery-actions.ts#setGalleryItemOpensAction`

### gathering-detail-page-set (orgapps.editing)

Turn the designed page on for a gathering. Canonical: `services ensureThreadTalkRoom(threadId) used by all three.`.

- calls: (getApiEditor: signed in and canEdit = owner or guide), (raw UPDATE threads metadata detailPage), ensureRoom
  - `sa:apps/sunjay/src/lib/puck/event-actions.ts#setDetailPageAction`
- calls: (raw UPDATE threads nextcloud_talk_token), @elkdonis/services#createTalkRoom
  - `sql:apps/sunjay/src/lib/puck/event-actions.ts#ensureRoom`
- calls: @elkdonis/db#db
  - `sql:apps/sunjay/src/lib/puck/event-actions.ts#setDetailPageAction`

### he-attendance-set (apps.hidden-enneagram.hub)

Say how you will come to a meeting. Canonical: `services setMeetingAttendance behind one shared attendance route.`.

- calls: (getApiMember: owner, guide or member), (raw SELECT thread in org), @elkdonis/services#checkRsvpEligibility, @elkdonis/services#clearMeetingAttendance, @elkdonis/services#setMeetingAttendance
  - `api:apps/hidden-enneagram/src/app/api/center/attendance/route.ts#POST`
- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), (raw SELECT thread in org), @elkdonis/services#checkRsvpEligibility, @elkdonis/services#clearMeetingAttendance, @elkdonis/services#setMeetingAttendance
  - `api:apps/ifac/src/app/api/hub/meeting/attendance/route.ts#POST`
- calls: @elkdonis/services#checkRsvpEligibility, @elkdonis/services#clearMeetingAttendance, @elkdonis/services#setMeetingAttendance
  - `api:apps/innergathering/src/app/api/hub/meeting/attendance/route.ts#POST`
  - `api:apps/sunjay/src/app/api/center/attendance/route.ts#POST`

### he-audio-config-save (apps.hidden-enneagram.site)

Set the site's music. Canonical: `a site_config save helper shared with danamccool navigation (he-audio-config-save and dana-navigation-save are the same shape).`.

- calls: (cleanAudioConfig allow-list), (getApiEditor: owner or guide)
  - `sa:apps/hidden-enneagram/src/lib/audio-config-actions.ts#saveAudioConfigAction`
- calls: (raw INSERT site_config ... ON CONFLICT via withOrg(ORG))
  - `sql:apps/hidden-enneagram/src/lib/audio-config.ts#saveAudioConfig`

### he-chat-provision (apps.hidden-enneagram.hub)

Set up the team chat room. Canonical: `packages/chat createChatApi.`.

- calls: (withEditor: getApiEditor), @elkdonis/services#ensureOrgChatRoom
  - `api:apps/hidden-enneagram/src/app/api/chat/provision/route.ts#POST`
  - `api:apps/ifac/src/app/api/chat/provision/route.ts#POST`
- calls: @elkdonis/services#ensureOrgChatRoom
  - `api:apps/elktours/src/app/api/chat/provision/route.ts#POST`
  - `api:apps/innergathering/src/app/api/chat/provision/route.ts#POST`

### he-forum-act (apps.hidden-enneagram.hub)

Forum actions (door). Canonical: `packages/forum-ui handleForumAction (already shared).`.

- calls: @elkdonis/forum-ui#handleForumAction (21 action names)
  - `api:apps/hidden-enneagram/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction (21 action names; connectors from lib/forum.ts)
  - `api:apps/ifac/src/app/api/forum/[action]/route.ts#POST`
- calls: @elkdonis/forum-ui#handleForumAction, lib/forum#getForumConnectors
  - `api:apps/innergathering/src/app/api/forum/[action]/route.ts#POST`

### he-newsletter-save (apps.hidden-enneagram.site)

Save a newsletter letter. Canonical: `@elkdonis/newsletter saveNewsletter behind one route mount.`.

- calls: (findIfacSeries: must be an ifac series), (getApiEditor: owner or guide), @elkdonis/newsletter/server#saveNewsletter
  - `api:apps/ifac/src/app/api/newsletter/series/[id]/[slug]/route.ts#PUT`
- calls: (getApiEditor: owner or guide), @elkdonis/newsletter#isValidNewsletterSlug, @elkdonis/newsletter/server#saveNewsletter
  - `api:apps/hidden-enneagram/src/app/api/newsletter/[slug]/route.ts#PUT`
- calls: @elkdonis/newsletter/server#saveNewsletter
  - `api:apps/innergathering/src/app/api/newsletter/[slug]/route.ts#PUT`

### he-newsletter-send (apps.hidden-enneagram.site)

Send a newsletter letter. Canonical: `@elkdonis/newsletter sendNewsletter.`.

- calls: (getApiEditor: owner or guide), @elkdonis/newsletter/server#sendNewsletter
  - `api:apps/hidden-enneagram/src/app/api/newsletter/[slug]/send/route.ts#POST`
  - `api:apps/ifac/src/app/api/newsletter/series/[id]/[slug]/send/route.ts#POST`
- calls: @elkdonis/newsletter#publicBaseUrl, @elkdonis/newsletter/server#sendNewsletter
  - `api:apps/innergathering/src/app/api/newsletter/[slug]/send/route.ts#POST`

### he-pipeline-provision (apps.hidden-enneagram.hub)

Set up the board. Canonical: `packages/pipeline createPipelineApi routes mounted once (already the shape); remove the per-app route files in favour of one catch-all mount.`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/provision/route.ts#POST`
  - `api:apps/ifac/src/app/api/pipeline/provision/route.ts#POST`
- calls: @/lib/pipeline#provisionPipelineBoard
  - `api:apps/elktours/src/app/api/pipeline/provision/route.ts#POST`
- calls: lib/pipeline#provisionPipelineBoard
  - `api:apps/innergathering/src/app/api/pipeline/provision/route.ts#POST`

### he-sign-in-out (apps.hidden-enneagram.site)

Sign in and out of the site. Canonical: `packages/auth-server handlers mounted once per app (already shared).`.

- calls: @elkdonis/auth-server#createLoginHandler({ joinOrgs: [ifac as viewer] })
  - `api:apps/ifac/src/app/api/auth/login/route.ts#POST`
- calls: @elkdonis/auth-server#handleLogin
  - `api:apps/hidden-enneagram/src/app/api/auth/login/route.ts#POST`
- calls: @elkdonis/auth-server#handleLogout
  - `api:apps/hidden-enneagram/src/app/api/auth/logout/route.ts#POST`
  - `api:apps/ifac/src/app/api/auth/logout/route.ts#POST`

### home-hero-save (apps.art-auction.admin)

Choose the artists featured on the landing hero.

- calls: (lib) saveHeroSettings, @elkdonis/commerce/server#canEditSeries
  - `sa:apps/art-auction/src/app/admin/pages/hero-actions.ts#saveHeroAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/home-hero.ts#saveHeroSettings`

### home-welcome-save (apps.art-auction.admin)

Save the welcome letter.

- calls: (lib) saveWelcome
  - `sa:apps/art-auction/src/app/home-actions.ts#saveWelcomeAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/home-sections.ts#saveValue`

### hub-skin-save (orgapps.editing)

Change the hub's look. Canonical: `a hub section of the site-style kit action (services saveSiteTheme for the hub).`.

- calls: (getHubViewer then canEdit), local setHubSkin
  - `sa:apps/ifac/src/lib/hub-skin-actions.ts#saveHubSkinAction`
- calls: (raw INSERT site_config hub-skin ON CONFLICT)
  - `sql:apps/ifac/src/lib/hub-skin-store.ts#setHubSkin`

### ifac-directory-create (apps.ifac.manage)

Add an artist or dealer to the directory. Canonical: `services createUnclaimedProfile (used by artdirect createDossier).`.

- calls: (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac), @elkdonis/services#ensureUniqueUserSlug
  - `api:apps/ifac/src/app/api/manage/directory/route.ts#POST`
- calls: (raw INSERT users, INSERT org_profiles)
  - `sql:apps/ifac/src/lib/directory-admin.ts#createProfile`

### ifac-directory-delete (apps.ifac.manage)

Delete a directory profile. Canonical: `services removeOrgPerson / a dedicated deleteUnclaimedProfile.`.

- calls: (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac)
  - `api:apps/ifac/src/app/api/manage/directory/route.ts#DELETE`
- calls: (raw DELETE org_profiles WHERE org_id AND user_id, then DELETE users only if unclaimed and orphaned)
  - `sql:apps/ifac/src/lib/directory-admin.ts#deleteProfile`

### ifac-directory-edit (apps.ifac.manage)

Edit a directory profile. Canonical: `services updateProfile / canEditProfile with the org filter on the users write.`.

- calls: (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac), @elkdonis/services#ensureUniqueUserSlug, @elkdonis/services#noteUserSlugChange
  - `api:apps/ifac/src/app/api/manage/directory/route.ts#PATCH`
- calls: (raw UPDATE users then UPDATE org_profiles)
  - `sql:apps/ifac/src/lib/directory-admin.ts#updateProfile`

### ifac-directory-visibility (apps.ifac.manage)

Publish or hide a directory profile. Canonical: `services setOrgPersonListed.`.

- calls: (directory-admin setProfileVisibility), (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac)
  - `api:apps/ifac/src/app/api/manage/directory/route.ts#PATCH`
- calls: (raw UPDATE org_profiles SET is_public WHERE org_id AND user_id)
  - `sql:apps/ifac/src/lib/directory-admin.ts#setProfileVisibility`

### ifac-event-add (apps.ifac.manage)

Add an event to the home page. Canonical: `services saveMeetingContent behind the shared meeting-save kit action.`.

- calls: (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac), (raw INSERT INTO threads kind event status published visibility PUBLIC)
  - `api:apps/ifac/src/app/api/manage/events/route.ts#POST`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/db#db
  - `sql:apps/ifac/src/app/api/manage/events/route.ts#POST`

### ifac-image-upload (apps.ifac.account)

Upload a picture to a member page. Canonical: `services uploadUserFile (one upload path) with validateUploadBuffer and a per-app authorizer.`.

- calls: (getServerSession; memberSlug must match the viewer, or canManageIfac), @elkdonis/nextcloud#ensureUserFolder, @elkdonis/services#appendOrgPortfolio, @elkdonis/services#markArtist, @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/ifac/src/app/api/upload/route.ts#POST`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/db#db, @elkdonis/nextcloud#ensureUserFolder, @elkdonis/nextcloud#getAdminClient, @elkdonis/services#appendOrgPortfolio, @elkdonis/services#getProxyFileUrl, @elkdonis/services#markArtist, @elkdonis/services#uploadFile, @elkdonis/services#uploadFilename, @elkdonis/utils#validateUploadBuffer
  - `sql:apps/ifac/src/app/api/upload/route.ts#POST`

### ifac-manage-person-list (apps.ifac.manage)

List or unlist a member in the directory. Canonical: `services setOrgPersonListed via the kit.`.

- calls: (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac), (lib/manage setMemberListed: own row or guard)
  - `api:apps/ifac/src/app/api/manage/people/route.ts#PATCH`
- calls: (raw UPDATE org_profiles SET tags = array_append ... then directory-admin setProfileVisibility)
  - `sql:apps/ifac/src/lib/manage.ts#setMemberListed`

### ifac-showcase-pin (apps.ifac.hub)

Pin or unpin a post on the showcase. Canonical: `services setThreadPinned if other sites get a showcase.`.

- calls: (getHubViewer then viewer.canEdit = owner or guide), (raw UPDATE threads SET pinned ... WHERE id AND org_id)
  - `sa:apps/ifac/src/lib/showcase-actions.ts#setThreadPinnedAction`
- calls: @elkdonis/db#db
  - `sql:apps/ifac/src/lib/showcase-actions.ts#setThreadPinnedAction`

### ifac-site-section-save (apps.ifac.manage)

Edit a section of the home page. Canonical: `the shared saveSectionAction kit action (orgapps.cms site-section-copy-save).`.

- calls: (getIfacManager / canManageIfac: ownerEmails allowlist, global admin, or owner/guide row in ifac), (isSectionKey allow-list), (raw INSERT org_site_sections ... ON CONFLICT DO UPDATE)
  - `api:apps/ifac/src/app/api/manage/content/route.ts#POST`
- calls: @elkdonis/auth-server#getServerSession, @elkdonis/db#db
  - `sql:apps/ifac/src/app/api/manage/content/route.ts#POST`

### ifac-store-payees (orgapps.money)

Manage the store's charity and beneficiary payees. Canonical: `commerce payee functions via the shared hub Business card.`.

- calls: @elkdonis/commerce/server#addCharityPayee
  - `sa:apps/ifac/src/lib/cms/store-actions.ts#addIfacCharityAction`
- calls: @elkdonis/commerce/server#addOrgBeneficiary
  - `sa:apps/ifac/src/lib/cms/store-actions.ts#addIfacOrgBeneficiaryAction`
- calls: @elkdonis/commerce/server#approvePayee
  - `sa:apps/ifac/src/lib/cms/store-actions.ts#approveIfacPayeeAction`
- calls: @elkdonis/commerce/server#removeOrgBeneficiary
  - `sa:apps/ifac/src/lib/cms/store-actions.ts#removeIfacBeneficiaryAction`

### ifac-store-team (orgapps.money)

Change the store's team. Canonical: `commerce addStoreMemberByEmail / removeStoreMember with canManageStoreTeam inside both.`.

- calls: @elkdonis/commerce/queries#getStoreForOrg, @elkdonis/commerce/server#addStoreMemberByEmail
  - `sa:apps/ifac/src/lib/cms/store-actions.ts#addIfacStoreMemberAction`
- calls: @elkdonis/commerce/queries#getStoreForOrg, @elkdonis/commerce/server#canManageStoreTeam, @elkdonis/commerce/server#removeStoreMember
  - `sa:apps/ifac/src/lib/cms/store-actions.ts#removeIfacStoreMemberAction`

### ig-email-template-reset (apps.innergathering.hub)

Put an email back to the default wording. Canonical: `clearOrgTemplate behind the same shared kit route as save-email-template`.

- calls: (getApiEditor: owner or guide), @elkdonis/email#clearOrgTemplate
  - `api:apps/ifac/src/app/api/hub/email/[key]/route.ts#DELETE`
- calls: @elkdonis/email#clearOrgTemplate
  - `api:apps/innergathering/src/app/api/hub/email/[key]/route.ts#DELETE`

### ig-email-template-test (apps.innergathering.hub)

Send yourself a test of an email. Canonical: `one shared kit route for the email suite`.

- calls: (getApiEditor: owner or guide), @elkdonis/email#renderAdvancedEmail, @elkdonis/email#renderSample, @elkdonis/email#sendEmail
  - `api:apps/ifac/src/app/api/hub/email/[key]/test/route.ts#POST`
- calls: @elkdonis/email#renderAdvancedEmail, @elkdonis/email#renderSample, @elkdonis/email#sendEmail
  - `api:apps/innergathering/src/app/api/hub/email/[key]/test/route.ts#POST`

### ig-meeting-light-clear (apps.innergathering.hub)

Clear the light on a meeting. Canonical: `services clearMeetingLight behind one shared kit route`.

- calls: (getHubViewer then viewer.canEdit = owner or guide), @elkdonis/services#clearMeetingLight
  - `api:apps/ifac/src/app/api/hub/meeting/light/route.ts#POST`
- calls: @elkdonis/services#clearMeetingLight
  - `api:apps/innergathering/src/app/api/hub/meeting/light/route.ts#POST`

### ig-meeting-light-set (apps.innergathering.hub)

Set the light on a meeting. Canonical: `services setMeetingLight / isOccurrenceHost behind one shared kit route`.

- calls: (editor, or isOccurrenceHost for that occurrence), (getHubViewer: owner, guide or member of ifac via hasOrgRole), @elkdonis/services#setMeetingLight
  - `api:apps/ifac/src/app/api/hub/meeting/light/route.ts#POST`
- calls: @elkdonis/services#isOccurrenceHost, @elkdonis/services#setMeetingLight
  - `api:apps/innergathering/src/app/api/hub/meeting/light/route.ts#POST`

### ig-meeting-plan-save (apps.innergathering.hub)

Say what a week’s meeting covers. Canonical: `services setOccurrencePlan behind one shared kit route`.

- calls: (editor, or that occurrence host/co-host via getRoleHolder), (getApiMember: owner, guide or member), @elkdonis/services#setOccurrencePlan
  - `api:apps/ifac/src/app/api/hub/meeting/rota/route.ts#POST`
- calls: @elkdonis/services#getRoleHolder, @elkdonis/services#setOccurrencePlan
  - `api:apps/innergathering/src/app/api/hub/meeting/rota/route.ts#POST`

### ig-meeting-record-save (apps.innergathering.hub)

Write up what happened at a meeting. Canonical: `services saveOccurrenceRecord behind one shared kit route`.

- calls: (getApiMember: owner, guide or member), (raw SELECT thread in org), @elkdonis/services#saveOccurrenceRecord
  - `api:apps/ifac/src/app/api/hub/meeting/record/route.ts#POST`
- calls: @elkdonis/services#saveOccurrenceRecord
  - `api:apps/innergathering/src/app/api/hub/meeting/record/route.ts#POST`

### ig-meeting-rota-assign (apps.innergathering.hub)

Put someone on a meeting’s rota. Canonical: `services assignMeetingRole behind one shared kit route`.

- calls: (getApiMember: owner, guide or member), (self-assign allowed; others need owner or guide), @elkdonis/services#assignMeetingRole
  - `api:apps/ifac/src/app/api/hub/meeting/rota/route.ts#POST`
- calls: @elkdonis/services#assignMeetingRole
  - `api:apps/innergathering/src/app/api/hub/meeting/rota/route.ts#POST`

### ig-meeting-rota-clear (apps.innergathering.hub)

Take someone off a meeting’s rota. Canonical: `services clearMeetingRole behind one shared kit route`.

- calls: (getApiMember: owner, guide or member), @elkdonis/services#clearMeetingRole, @elkdonis/services#getRoleHolder
  - `api:apps/ifac/src/app/api/hub/meeting/rota/route.ts#POST`
- calls: @elkdonis/services#clearMeetingRole, @elkdonis/services#getRoleHolder
  - `api:apps/innergathering/src/app/api/hub/meeting/rota/route.ts#POST`

### ig-nextcloud-sign-in (apps.innergathering.system)

Sign in to Nextcloud with the network account. Canonical: `this app (innergathering) is the one provider: Nextcloud points at https://elkdonis-arts.org/api/oidc/*; keep it here, delete the inner-gathering copy with the app`.

- calls: (raw SQL DELETE from oidc_codes)
  - `sql:apps/innergathering/src/lib/oidc.ts#validateAuthCode`
- calls: (raw SQL INSERT into oidc_codes)
  - `sql:apps/innergathering/src/lib/oidc.ts#createAuthCode`
- calls: @elkdonis/auth-server#getVerifiedSession, lib/oidc#createAuthCode
  - `sql:apps/innergathering/src/app/api/oidc/authorize/route.ts#GET`
- calls: lib/oidc#generateIdToken, lib/oidc#validateAuthCode
  - `api:apps/innergathering/src/app/api/oidc/token/route.ts#POST`

### ig-portfolio-save (apps.innergathering.center)

Choose a portfolio for this site. Canonical: `services sitePortfolioRoutes (already shared); mount only`.

- calls: (sitePortfolioRoutes: canEditProfile(viewer, person) = self or global admin), @elkdonis/services#setOrgPortfolio
  - `api:apps/hidden-enneagram/src/app/api/center/portfolio/route.ts#PUT`
- calls: @elkdonis/services#sitePortfolioRoutes
  - `api:apps/innergathering/src/app/api/center/portfolio/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/center/portfolio/route.ts#PUT`

### ig-portfolio-upload (apps.innergathering.center)

Upload a portfolio image. Canonical: `services sitePortfolioRoutes (already shared); mount only`.

- calls: (sitePortfolioRoutes: canEditProfile = self or global admin), @elkdonis/services#uploadUserFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/hidden-enneagram/src/app/api/center/portfolio/route.ts#POST`
- calls: @elkdonis/services#sitePortfolioRoutes
  - `api:apps/innergathering/src/app/api/center/portfolio/route.ts#POST`
  - `api:apps/sunjay/src/app/api/center/portfolio/route.ts#POST`

### ig-question-answer (apps.innergathering.gatherings)

Answer the question of the week. Canonical: `a services function saveWorkQuestionResponse behind one shared kit route`.

- calls: (raw SQL INSERT into work_question_responses), @elkdonis/services#getProfile
  - `api:apps/innergathering/src/app/api/work-question/route.ts#POST`
- calls: (raw SQL in the same function)
  - `sql:apps/innergathering/src/app/api/work-question/route.ts#POST`

### ig-rsvp-join (apps.innergathering.gatherings)

Join a gathering. Canonical: `one shared handler in @elkdonis/services (rsvpHandlers, like connectionsHandlers) that each app mounts`.

- calls: (raw SQL in the same function)
  - `sql:apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: @elkdonis/checkout/stripe#startStripeCheckout, @elkdonis/commerce/server#createThreadOrder, @elkdonis/email#sendRsvpConfirmation, @elkdonis/services#checkRsvpEligibility, @elkdonis/services#setRsvpStatus
  - `api:apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts#POST`

### ig-video-job-review (apps.innergathering.gatherings)

Review, retry or approve a video. Canonical: `services video-pipeline functions behind one shared kit action`.

- calls: @elkdonis/services#approveVideoJob
  - `sa:apps/innergathering/src/lib/cms/video-actions.ts#approveVideoJobAction`
- calls: @elkdonis/services#requeueVideoJob
  - `sa:apps/innergathering/src/lib/cms/video-actions.ts#retryVideoJobAction`
- calls: @elkdonis/services#requeueVideoJob, @elkdonis/services#updateVideoJobReview
  - `sa:apps/innergathering/src/lib/cms/video-actions.ts#saveVideoJobAction`

### ig-video-pipeline-save (apps.innergathering.gatherings)

Set up an automatic video pipeline. Canonical: `services createVideoPipeline / updateVideoPipeline behind one shared kit action`.

- calls: @elkdonis/services#createVideoPipeline
  - `sa:apps/innergathering/src/lib/cms/video-actions.ts#createVideoPipelineAction`
- calls: @elkdonis/services#updateVideoPipeline
  - `sa:apps/innergathering/src/lib/cms/video-actions.ts#updateVideoPipelineAction`

### installation-create (apps.art-auction.studio)

Create a hallway installation.

- calls: (none resolved)
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#createInstallationAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/installations.ts#createInstallation`
  - `sql:apps/art-auction/src/lib/installations.ts#createOrgInstallation`

### installation-delete (apps.art-auction.studio)

Delete an installation.

- calls: (lib) deleteInstallation
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#deleteInstallationAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/installations.ts#deleteInstallation`

### installation-layout-save (apps.art-auction.studio)

Save an installation's layout.

- calls: (lib) saveInstallationLayout, cleanPieces
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#saveLayoutAction`
- calls: @elkdonis/three/hallway/model#normalizeLamp
  - `sql:apps/art-auction/src/lib/installations.ts#saveInstallationLayout`

### installation-publish-toggle (apps.art-auction.studio)

Publish or unpublish an installation.

- calls: (lib) updateInstallation
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#setInstallationStatusAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/installations.ts#updateInstallation`

### installation-rename (apps.art-auction.studio)

Rename an installation.

- calls: (lib) updateInstallation
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#renameInstallationAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/lib/installations.ts#updateInstallation`

### installation-scene-save (apps.art-auction.studio)

Save an installation's lighting.

- calls: (lib) saveInstallationScene
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#saveSceneAction`
- calls: @elkdonis/db#db, @elkdonis/three/hallway/model#normalizeScene
  - `sql:apps/art-auction/src/lib/installations.ts#saveInstallationScene`

### installation-venue-set (apps.art-auction.studio)

Change an installation's space.

- calls: (lib) setInstallationVenue
  - `sa:apps/art-auction/src/app/studio/installations/actions.ts#setInstallationVenueAction`
- calls: (none resolved)
  - `sql:apps/art-auction/src/lib/installations.ts#setInstallationVenue`

### katie-claim-link-create (apps.katie-the-potter.claim)

Create the hand-over link. Canonical: `extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks`.

- calls: (none resolved)
  - `sql:apps/katie-the-potter/src/lib/manage-claim.ts#createClaimToken`
- calls: lib/manage-claim.ts#createClaimToken
  - `sa:apps/katie-the-potter/src/lib/claim-actions.ts#createClaimLinkAction`

### katie-claim-link-revoke (apps.katie-the-potter.claim)

Cancel the hand-over link. Canonical: `extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks`.

- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/manage-claim.ts#revokeClaimTokens`
- calls: lib/manage-claim.ts#revokeClaimTokens
  - `sa:apps/katie-the-potter/src/lib/claim-actions.ts#revokeClaimLinksAction`

### katie-claim-redeem (apps.katie-the-potter.claim)

Take over the site with a hand-over link. Canonical: `extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks`.

- calls: (none resolved)
  - `sql:apps/katie-the-potter/src/lib/manage-claim.ts#redeemClaim`
- calls: lib/manage-claim.ts#redeemClaim, lib/site-store.ts#ensurePictureFolder
  - `sa:apps/katie-the-potter/src/lib/claim-actions.ts#redeemClaimAction`

### katie-piece-shown-as-set (apps.katie-the-potter.site)

Switch how a piece is shown. Canonical: `@elkdonis/commerce/server#publishArtwork / archiveArtwork behind one shared kit action; move the metadata.site flag into a real column`.

- calls: (raw UPDATE artwork metadata site), @elkdonis/commerce/server#publishArtwork, archiveArtwork
  - `sa:apps/katie-the-potter/src/lib/manage-actions.ts#setShownAsAction`
- calls: @elkdonis/commerce/server#archiveArtwork, @elkdonis/commerce/server#publishArtwork, @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/manage-actions.ts#setShownAsAction`

### katie-samples-retire (apps.katie-the-potter.site)

Retire all sample pieces. Canonical: `@elkdonis/commerce/server#archiveArtwork per piece`.

- calls: (raw UPDATE artwork status archived)
  - `sa:apps/katie-the-potter/src/lib/manage-actions.ts#retireSamplesAction`
- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/manage-actions.ts#retireSamplesAction`

### landing-loft-save (apps.art-auction.admin)

Save the landing loft.

- calls: (lib) saveInstallationLayout
  - `sa:apps/art-auction/src/app/admin/loft/actions.ts#saveLandingLayoutAction`
- calls: (lib) saveInstallationScene
  - `sa:apps/art-auction/src/app/admin/loft/actions.ts#saveLandingSceneAction`

### landing-restore (orgapps.editing)

Put the home page back as it was written in code. Canonical: `page-builder deletePage(orgId, slug) plus a one-step undo (keep the last version), behind a kit action.`.

- calls: (getApiEditor: signed in and canEdit = owner or guide), local deletePage
  - `sa:apps/elktours/src/lib/puck/actions.ts#restoreLandingAction`
  - `sa:apps/innergathering/src/lib/puck/actions.ts#restoreLandingAction`
  - `sa:apps/sunjay/src/lib/puck/actions.ts#restoreLandingAction`
- calls: (raw DELETE site_config puck:<slug>), @elkdonis/db#withOrg
  - `sql:apps/elktours/src/lib/puck/store.ts#deletePage`
  - `sql:apps/innergathering/src/lib/puck/store.ts#deletePage`
  - `sql:apps/sunjay/src/lib/puck/store.ts#deletePage`

### landing-save (orgapps.editing)

Publish the home page tree. Canonical: `the page-save kit action with slug = LANDING_SLUG.`.

- calls: (getApiEditor: signed in and canEdit = owner or guide), cleanBoxDoc(stripResolved), local savePage
  - `sa:apps/sunjay/src/lib/puck/actions.ts#saveLandingAction`
- calls: (getApiEditor: signed in and canEdit = owner or guide), cleanBoxDoc(stripResolvedKeys), local savePage
  - `sa:apps/elktours/src/lib/puck/actions.ts#saveLandingAction`

### lot-create (apps.art-auction.studio)

Put a piece up for auction. Canonical: `@elkdonis/commerce/server#createLot`.

- calls: @elkdonis/commerce/server#createLot, @elkdonis/db#db
  - `sa:apps/art-auction/src/app/studio/actions.ts#createLotAction`
- calls: @elkdonis/db#db
  - `sql:apps/art-auction/src/app/studio/actions.ts#createLotAction`

### manage-content-pin (orgapps.cms)

Pin a post to the top of the landing page. Canonical: `services pinThread(org, id, on) behind the kit action; one pin concept for the network (threads.pinned).`.

- calls: (raw UPDATE threads pinned), (requireOrgEditor: signed in and canEdit = owner or guide)
  - `sa:apps/amrit-canada/src/lib/cms/actions.ts#setContentPinnedAction`
  - `sa:apps/elktours/src/lib/cms/actions.ts#setContentPinnedAction`
- calls: @elkdonis/db#db
  - `sql:apps/amrit-canada/src/lib/cms/actions.ts#setContentPinnedAction`
  - `sql:apps/elktours/src/lib/cms/actions.ts#setContentPinnedAction`

### manage-content-save (orgapps.cms)

Write or edit a post, gathering or service in the site manager. Canonical: `services saveMeetingContent / savePostContent (what the hub compose pop-ups already use) behind one org-site kit action; retire the per-app cms saveContentAction in favour of it, keeping the merge-metadata, series guard, audience and sanitise behaviour as the superset. Service offerings stay on services upsertServiceOffering.`.

- calls: (getHubViewer: any member; non-posts need canEdit), @elkdonis/services#createThread, @elkdonis/services#saveSeriesSchedule, @elkdonis/services#saveSeriesSettings, @elkdonis/services#statusForNewThread
  - `sa:apps/ifac/src/lib/cms/actions.ts#saveContentAction`
- calls: (raw INSERT/UPDATE threads for posts), (requireOrgEditor: signed in and canEdit = owner or guide), @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#getOrgFeed, @elkdonis/services#upsertServiceOffering
  - `sa:apps/hidden-enneagram/src/lib/cms/actions.ts#saveContentAction`
- calls: (raw INSERT/UPDATE threads in the action), (requireOrgEditor: signed in and canEdit = owner or guide), @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#getOrgFeed, @elkdonis/utils#sanitizeRichText
  - `sa:apps/amrit-canada/src/lib/cms/actions.ts#saveContentAction`
  - `sa:apps/elktours/src/lib/cms/actions.ts#saveContentAction`
  - `sa:apps/innergathering/src/lib/cms/actions.ts#saveContentAction`
  - `sa:apps/sunjay/src/lib/cms/actions.ts#saveContentAction`
- calls: (raw UPDATE media in the action file)
  - `sql:apps/amrit-canada/src/lib/cms/actions.ts#attachMaterials`
  - `sql:apps/elktours/src/lib/cms/actions.ts#attachMaterials`
  - `sql:apps/innergathering/src/lib/cms/actions.ts#attachMaterials`
  - `sql:apps/sunjay/src/lib/cms/actions.ts#attachMaterials`
- calls: (raw UPDATE threads), @elkdonis/services#createCollaborativeDocument, @elkdonis/services#createTalkRoom
  - `sql:apps/amrit-canada/src/lib/cms/actions.ts#provisionNextcloud`
  - `sql:apps/elktours/src/lib/cms/actions.ts#provisionNextcloud`
  - `sql:apps/innergathering/src/lib/cms/actions.ts#provisionNextcloud`
  - `sql:apps/sunjay/src/lib/cms/actions.ts#provisionNextcloud`
- calls: @elkdonis/db#db, @elkdonis/services#createThread, @elkdonis/services#statusForNewThread
  - `sql:apps/ifac/src/lib/cms/actions.ts#saveContentAction`
- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#getOrgFeed, @elkdonis/services#upsertServiceOffering, @elkdonis/utils#deriveExcerpt, @elkdonis/utils#sanitizeRichText
  - `sql:apps/hidden-enneagram/src/lib/cms/actions.ts#saveContentAction`
- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#getOrgFeed, @elkdonis/services/thread-audience#audienceToStorage, @elkdonis/services/thread-audience#canViewThread, @elkdonis/utils#deriveExcerpt, @elkdonis/utils#sanitizeRichText
  - `sql:apps/innergathering/src/lib/cms/actions.ts#saveContentAction`
- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#getOrgFeed, @elkdonis/utils#deriveExcerpt, @elkdonis/utils#sanitizeRichText
  - `sql:apps/amrit-canada/src/lib/cms/actions.ts#saveContentAction`
  - `sql:apps/elktours/src/lib/cms/actions.ts#saveContentAction`
  - `sql:apps/sunjay/src/lib/cms/actions.ts#saveContentAction`
- calls: @elkdonis/services#createCollaborativeDocument, @elkdonis/services#createTalkRoom
  - `sql:apps/ifac/src/lib/cms/actions.ts#attachRooms`
- calls: @elkdonis/services#createThread, @elkdonis/services#ensureSeriesTalkRoom, @elkdonis/services#saveSeriesSchedule
  - `sql:apps/ifac/src/lib/cms/actions.ts#createSeries`
- calls: @elkdonis/services#removeThreadFromCalendar, @elkdonis/services#saveSeriesSettings, @elkdonis/utils#sanitizePostBody
  - `sql:apps/ifac/src/lib/cms/actions.ts#updateExisting`

### manage-content-status-set (orgapps.cms)

Publish or unpublish a post. Canonical: `a services setThreadStatus(org, id, status) used by one kit action; the same function should drive the hub review-queue publish.`.

- calls: (raw UPDATE threads status, published_at), (requireOrgEditor: signed in and canEdit = owner or guide)
  - `sa:apps/amrit-canada/src/lib/cms/actions.ts#setContentStatusAction`
  - `sa:apps/elktours/src/lib/cms/actions.ts#setContentStatusAction`
  - `sa:apps/hidden-enneagram/src/lib/cms/actions.ts#setContentStatusAction`
  - `sa:apps/innergathering/src/lib/cms/actions.ts#setContentStatusAction`
  - `sa:apps/sunjay/src/lib/cms/actions.ts#setContentStatusAction`
- calls: @elkdonis/db#db
  - `sql:apps/amrit-canada/src/lib/cms/actions.ts#setContentStatusAction`
  - `sql:apps/elktours/src/lib/cms/actions.ts#setContentStatusAction`
  - `sql:apps/hidden-enneagram/src/lib/cms/actions.ts#setContentStatusAction`
  - `sql:apps/innergathering/src/lib/cms/actions.ts#setContentStatusAction`
  - `sql:apps/sunjay/src/lib/cms/actions.ts#setContentStatusAction`

### mark-inbox-message (arts-collective.hub)

Mark an inbox message read or archived.

- calls: (getApiEditor: owner or guide), @elkdonis/email#setInboxState
  - `api:apps/ifac/src/app/api/hub/email/messages/[id]/route.ts#PATCH`
- calls: @elkdonis/email#setInboxState
  - `api:apps/innergathering/src/app/api/hub/email/messages/[id]/route.ts#PATCH`
- calls: setInboxState
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/messages/[id]/route.ts#PATCH`

### meeting-save (orgapps.meetings)

Save a meeting or event. Canonical: `services saveMeetingContent behind one shared 'use server' action in the planned org-site kit (packages/org-site) taking {siteConfig, viewerResolver, hrefFor(record), revalidate(record)} so only the route templates are per-app.`.

- calls: (delegates to siteMeetingSaveAction with kind:"event")
  - `sa:apps/sunjay/src/lib/forms/event-actions.ts#siteEventSaveAction`
- calls: @elkdonis/services#saveMeetingContent, @elkdonis/site-forms/server#siteOrg
  - `sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction`
  - `sa:apps/elktours/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction`
  - `sa:apps/ifac/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction`
  - `sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction`
  - `sa:apps/sunjay/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction`
- calls: saveMeetingContent
  - `sa:apps/arts-collective/src/lib/meeting-actions.ts#saveMeetingAction`

### open-silex-editor (arts-collective.sites)

Open the Silex site editor.

- calls: @elkdonis/auth-server#getServerSession, @elkdonis/db#db, @elkdonis/nextcloud#getAdminClient, @elkdonis/nextcloud#getOrgFolderPath, @elkdonis/nextcloud#provisionOrgOnNextcloud, @elkdonis/silex-render#mintSilexToken
  - `sql:apps/arts-collective/src/app/api/silex/token/route.ts#POST`
- calls: nextcloud#provisionOrgOnNextcloud, silex-render#mintSilexToken
  - `api:apps/arts-collective/src/app/api/silex/token/route.ts#POST`

### order-cancel (apps.art-auction.studio)

Cancel an unpaid order.

- calls: @elkdonis/commerce/server#canActForOrder, @elkdonis/commerce/server#cancelOrder
  - `sa:apps/art-auction/src/app/studio/actions.ts#cancelOrderAction`
- calls: @elkdonis/commerce/server#cancelOrder
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminCancelOrder`

### order-confirm-paid (apps.art-auction.studio)

Confirm an order is paid. Canonical: `@elkdonis/commerce/server#confirmOrderPaid behind one action that takes the gate as a parameter`.

- calls: @elkdonis/commerce/server#canActForOrder, @elkdonis/commerce/server#confirmOrderPaid
  - `sa:apps/art-auction/src/app/studio/actions.ts#confirmOrderPaidAction`
- calls: @elkdonis/commerce/server#canConfirmSeriesPayment, @elkdonis/commerce/server#confirmOrderPaid
  - `sa:apps/art-auction/src/app/series/[slug]/manage/orders/actions.ts#confirmPaidAction`
- calls: @elkdonis/commerce/server#confirmOrderPaid
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminConfirmOrder`

### order-fulfil (apps.art-auction.studio)

Mark an order as fulfilled.

- calls: @elkdonis/commerce/server#canActForOrder, @elkdonis/commerce/server#markOrderFulfilled
  - `sa:apps/art-auction/src/app/studio/actions.ts#fulfilOrderAction`
- calls: @elkdonis/commerce/server#markOrderFulfilled
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminFulfilOrder`

### order-mark-shipped (orgapps.commerce.shop)

Mark an order shipped.

- calls: @elkdonis/commerce/server#markOrderFulfilled
  - `sa:apps/katie-the-potter/src/lib/manage-actions.ts#shipOrderAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/orders.ts#markOrderFulfilled`

### order-payment-confirm (orgapps.commerce.shop)

Confirm an order is paid (eTransfer or manual). Canonical: `katie's gate (store, manager, method matches) inside a single confirmOrderPaid wrapper.`.

- calls: (none resolved)
  - `sql:packages/commerce/src/server/orders.ts#confirmOrderPaid`
- calls: @elkdonis/commerce/server#confirmEtransferReceived
  - `api:apps/admin/src/app/api/orders/route.ts#POST`
- calls: @elkdonis/commerce/server#confirmOrderPaid
  - `sa:apps/katie-the-potter/src/lib/manage-actions.ts#confirmEtransferAction`

### order-refund (apps.art-auction.studio)

Refund an order.

- calls: @elkdonis/checkout/stripe#refundStripeOrder, @elkdonis/commerce/queries#getOrderById, @elkdonis/commerce/server#refundOrder
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminRefundOrder`
- calls: @elkdonis/commerce/server#canActForOrder, @elkdonis/commerce/server#refundOrder, @elkdonis/db#db (payment_method read)
  - `sa:apps/art-auction/src/app/studio/actions.ts#refundOrderAction`

### order-refund-record (orgapps.commerce.shop)

Record a refund of an eTransfer sale.

- calls: (none resolved)
  - `sql:packages/commerce/src/server/orders.ts#refundOrder`
- calls: @elkdonis/commerce/server#refundOrder
  - `sa:apps/katie-the-potter/src/lib/manage-actions.ts#refundOrderAction`

### order-shipping-choose (orgapps.commerce.shipping)

Choose shipping for an unpaid marketplace order. Canonical: `commerce chooseOrderShipping.`.

- calls: @elkdonis/commerce/server#switchOrderToEtransfer, @elkdonis/commerce/shipping#chooseOrderShipping
  - `sa:apps/art-auction/src/app/orders/[id]/shipping-actions.ts#chooseShippingAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/shipping/index.ts#chooseOrderShipping`

### org-person-listed-set (orgapps.people)

List or unlist a person on the org page. Canonical: `services setOrgPersonListed via the kit (and the hub Members card).`.

- calls: @elkdonis/services#canManageOrgPeople, @elkdonis/services#setOrgPersonListed
  - `sa:apps/ifac/src/lib/cms/org-people-actions.ts#setOrgPersonListedAction`
  - `sa:apps/innergathering/src/lib/cms/org-people-actions.ts#setOrgPersonListedAction`
- calls: canManageOrgPeople, setOrgPersonListed
  - `sa:apps/arts-collective/src/lib/cms/org-people-actions.ts#setOrgPersonListedAction`
- calls: performHubAction
  - `sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction`

### org-person-role-set (orgapps.people)

Change someone's role in the organisation. Canonical: `services setOrgPersonRole (actor check inside services) via one kit action; also mounted in the hub Members card.`.

- calls: @elkdonis/services#canManageOrgPeople, @elkdonis/services#setOrgPersonRole
  - `sa:apps/ifac/src/lib/cms/org-people-actions.ts#setOrgPersonRoleAction`
  - `sa:apps/innergathering/src/lib/cms/org-people-actions.ts#setOrgPersonRoleAction`
- calls: canManageOrgPeople, setOrgPersonRole
  - `sa:apps/arts-collective/src/lib/cms/org-people-actions.ts#setOrgPersonRoleAction`
- calls: performHubAction
  - `sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction`
- calls: setOrgRole
  - `api:apps/arts-collective/src/app/api/org/[slug]/members/[userId]/route.ts#PATCH`

### org-site-create (orgapps.journeys)

Start an organisation site. Canonical: `services createOrganizationForUser through the existing registry door, so the dock runs one path.`.

- calls: @elkdonis/services#createOrganizationForUser
  - `sa:apps/ifac/src/lib/cms/journey-actions.ts#createSiteAction`
  - `sa:apps/innergathering/src/lib/cms/journey-actions.ts#createSiteAction`
- calls: createOrganizationForUser
  - `api:apps/arts-collective/src/app/api/org/create/route.ts#POST`
- calls: runAction(org)
  - `sa:apps/arts-collective/src/lib/cms/journey-actions.ts#createSiteAction`

### own-service-save (orgapps.money)

Save one of my services. Canonical: `services saveOffering via one kit action; currency from site config.`.

- calls: (getCurrentUser: any signed-in person), @elkdonis/services#saveOffering, @elkdonis/services#serviceInputFromAnswers
  - `sa:apps/artdirect/src/lib/offering-actions.ts#saveOfferingAction`
- calls: @elkdonis/services#saveOffering
  - `sa:apps/ifac/src/lib/cms/own-service-actions.ts#saveOwnServiceAction`
  - `sa:apps/innergathering/src/lib/cms/own-service-actions.ts#saveOwnServiceAction`
- calls: saveOffering
  - `sa:apps/arts-collective/src/lib/cms/own-service-actions.ts#saveOwnServiceAction`

### own-service-status (orgapps.money)

Publish or unpublish one of my services. Canonical: `services setOfferingStatus via the kit.`.

- calls: (getCurrentUser: any signed-in person), @elkdonis/services#setOfferingStatus (owner check inside services)
  - `sa:apps/artdirect/src/lib/offering-actions.ts#setOfferingStatusAction`
- calls: @elkdonis/services#setOfferingStatus
  - `sa:apps/ifac/src/lib/cms/own-service-actions.ts#setOwnServiceStatusAction`
  - `sa:apps/innergathering/src/lib/cms/own-service-actions.ts#setOwnServiceStatusAction`
- calls: setOfferingStatus
  - `sa:apps/arts-collective/src/lib/cms/own-service-actions.ts#setOwnServiceStatusAction`

### page-edits-save (orgapps.editing)

Save edits to the home page text. Canonical: `fold into page-save: one document model per site.`.

- calls: (getViewer().canEdit), (page allow-list: home only), @elkdonis/direct-edit/block#cleanPatches, local savePageEdits
  - `sa:apps/innergathering/src/lib/page-edits-actions.ts#savePageEditsAction`
- calls: (raw INSERT site_config ON CONFLICT), @elkdonis/db#withOrg
  - `sql:apps/innergathering/src/lib/page-edits.ts#savePageEdits`

### page-save (orgapps.editing)

Publish a page from the visual editor. Canonical: `one shared action in the planned org-site kit: gate getApiEditor, services/page-builder savePageContent that does cleanBoxDoc + stripResolved(config RESOLVED_KEYS) + reserved-slug and feed check (hooks per app), then savePage and revalidate by a per-app route map.`.

- calls: (getApiEditor: signed in and canEdit = owner or guide), (isMobileKey), cleanBoxDoc(stripResolvedKeys), local savePage
  - `sa:apps/elktours/src/lib/puck/mobile-actions.ts#saveMobileDocAction`
- calls: (getApiEditor: signed in and canEdit = owner or guide), (isValidSlug and not ROUTE_SLUGS), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>), cleanBoxDoc(stripResolvedKeys)
  - `sa:apps/hidden-enneagram/src/lib/puck/actions.ts#savePageAction`
- calls: (getApiEditor: signed in and canEdit = owner or guide), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>), cleanBoxDoc
  - `sa:apps/innergathering/src/lib/puck/actions.ts#savePageAction`
- calls: (getApiEditor: signed in and canEdit = owner or guide), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>), cleanBoxDoc(stripResolved), slugProblem (valid slug, not reserved, not a feed; templates allowed)
  - `sa:apps/sunjay/src/lib/puck/actions.ts#savePageAction`
- calls: (getApiEditor: signed in and canEdit = owner or guide), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>), cleanBoxDoc(stripResolvedKeys)
  - `sa:apps/katie-the-potter/src/lib/puck/actions.ts#savePageAction`
- calls: (getApiEditor: signed in and canEdit = owner or guide), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>), cleanBoxDoc(stripResolvedKeys), slugProblem (valid, not reserved, not a feed)
  - `sa:apps/elktours/src/lib/puck/actions.ts#savePageAction`
- calls: (getPagesEditor from lib/puck/auth), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>), slugProblem (valid, not reserved), stripResolved
  - `sa:apps/art-auction/src/lib/puck/actions.ts#savePageAction`
- calls: (getViewer().canEdit), @elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>)
  - `sa:apps/danamccool/src/lib/puck/actions.ts#savePageAction`
- calls: isExperiencePerson, raw SQL UPDATE threads
  - `sa:apps/elktours/src/lib/experience-actions.ts#saveExperiencePageAction`
- calls: raw SQL
  - `sql:apps/elktours/src/lib/experience-actions.ts#saveExperiencePageAction`
- calls: readExperienceLayout, saveExperiencePageAction
  - `sa:apps/elktours/src/app/studio/actions.ts#publishExperiencePageAction`

### payout-disconnect (orgapps.money)

Disconnect my payout account. Canonical: `checkout disconnectPayoutsFor via one kit action.`.

- calls: (getViewer: any signed-in person), @elkdonis/checkout/stripe#disconnectPayoutsFor
  - `sa:apps/innergathering/src/lib/cms/blog-actions.ts#disconnectPayoutsAction`
- calls: @elkdonis/checkout/stripe#disconnectPayoutsFor
  - `sa:apps/elktours/src/lib/payout-actions.ts#disconnectPayoutsAction`
  - `sa:apps/ifac/src/lib/cms/payout-actions.ts#disconnectPayoutsAction`
  - `sa:apps/katie-the-potter/src/lib/payout-actions.ts#disconnectPayoutsAction`
  - `sa:apps/sunjay/src/lib/payout-actions.ts#disconnectPayoutsAction`
- calls: @elkdonis/checkout/stripe#disconnectStripeAccount
  - `sa:apps/art-auction/src/app/studio/actions.ts#disconnectStripeAction`
- calls: disconnectPayoutsFor
  - `sa:apps/arts-collective/src/lib/cms/payout-actions.ts#disconnectPayoutsAction`

### payout-record (apps.art-auction.admin)

Record a payout. Canonical: `@elkdonis/commerce/server#recordPayout`.

- calls: @elkdonis/commerce/server#canEditSeries, @elkdonis/commerce/server#isNetworkAdmin, @elkdonis/commerce/server#recordPayout
  - `sa:apps/art-auction/src/app/series/[slug]/manage/orders/actions.ts#recordArtistPayoutAction`
- calls: @elkdonis/commerce/server#recordPayout, @elkdonis/commerce/server#sendPaidProceedsStatements
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminRecordPayout`

### payout-stripe-start (orgapps.money)

Connect Stripe to get paid. Canonical: `checkout startPayoutsFor, with origin resolved by publicOriginFrom in every host; one kit action.`.

- calls: (getViewer: any signed-in person), @elkdonis/checkout/stripe#startPayoutsFor
  - `sa:apps/innergathering/src/lib/cms/blog-actions.ts#startPayoutsAction`
- calls: @elkdonis/checkout/stripe#isCardPaymentAvailable, @elkdonis/checkout/stripe#startStripeOnboarding
  - `sa:apps/art-auction/src/app/studio/actions.ts#startStripeOnboardingAction`
- calls: @elkdonis/checkout/stripe#startPayoutsFor
  - `sa:apps/elktours/src/lib/payout-actions.ts#startPayoutsAction`
  - `sa:apps/elktours/src/lib/payout-actions.ts#startStripeOnboardingAction`
  - `sa:apps/ifac/src/lib/cms/payout-actions.ts#startPayoutsAction`
  - `sa:apps/katie-the-potter/src/lib/payout-actions.ts#startStripeOnboardingAction`
  - `sa:apps/sunjay/src/lib/payout-actions.ts#startPayoutsAction`
  - `sa:apps/sunjay/src/lib/payout-actions.ts#startStripeOnboardingAction`
- calls: startPayoutsFor
  - `sa:apps/arts-collective/src/lib/cms/payout-actions.ts#startPayoutsAction`

### pigeon-card-moderate (apps.pigeonshoot)

Hide, restore or remove a card.

- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#moderateCard`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#moderateCard`

### pigeon-card-rate (apps.pigeonshoot)

Rate a card.

- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#rateCard`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#rateCard`

### pigeon-card-report (apps.pigeonshoot)

Report a card.

- calls: (lib) checkRate/recordRate, (lib) requireWritableGuest
  - `api:apps/pigeonshoot/src/app/api/reports/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/app/api/reports/route.ts#POST`

### pigeon-card-submit (apps.pigeonshoot)

Post a pigeon card.

- calls: (lib) checkRate/recordRate, (lib) evaluateAuto, (lib) requireWritableGuest
  - `api:apps/pigeonshoot/src/app/api/cards/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/app/api/cards/route.ts#POST`

### pigeon-criterion-retire (apps.pigeonshoot)

Retire a rubric criterion.

- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#deactivateCriterion`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#deactivateCriterion`

### pigeon-criterion-save (apps.pigeonshoot)

Save a rubric criterion.

- calls: @elkdonis/db#db, @elkdonis/utils#slugify
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#upsertCriterion`
- calls: @elkdonis/utils#slugify
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#upsertCriterion`

### pigeon-guest-block (apps.pigeonshoot)

Block or unblock a contributor.

- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#setGuestBlocked`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#setGuestBlocked`

### pigeon-photo-upload (apps.pigeonshoot)

Upload a card photo. Canonical: `one shared upload service with this re-encode step`.

- calls: (lib) checkRate/recordRate, (lib) nextcloud upload, @elkdonis/utils#validateUploadBuffer
  - `api:apps/pigeonshoot/src/app/api/upload/route.ts#POST`
- calls: @elkdonis/db#db, @elkdonis/utils#validateUploadBuffer
  - `sql:apps/pigeonshoot/src/app/api/upload/route.ts#POST`

### pigeon-rate-event (apps.pigeonshoot)

Record and prune rate-limit events.

- calls: (lib) recordRate
  - `sql:apps/pigeonshoot/src/lib/rate-limit.ts#record`
- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/lib/rate-limit.ts#maybePrune`

### pigeon-report-resolve (apps.pigeonshoot)

Resolve a report.

- calls: (none resolved)
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#resolveReport`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#resolveReport`

### pigeon-site-copy-save (apps.pigeonshoot)

Save a block of site copy. Canonical: `one services saveOrgSiteSection`.

- calls: @elkdonis/db#db
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#saveSection`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#saveSection`

### pigeon-species-status (apps.pigeonshoot)

Publish, merge or reject a species.

- calls: (none resolved)
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#updateSpeciesStatus`
- calls: @elkdonis/db#db (raw SQL)
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#updateSpeciesStatus`

### pigeon-tier-save (apps.pigeonshoot)

Save a tier.

- calls: @elkdonis/db#db, @elkdonis/utils#slugify
  - `sql:apps/pigeonshoot/src/lib/manage/actions.ts#upsertTier`
- calls: @elkdonis/utils#slugify
  - `sa:apps/pigeonshoot/src/lib/manage/actions.ts#upsertTier`

### pkg-astro-corpus-foundation-add (pkg.astro-corpus)

Add or withdraw an item of the owner’s own in foundations.

- calls: (raw DELETE astro_correspondences)
  - `sql:packages/astro-corpus/src/foundations.ts#dropAddedCell`
- calls: (raw DELETE astro_foundation_items)
  - `sql:packages/astro-corpus/src/foundations.ts#dropAddedItem`
- calls: (raw INSERT astro_correspondences, astro_reviews)
  - `sql:packages/astro-corpus/src/foundations.ts#addCorrespondenceCell`
- calls: (raw INSERT astro_foundation_items, astro_reviews)
  - `sql:packages/astro-corpus/src/foundations.ts#addFoundationItem`

### pkg-astro-corpus-interpretation-write (pkg.astro-corpus)

Start or re-run an interpretation.

- calls: (raw INSERT astro_interpretations)
  - `sql:packages/astro-corpus/src/reasoning.ts#createInterpretation`
  - `sql:packages/astro-corpus/src/reasoning.ts#createQuestionInterpretation`
- calls: (raw UPDATE astro_interpretations)
  - `sql:packages/astro-corpus/src/reasoning.ts#requeueInterpretation`

### pkg-astro-corpus-review-record (pkg.astro-corpus)

Record a review-deck answer. Canonical: `@elkdonis/astro-corpus/server#recordReview`.

- calls: (raw INSERT astro_reviews, astro_text_factors, astro_candidates)
  - `sql:packages/astro-corpus/src/studio.ts#recordReview`
- calls: (raw INSERT astro_texts)
  - `sql:packages/astro-corpus/src/studio.ts#saveText`

### pkg-astro-corpus-seed-and-import (pkg.astro-corpus)

Seed the factor registry and import a source.

- calls: (raw INSERT astro_factors ON CONFLICT)
  - `sql:packages/astro-corpus/src/server.ts#seedFactors`
- calls: (raw INSERT astro_questions, astro_texts, astro_candidates, astro_text_factors)
  - `sql:packages/astro-corpus/src/server.ts#importItems`
- calls: (raw INSERT astro_sources ON CONFLICT)
  - `sql:packages/astro-corpus/src/sources.ts#upsertSource`

### pkg-astro-corpus-vocab-write (pkg.astro-corpus)

Sort, add or withdraw a vocabulary term.

- calls: (raw DELETE astro_vocab_cards)
  - `sql:packages/astro-corpus/src/vocab.ts#dropAddedCard`
- calls: (raw INSERT astro_reviews)
  - `sql:packages/astro-corpus/src/vocab.ts#recordVocabReview`
- calls: (raw INSERT astro_vocab_cards, astro_reviews)
  - `sql:packages/astro-corpus/src/vocab.ts#addVocabTerm`

### pkg-commerce-artwork-hide (pkg.commerce)

Hide or show an artwork as a marketplace keeper. Canonical: `packages/commerce server/index.ts#adminHideArtwork`.

- calls: commerce#adminHideArtwork
  - `sql:packages/commerce/src/server/index.ts#adminHideArtwork`
- calls: commerce#adminShowArtwork
  - `sql:packages/commerce/src/server/index.ts#adminShowArtwork`

### pkg-commerce-artwork-present (pkg.commerce)

Show another store's piece in a store's front. Canonical: `packages/commerce server/presentation.ts#presentArtwork`.

- calls: commerce#presentArtwork
  - `sql:packages/commerce/src/server/presentation.ts#presentArtwork`
- calls: commerce#unpresentArtwork
  - `sql:packages/commerce/src/server/presentation.ts#unpresentArtwork`

### pkg-commerce-artwork-status (pkg.commerce)

Publish, archive or change availability of an artwork. Canonical: `packages/commerce server/index.ts#setArtworkAvailability`.

- calls: commerce#archiveArtwork
  - `sql:packages/commerce/src/server/index.ts#archiveArtwork`
- calls: commerce#publishArtwork
  - `sql:packages/commerce/src/server/index.ts#publishArtwork`
- calls: commerce#setArtworkAvailability
  - `sql:packages/commerce/src/server/index.ts#setArtworkAvailability`

### pkg-commerce-artwork-write (pkg.commerce)

Create or edit an artwork (fields, price, variant, media, provenance). Canonical: `packages/commerce server/index.ts#createArtwork`.

- calls: commerce#canActForStore, commerce#createArtwork, commerce#requireActiveStore, utils#sanitizeRichText
  - `sql:packages/commerce/src/server/index.ts#createArtwork`
- calls: commerce#requireArtworkAccess, commerce#updateArtwork
  - `sql:packages/commerce/src/server/index.ts#updateArtwork`
- calls: commerce#writeArtworkMedia
  - `sql:packages/commerce/src/server/index.ts#writeArtworkMedia`
- calls: commerce#writeProvenance
  - `sql:packages/commerce/src/server/index.ts#writeProvenance`

### pkg-commerce-bid-write (pkg.commerce)

Record a bid and the proxy bids around it. Canonical: `packages/commerce server/bidding.ts#placeBid`.

- calls: commerce#placeBid
  - `sql:packages/commerce/src/server/bidding.ts#placeBid`
- calls: commerce#placeBid (inner closure insertBid)
  - `sql:packages/commerce/src/server/bidding.ts#insertBid`

### pkg-commerce-payee-list (pkg.commerce)

Edit an organisation's list of beneficiaries. Canonical: `packages/commerce server/payees.ts#addOrgBeneficiary`.

- calls: commerce#addCharityPayee, commerce#canManagePayees
  - `sql:packages/commerce/src/server/payees.ts#addCharityPayee`
- calls: commerce#addOrgBeneficiary, commerce#canManagePayees
  - `sql:packages/commerce/src/server/payees.ts#addOrgBeneficiary`
- calls: commerce#canManagePayees, commerce#removeOrgBeneficiary
  - `sql:packages/commerce/src/server/payees.ts#removeOrgBeneficiary`

### pkg-commerce-series-lot-add (pkg.commerce)

The desk adds a lot to a series (new piece, or an artist's listing). Canonical: `packages/commerce server/series.ts#addSeriesLot`.

- calls: commerce#addListingToSeries, commerce#addLotToSeries, commerce#createLot (onBehalfOfSeriesId)
  - `sql:packages/commerce/src/server/series-social.ts#addListingToSeries`
- calls: commerce#addLotToSeries, commerce#addSeriesLot, commerce#createArtwork, commerce#createLot
  - `sql:packages/commerce/src/server/series.ts#addSeriesLot`
- calls: commerce#attachLot
  - `sql:packages/commerce/src/server/series.ts#attachLot`

### pkg-commerce-series-lot-edit (pkg.commerce)

The desk takes a lot out of a series or reorders them. Canonical: `packages/commerce server/series.ts#renumberSeriesLots`.

- calls: commerce#canEditSeries, commerce#removeLotFromSeries
  - `sql:packages/commerce/src/server/series.ts#removeLotFromSeries`
- calls: commerce#canEditSeries, commerce#renumberSeriesLots
  - `sql:packages/commerce/src/server/series.ts#renumberSeriesLots`

### pkg-commerce-series-orgs (pkg.commerce)

Invite, answer or remove a partner organisation of a series. Canonical: `packages/commerce server/series-social.ts#addSeriesOrg`.

- calls: commerce#addSeriesOrg, commerce#canEditSeries, commerce#runsOrg
  - `sql:packages/commerce/src/server/series-social.ts#addSeriesOrg`
- calls: commerce#canEditSeries, commerce#removeSeriesOrg
  - `sql:packages/commerce/src/server/series-social.ts#removeSeriesOrg`
- calls: commerce#decideSeriesOrg, commerce#runsOrg
  - `sql:packages/commerce/src/server/series-social.ts#decideSeriesOrg`
- calls: commerce#setSeriesOrgConversation
  - `sql:packages/commerce/src/server/series-social.ts#setSeriesOrgConversation`

### pkg-commerce-series-publication (pkg.commerce)

Attach or detach a participant's own piece of writing. Canonical: `packages/commerce server/series.ts#attachPublication`.

- calls: commerce#attachPublication, commerce#canParticipateInSeries
  - `sql:packages/commerce/src/server/series.ts#attachPublication`
- calls: commerce#detachPublication
  - `sql:packages/commerce/src/server/series.ts#detachPublication`

### pkg-commerce-series-team (pkg.commerce)

Add, re-role or remove a series team member. Canonical: `packages/commerce server/series.ts#setSeriesMemberById`.

- calls: commerce#canEditSeries, commerce#removeSeriesMember
  - `sql:packages/commerce/src/server/series.ts#removeSeriesMember`
- calls: commerce#canEditSeries, commerce#setSeriesMember
  - `sql:packages/commerce/src/server/series.ts#setSeriesMember`
- calls: commerce#canEditSeries, commerce#setSeriesMemberById
  - `sql:packages/commerce/src/server/series.ts#setSeriesMemberById`

### pkg-commerce-series-thread (pkg.commerce)

Keep a series' forum thread and follow state. Canonical: `packages/commerce server/series-social.ts#ensureSeriesThread`.

- calls: commerce#ensureSeriesThread, services#createThread
  - `sql:packages/commerce/src/server/series-social.ts#ensureSeriesThread`
- calls: commerce#setSeriesFollow
  - `sql:packages/commerce/src/server/series-social.ts#setSeriesFollow`
- calls: commerce#syncSeriesThread
  - `sql:packages/commerce/src/server/series-social.ts#syncSeriesThread`

### pkg-commerce-series-week (pkg.commerce)

Plan a series' weeks: focus, items, featured pieces. Canonical: `packages/commerce server/series.ts#saveWeek`.

- calls: commerce#addWeekItem, commerce#canEditSeries
  - `sql:packages/commerce/src/server/series.ts#addWeekItem`
- calls: commerce#approveWeekItem, commerce#canEditSeries
  - `sql:packages/commerce/src/server/series.ts#approveWeekItem`
- calls: commerce#canEditSeries, commerce#removeWeekItem
  - `sql:packages/commerce/src/server/series.ts#removeWeekItem`
- calls: commerce#canEditSeries, commerce#saveWeek
  - `sql:packages/commerce/src/server/series.ts#saveWeek`
- calls: commerce#canEditSeries, commerce#setWeekFeatured
  - `sql:packages/commerce/src/server/series.ts#setWeekFeatured`
- calls: commerce#canEditSeries, commerce#setWeekFocus
  - `sql:packages/commerce/src/server/series.ts#setWeekFocus`
- calls: commerce#featureInWeek
  - `sql:packages/commerce/src/server/series.ts#featureInWeek`

### pkg-commerce-series-write (pkg.commerce)

Create a series, save its details, set its status. Canonical: `packages/commerce server/series.ts#updateSeries`.

- calls: commerce#canCreateSeries, commerce#createSeries
  - `sql:packages/commerce/src/server/series.ts#createSeries`
- calls: commerce#canEditSeries, commerce#setSeriesStatus
  - `sql:packages/commerce/src/server/series.ts#setSeriesStatus`
- calls: commerce#canEditSeries, commerce#updateSeries, utils#sanitizeRichText
  - `sql:packages/commerce/src/server/series.ts#updateSeries`

### pkg-commerce-store-review (pkg.commerce)

Approve, pause or reject a store. Canonical: `packages/commerce server/index.ts#approveStore`.

- calls: commerce#approveStore
  - `sql:packages/commerce/src/server/index.ts#approveStore`
- calls: commerce#pauseStore
  - `sql:packages/commerce/src/server/index.ts#pauseStore`
- calls: commerce#rejectStore
  - `sql:packages/commerce/src/server/index.ts#rejectStore`

### pkg-commerce-store-team (pkg.commerce)

Seat or remove someone on a store's roll. Canonical: `packages/commerce server/store-team.ts#addStoreMemberByEmail`.

- calls: commerce#addStoreMember
  - `sql:packages/commerce/src/server/index.ts#addStoreMember`
- calls: commerce#addStoreMemberByEmail, commerce#canManageStoreTeam
  - `sql:packages/commerce/src/server/store-team.ts#addStoreMemberByEmail`
- calls: commerce#removeStoreMember
  - `sql:packages/commerce/src/server/index.ts#removeStoreMember`

### pkg-email-contacts (pkg.email)

Add, edit, stop or remove an address in an org's book. Canonical: `packages/email address-book.ts (one org email route in services)`.

- calls: email#addAddresses
  - `sql:packages/email/src/address-book.ts#addAddresses`
- calls: email#removeContact
  - `sql:packages/email/src/address-book.ts#removeContact`
- calls: email#suppressAddress
  - `sql:packages/email/src/address-book.ts#suppressAddress`
- calls: email#updateContact
  - `sql:packages/email/src/address-book.ts#updateContact`

### pkg-email-inbox-state (pkg.email)

Mark an inbox message, or move it in or out of spam. Canonical: `packages/email inbox.ts#setInboxState`.

- calls: email#reclassifyInbox
  - `sql:packages/email/src/inbox.ts#reclassifyInbox`
- calls: email#setInboxState
  - `sql:packages/email/src/inbox.ts#setInboxState`

### pkg-email-template (pkg.email)

Save or reset an org's version of a letter. Canonical: `packages/email template-store.ts#saveOrgTemplate`.

- calls: email#clearOrgTemplate
  - `sql:packages/email/src/template-store.ts#clearOrgTemplate`
- calls: email#saveOrgTemplate
  - `sql:packages/email/src/template-store.ts#saveOrgTemplate`

### pkg-lms-guides (pkg.lms)

Manage the hub's listed guides. Canonical: `packages/lms hub.ts#saveGuide`.

- calls: lms#addGuideByEmail, lms#canCurateHub
  - `sql:packages/lms/src/hub.ts#addGuideByEmail`
- calls: lms#canCurateHub, lms#removeGuide
  - `sql:packages/lms/src/hub.ts#removeGuide`
- calls: lms#canCurateHub, lms#saveGuide
  - `sql:packages/lms/src/hub.ts#saveGuide`

### pkg-lms-pool (pkg.lms)

Add to or tidy a course's resource pool. Canonical: `packages/lms pool.ts#addToPool`.

- calls: lms#addToPool, lms#unfurl, utils#assertPublicUrl
  - `sql:packages/lms/src/pool.ts#addToPool`
- calls: lms#updatePoolItem
  - `sql:packages/lms/src/pool.ts#updatePoolItem`

### pkg-lms-run-guide-add (pkg.lms)

Name a guide on a run. Canonical: `packages/lms authoring.ts#addRunGuideByEmail`.

- calls: lms#addRunGuide
  - `sql:packages/lms/src/delivery.ts#addRunGuide`
- calls: lms#addRunGuideByEmail
  - `sql:packages/lms/src/authoring.ts#addRunGuideByEmail`

### pkg-lms-traditions (pkg.lms)

Add, rename or delete a tradition. Canonical: `packages/lms hub.ts#saveTradition`.

- calls: lms#canCurateHub, lms#deleteTradition
  - `sql:packages/lms/src/hub.ts#deleteTradition`
- calls: lms#canCurateHub, lms#saveTradition
  - `sql:packages/lms/src/hub.ts#saveTradition`

### pkg-messaging-conversation (pkg.messaging)

Find or start a conversation. Canonical: `packages/messaging server.ts#getOrCreateDirectConversation`.

- calls: messaging#getOrCreateDirectConversation
  - `sql:packages/messaging/src/server.ts#getOrCreateDirectConversation`
- calls: messaging#startConversation
  - `sql:packages/messaging/src/server.ts#startConversation`

### pkg-newsletter-letter (pkg.newsletter)

Save or delete a saved letter. Canonical: `packages/newsletter server.ts#saveNewsletter`.

- calls: newsletter#deleteNewsletter
  - `sql:packages/newsletter/src/server.ts#deleteNewsletter`
- calls: newsletter#saveNewsletter
  - `sql:packages/newsletter/src/server.ts#saveNewsletter`

### pkg-series-site-reminders (pkg.series-site)

Send the series' due attendee and subscriber reminders. Canonical: `packages/series-site lib/reminders.ts#createSeriesReminders (one shared tick)`.

- calls: (raw INSERT thread_reminder_sends, UPDATE recipients), email#sendReminderEmail
  - `sql:packages/series-site/src/lib/reminders.ts#runAttendeeReminders`
- calls: (raw INSERT thread_reminder_sends, UPDATE recipients), email#sendReminderEmail, services#getMeetingSeries, services#listSeriesSubscribers
  - `sql:packages/series-site/src/lib/reminders.ts#runSubscriberReminders`

### post-to-a-site (arts-collective.hub)

Post to a site from anywhere. Canonical: `services createThread (createPostAnywhere should call it)`.

- calls: @elkdonis/services#createPostAnywhere, @elkdonis/services#listOrgHomes
  - `api:apps/innergathering/src/app/api/center/post/route.ts#POST`
- calls: createPostAnywhere
  - `api:apps/arts-collective/src/app/api/center/post/route.ts#POST`

### profile-blog-set (orgapps.content)

Turn my blog on or off. Canonical: `a services setProfileSection(userId, key, on) with an allow-list of keys (see profile-section-toggle in orgapps.people), one kit action; drop blogScope.`.

- calls: (getApiMember: member or above), (raw UPDATE users.profile_sections jsonb merge)
  - `sa:apps/innergathering/src/lib/cms/blog-actions.ts#setBlogStateAction`
- calls: (getHubViewer: any member), (raw UPDATE users.profile_sections jsonb merge)
  - `sa:apps/ifac/src/lib/cms/blog-actions.ts#setBlogStateAction`
- calls: @elkdonis/db#db
  - `sql:apps/ifac/src/lib/cms/blog-actions.ts#setBlogStateAction`
  - `sql:apps/innergathering/src/lib/cms/blog-actions.ts#setBlogStateAction`

### profile-field-save (orgapps.editing)

Edit my bio or photo on my page. Canonical: `services updateProfile with url validation inside, behind the edit-my-profile kit action; ownership by canEditProfile.`.

- calls: (canEditProfile), @elkdonis/services#updateProfile
  - `sa:apps/artdirect/src/lib/profile-editor-actions.ts#saveAvatarAction`
  - `sa:apps/ifac/src/lib/profile-editor-actions.ts#saveAvatarAction`
- calls: (getCurrentUser; canEditProfile), @elkdonis/services#updateProfile
  - `sa:apps/artdirect/src/lib/profile-editor-actions.ts#saveProfileFieldAction`
- calls: (getServerSession; canEditProfile = the person or a global admin), @elkdonis/services#updateProfile
  - `sa:apps/ifac/src/lib/profile-editor-actions.ts#saveProfileFieldAction`

### profile-portfolio-save (orgapps.editing)

Arrange the pictures on my page. Canonical: `setOrgPortfolio (per org) behind one kit action; the global portfolio is the fallback when an org has none.`.

- calls: (canEditProfile), @elkdonis/services#setOrgPortfolio
  - `sa:apps/ifac/src/lib/profile-editor-actions.ts#saveGalleryAction`
- calls: (canEditProfile), @elkdonis/services#updateProfile
  - `sa:apps/artdirect/src/lib/profile-editor-actions.ts#saveGalleryAction`

### profile-section-toggle (orgapps.people)

Switch a section of my page on or off. Canonical: `a services setProfileSection(userId, key, on) that owns the SQL and the allowed-key list; one kit action.`.

- calls: (KNOWN_PROFILE_SECTIONS allow-list), (authorize: canEditProfile = the profile owner or a global admin), (raw UPDATE users SET profile_sections = profile_sections || {key: bool})
  - `sa:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileSectionAction`
- calls: (getApiMember), (raw UPDATE users.profile_sections jsonb merge; allow-list blog, store, elkdonisFeed)
  - `sa:apps/innergathering/src/lib/cms/blog-actions.ts#setProfileSectionAction`
- calls: (getApiMember), (raw UPDATE users.profile_sections store)
  - `sa:apps/innergathering/src/lib/cms/blog-actions.ts#setStoreSectionAction`
- calls: (getCurrentUser; canEditProfile on the profileUserId), (raw UPDATE users.profile_sections; allow-list store + dossier keys)
  - `sa:apps/artdirect/src/lib/profile-editor-actions.ts#setProfileSectionAction`
- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), (raw UPDATE users SET profile_sections = ... WHERE id = viewer)
  - `api:apps/ifac/src/app/api/hub/profile-sections/route.ts#PATCH`
- calls: @elkdonis/db#db
  - `sa:apps/amrit-canada/src/lib/account-actions.ts#setOwnProfileSectionAction`
  - `sa:apps/arts-collective/src/lib/cms/payout-actions.ts#setProfileSectionAction`
  - `sa:apps/elktours/src/lib/account-actions.ts#setOwnProfileSectionAction`
  - `sa:apps/ifac/src/lib/cms/payout-actions.ts#setProfileSectionAction`
  - `sa:apps/sunjay/src/lib/account-actions.ts#setOwnProfileSectionAction`
  - `sql:apps/amrit-canada/src/lib/account-actions.ts#setOwnProfileSectionAction`
  - `sql:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileSectionAction`
  - `sql:apps/artdirect/src/lib/profile-editor-actions.ts#setProfileSectionAction`
  - `sql:apps/arts-collective/src/lib/cms/payout-actions.ts#setProfileSectionAction`
  - `sql:apps/elktours/src/lib/account-actions.ts#setOwnProfileSectionAction`
  - `sql:apps/ifac/src/app/api/hub/profile-sections/route.ts#PATCH`
  - `sql:apps/ifac/src/lib/cms/payout-actions.ts#setProfileSectionAction`
  - `sql:apps/innergathering/src/lib/cms/blog-actions.ts#setProfileSectionAction`
  - `sql:apps/innergathering/src/lib/cms/blog-actions.ts#setStoreSectionAction`
  - `sql:apps/sunjay/src/lib/account-actions.ts#setOwnProfileSectionAction`

### publish-draft-post (arts-collective.hub)

Publish a draft. Canonical: `services updatePost`.

- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug
  - `sql:apps/arts-collective/src/lib/cms/draft-actions.ts#publishDraftAction`
- calls: ensureUniqueThreadSlug
  - `sa:apps/arts-collective/src/lib/cms/draft-actions.ts#publishDraftAction`

### publish-silex-site (arts-collective.sites)

Publish a Silex site. Canonical: `the Puck/direct-edit home, if Silex is retired`.

- calls: @elkdonis/db#db, @elkdonis/nextcloud#createFolder, @elkdonis/nextcloud#exists, @elkdonis/nextcloud#getAdminClient, @elkdonis/utils#sanitizeSilexHtml
  - `sql:apps/arts-collective/src/app/api/silex/publish/route.ts#POST`
- calls: nextcloud#createFolder, utils#sanitizeSilexHtml
  - `api:apps/arts-collective/src/app/api/silex/publish/route.ts#POST`

### publish-social-post (arts-collective.studio)

Publish a social post to an account. Canonical: `one publish-to-outlet service`.

- calls: @elkdonis/db#db, @elkdonis/services#createPostAnywhere, @elkdonis/services#listPostTargets
  - `sql:apps/arts-collective/src/lib/post-actions.ts#mirrorToThread`
- calls: createPostAnywhere, finishPublishJob, postImageToInstagram, postToPage, postToThreads, startPublishJob
  - `sa:apps/arts-collective/src/lib/post-actions.ts#publishSocialPost`
- calls: publishSocialPost, saveNewPostAction
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#publishNewPostAction`

### questionnaire-create (orgapps.questionnaires)

Create a questionnaire or poll. Canonical: `services createOrgQuestionnaire behind a single shared org-site kit action that does viewer + canManageQuestionnaires; ifac converges once the ownerEmails and global-admin branches of canManageIfac are dropped (owners are seeded: 2 owners, 4 guides).`.

- calls: @elkdonis/auth-server#getServerSession, @elkdonis/services#createOrgQuestionnaire
  - `sa:apps/ifac/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction`
- calls: @elkdonis/services#canManageQuestionnaires, @elkdonis/services#createOrgQuestionnaire
  - `sa:apps/amrit-canada/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction`
  - `sa:apps/elktours/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction`
  - `sa:apps/innergathering/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction`
  - `sa:apps/sunjay/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction`
- calls: canManageQuestionnaires, createOrgQuestionnaire
  - `sa:apps/arts-collective/src/lib/cms/questionnaire-actions.ts#createQuestionnaireAction`

### receive-email-events (arts-collective.network)

Email delivery events and inbound mail.

- calls: email#classifyInbound, email#recordInbound
  - `api:apps/arts-collective/src/app/api/email/inbound/route.ts#POST`
- calls: email#ingestEvents
  - `api:apps/arts-collective/src/app/api/email/events/route.ts#POST`

### receive-meta-events (arts-collective.network)

Meta, Instagram and Threads webhooks and deletion callbacks. Canonical: `one /api/meta/* pair, with Instagram and Threads callback URLs pointed at it in the Meta app config`.

- calls: (none resolved)
  - `api:apps/arts-collective/src/app/api/instagram/webhook/route.ts#POST`
  - `api:apps/arts-collective/src/app/api/meta/webhook/route.ts#POST`
  - `api:apps/arts-collective/src/app/api/threads/webhook/route.ts#POST`
- calls: @elkdonis/meta/data-deletion#createDataDeletionCallback, @elkdonis/services#fulfilMetaDeletion
  - `api:apps/innergathering/src/app/api/instagram/data-deletion/route.ts#POST`
  - `api:apps/innergathering/src/app/api/meta/data-deletion/route.ts#POST`
  - `api:apps/innergathering/src/app/api/threads/data-deletion/route.ts#POST`
- calls: fulfilMetaDeletion
  - `api:apps/arts-collective/src/app/api/instagram/data-deletion/route.ts#POST`
  - `api:apps/arts-collective/src/app/api/meta/data-deletion/route.ts#POST`
  - `api:apps/arts-collective/src/app/api/threads/data-deletion/route.ts#POST`

### reclassify-inbox-message (arts-collective.hub)

Correct how an inbox message was classified.

- calls: (getApiEditor: owner or guide), @elkdonis/email#reclassifyInbox
  - `api:apps/ifac/src/app/api/hub/email/messages/[id]/route.ts#PATCH`
- calls: @elkdonis/email#reclassifyInbox
  - `api:apps/innergathering/src/app/api/hub/email/messages/[id]/route.ts#PATCH`
- calls: reclassifyInbox
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/messages/[id]/route.ts#PATCH`

### remove-email-contact (arts-collective.hub)

Remove a contact from the mailing list.

- calls: (getApiEditor: owner or guide), @elkdonis/email#removeContact
  - `api:apps/ifac/src/app/api/hub/email/addresses/route.ts#DELETE`
- calls: @elkdonis/email#removeContact
  - `api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#DELETE`
- calls: removeContact
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#DELETE`

### remove-org-landing-page (arts-collective.hub)

Remove the designed landing page.

- calls: (none resolved)
  - `sa:apps/arts-collective/src/lib/puck/actions.ts#removeOrgHomeAction`
- calls: @elkdonis/db#db
  - `sql:apps/arts-collective/src/lib/puck/store.ts#deleteOrgHome`

### remove-person-from-org (arts-collective.hub)

Remove someone from the organisation. Canonical: `services removeOrgPerson`.

- calls: performHubAction
  - `sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction`
- calls: removeOrgMember
  - `api:apps/arts-collective/src/app/api/org/[slug]/members/[userId]/route.ts#DELETE`

### request-data-deletion (arts-collective.network)

Ask for your data to be deleted. Canonical: `createDeletionRequestHandler (shared); mount only`.

- calls: @elkdonis/email#sendEmail, @elkdonis/services#createDeletionRequestHandler
  - `api:apps/innergathering/src/app/api/data/delete/route.ts#POST`
- calls: createDeletionRequestHandler, email#sendEmail
  - `api:apps/arts-collective/src/app/api/data/delete/route.ts#POST`

### rsvp-to-event (arts-collective.sites)

RSVP to an event or join a workshop. Canonical: `one shared handler in @elkdonis/services (rsvpHandlers, like connectionsHandlers) that each app mounts`.

- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), (raw SELECT thread in org), @elkdonis/services#checkRsvpEligibility, @elkdonis/services#deleteRsvp, @elkdonis/services#setRsvpStatus
  - `api:apps/ifac/src/app/api/hub/rsvp/route.ts#POST`
- calls: (raw INSERT user_organizations viewer), @elkdonis/services#checkRsvpEligibility, @elkdonis/services#setRsvpStatus
  - `api:apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: (raw UPDATE threads min_attendees_notified), @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification, @elkdonis/services#checkRsvpEligibility, @elkdonis/services#setRsvpStatus
  - `api:apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts#POST`
  - `api:apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: @elkdonis/db#db, @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification, @elkdonis/services#checkRsvpEligibility, @elkdonis/services#getRsvpStatus, @elkdonis/services#setRsvpStatus
  - `sql:apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts#POST`
  - `sql:apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: @elkdonis/db#db, @elkdonis/services#checkRsvpEligibility, @elkdonis/services#setRsvpStatus
  - `sql:apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification, @elkdonis/services#checkRsvpEligibility, @elkdonis/services#setRsvpStatus, raw SQL UPDATE threads (min_attendees_notified)
  - `api:apps/elktours/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: checkRsvpEligibility, countConfirmedRsvps, nextcloud#grantMaterialsAccess, setRsvpStatus
  - `api:apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts#POST`
- calls: raw SQL
  - `sql:apps/elktours/src/app/api/threads/[id]/rsvp/route.ts#POST`

### run-registry-action (arts-collective.network)

Run a registry step as the signed-in person. Canonical: `one door in packages/actions/server, mounted per host`.

- calls: actionOrgId, performAction
  - `sa:apps/arts-collective/src/lib/actions/run.ts#runAction`
- calls: actions#actionHttp
  - `api:apps/arts-collective/src/app/api/actions/[id]/route.ts#POST`
- calls: isDockAction, runAction
  - `sa:apps/arts-collective/src/lib/actions/dock-actions.ts#runDockAction`

### save-artist-wizard (arts-collective.network)

Save your artist profile questionnaire as you go. Canonical: `a services artistProfile module (save, submit, reset) used by all five`.

- calls: @elkdonis/db#db, @elkdonis/services#gainSpace
  - `sql:apps/arts-collective/src/app/api/wizard/save/route.ts#POST`
- calls: gainSpace
  - `api:apps/arts-collective/src/app/api/wizard/save/route.ts#POST`

### save-booth-recording (arts-collective.studio)

Copy a booth recording to my library. Canonical: `obsCopyRecording`.

- calls: obsCopyRecording
  - `sa:apps/arts-collective/src/lib/recording-actions.ts#boothCopyRecordingAction`
- calls: obsSaveRecording
  - `sa:apps/arts-collective/src/lib/broadcast-actions.ts#broadcastSaveRecording`

### save-business-wizard (arts-collective.network)

Save your business questionnaire as you go. Canonical: `services artistProfile module`.

- calls: @elkdonis/db#db, @elkdonis/services#gainSpace
  - `sql:apps/arts-collective/src/app/api/wizard/business/save/route.ts#POST`
- calls: gainSpace
  - `api:apps/arts-collective/src/app/api/wizard/business/save/route.ts#POST`

### save-classifieds-page (arts-collective.hub)

Save the classifieds page.

- calls: (none resolved)
  - `sa:apps/arts-collective/src/lib/classifieds/actions.ts#saveClassifiedsAction`
- calls: @elkdonis/db#withOrg
  - `sql:apps/arts-collective/src/lib/classifieds/store.ts#saveClassifieds`

### save-email-template (arts-collective.hub)

Save an email template.

- calls: (getApiEditor: owner or guide), (lib/series-letters-store saveSeriesLetter when the call is series-scoped), @elkdonis/email#saveOrgTemplate, @elkdonis/utils#sanitizeRichText (bodyHtml and copyHtml only)
  - `api:apps/ifac/src/app/api/hub/email/[key]/route.ts#PUT`
- calls: @elkdonis/email#saveOrgTemplate, @elkdonis/utils#sanitizeRichText
  - `api:apps/innergathering/src/app/api/hub/email/[key]/route.ts#PUT`
- calls: saveOrgTemplate
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/template/[key]/route.ts#PUT`

### save-feed-card-design (arts-collective.hub)

Save the feed card design.

- calls: (none resolved)
  - `sa:apps/arts-collective/src/lib/cards/actions.ts#saveCardsAction`
- calls: @elkdonis/db#withOrg
  - `sql:apps/arts-collective/src/lib/cards/store.ts#saveCards`

### save-org-email-identity (arts-collective.hub)

Save the organisation's sending name and reply address. Canonical: `saveOrgEmailIdentity`.

- calls: (getApiEditor: owner or guide), @elkdonis/email#inboundAddressFor, @elkdonis/email#inboundEnabled, @elkdonis/email#saveOrgEmailIdentity
  - `api:apps/ifac/src/app/api/hub/email/identity/route.ts#PATCH`
- calls: @elkdonis/email#inboundAddressFor, @elkdonis/email#saveOrgEmailIdentity
  - `api:apps/innergathering/src/app/api/hub/email/identity/route.ts#PATCH`
- calls: saveOrgEmailIdentity
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/identity/route.ts#PATCH`

### save-org-identity (arts-collective.hub)

Save the organisation's identity. Canonical: `one identity-save service wrapping canEditOrgIdentity + updateProfile + the organizations.name sync`.

- calls: @elkdonis/db#db, @elkdonis/services#canEditOrgIdentity, @elkdonis/services#updateProfile
  - `sql:apps/arts-collective/src/lib/org-identity-actions.ts#saveOrgIdentityAction`
- calls: canEditOrgIdentity, updateProfile
  - `sa:apps/arts-collective/src/lib/org-identity-actions.ts#saveOrgIdentityAction`

### save-silex-layout (arts-collective.sites)

Silex saves a layout.

- calls: @elkdonis/auth-server#getServerSession, @elkdonis/db#db, @elkdonis/nextcloud#ensureOrgFolder, @elkdonis/nextcloud#ensureOrgFolderPath, @elkdonis/nextcloud#getAdminClient
  - `sql:apps/arts-collective/src/app/api/silex/layout/route.ts#POST`
- calls: nextcloud#ensureOrgFolderPath
  - `api:apps/arts-collective/src/app/api/silex/layout/route.ts#POST`

### send-org-contact-message (arts-collective.hub)

Send a contact form message to an organisation.

- calls: (delegates to lib/contact handleContact), (no auth)
  - `api:apps/hidden-enneagram/src/app/api/org/[slug]/contact/route.ts#POST`
- calls: (honeypot field company), (no auth), (raw INSERT INTO contacts for danamccool), (redis rate limit, 6 per hour per IP, fails open)
  - `api:apps/danamccool/src/app/api/contact/route.ts#POST`
- calls: (none resolved)
  - `sql:apps/elkdonis-arts-collective/src/app/api/contact/route.ts#POST`
- calls: (raw INSERT INTO contacts; sendContactNotification to the owner)
  - `sql:apps/hidden-enneagram/src/lib/contact.ts#handleContact`
- calls: (raw INSERT contacts), @elkdonis/email#sendContactNotification
  - `api:apps/elkdonis-arts-collective/src/app/api/contact/route.ts#POST`
- calls: (raw SQL INSERT into contacts), @elkdonis/email#sendContactNotification
  - `api:apps/innergathering/src/app/api/contact/route.ts#POST`
- calls: (raw SQL in the same function)
  - `sql:apps/innergathering/src/app/api/contact/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/danamccool/src/app/api/contact/route.ts#POST`
- calls: handleOrgContact
  - `api:apps/arts-collective/src/app/api/org/[slug]/contact/route.ts#POST`

### series-audience-route (shared.routes)

Subscribe, RSVP, comment or mark coming on a series.

- calls: @elkdonis/series-site/routes#comingRoutes
  - `api:apps/ifac/src/app/api/series/coming/route.ts#POST`
  - `api:apps/sunjay/src/app/api/series/coming/route.ts#POST`
- calls: @elkdonis/series-site/routes#commentRoutes
  - `api:apps/ifac/src/app/api/series/comment/route.ts#POST`
  - `api:apps/sunjay/src/app/api/series/comment/route.ts#POST`
- calls: @elkdonis/series-site/routes#rsvpRoutes
  - `api:apps/ifac/src/app/api/series/rsvp/route.ts#POST`
  - `api:apps/sunjay/src/app/api/series/rsvp/route.ts#POST`
- calls: @elkdonis/series-site/routes#subscribeRoutes
  - `api:apps/ifac/src/app/api/series/subscribe/route.ts#POST`
  - `api:apps/sunjay/src/app/api/series/subscribe/route.ts#POST`

### series-editor-add (apps.art-auction.series)

Add an editor or contributor to a series.

- calls: @elkdonis/commerce/server#setSeriesMember
  - `sa:apps/art-auction/src/app/admin/series/actions.ts#setSeriesMemberAction`
- calls: @elkdonis/commerce/server#setSeriesMemberById
  - `sa:apps/art-auction/src/app/series/[slug]/manage/actions.ts#addMemberAction`

### series-hub-route (shared.routes)

Create or edit a series and its page from the hub.

- calls: @elkdonis/series-site/routes#hubNewSeriesRoutes
  - `api:apps/ifac/src/app/api/hub/series/new/route.ts#POST`
  - `api:apps/sunjay/src/app/api/hub/series/new/route.ts#POST`
- calls: @elkdonis/series-site/routes#hubSeriesPageRoutes
  - `api:apps/ifac/src/app/api/hub/series-page/route.ts#POST`
  - `api:apps/sunjay/src/app/api/hub/series-page/route.ts#POST`
- calls: @elkdonis/series-site/routes#hubSeriesRoutes
  - `api:apps/ifac/src/app/api/hub/series/route.ts#POST`
  - `api:apps/sunjay/src/app/api/hub/series/route.ts#POST`

### series-save (apps.art-auction.series)

Save a series' details. Canonical: `@elkdonis/commerce/server#updateSeries with syncSeriesThread inside it`.

- calls: @elkdonis/commerce/server#syncSeriesThread, @elkdonis/commerce/server#updateSeries
  - `sa:apps/art-auction/src/app/series/[slug]/manage/actions.ts#saveSeriesAction`
- calls: @elkdonis/commerce/server#updateSeries
  - `sa:apps/art-auction/src/app/admin/series/actions.ts#updateSeriesAction`

### series-status-set (apps.art-auction.series)

Publish or close a series.

- calls: @elkdonis/commerce/server#ensureSeriesThread, @elkdonis/commerce/server#setSeriesStatus
  - `sa:apps/art-auction/src/app/series/[slug]/manage/actions.ts#setStatusAction`
- calls: @elkdonis/commerce/server#setSeriesStatus
  - `sa:apps/art-auction/src/app/admin/series/actions.ts#setSeriesStatusAction`

### series-week-save (apps.art-auction.series)

Save a week of a series. Canonical: `@elkdonis/commerce/server#saveWeek`.

- calls: @elkdonis/commerce/server#saveWeek
  - `sa:apps/art-auction/src/app/series/[slug]/manage/actions.ts#saveWeekAction`
- calls: @elkdonis/commerce/server#setWeekFocus
  - `sa:apps/art-auction/src/app/admin/series/actions.ts#setWeekFocusAction`

### service-book-and-pay (orgapps.commerce.booking)

Book and pay for a service. Canonical: `One kit action over startBookingCheckout (booking module, offer-driven) for every site; startServiceCheckout is the older path and createServiceBooking/service_bookings is the table it feeds.`.

- calls: @elkdonis/checkout/booking#bookingAvailability, @elkdonis/checkout/booking#publicOriginFrom, @elkdonis/checkout/booking#startServiceCheckout
  - `sa:apps/hidden-enneagram/src/lib/booking-actions.ts#bookAndPay`
- calls: @elkdonis/checkout/booking#publicOriginFrom, @elkdonis/checkout/booking#startServiceCheckout
  - `sa:apps/artdirect/src/lib/booking-actions.ts#bookServiceAction`
  - `sa:apps/sunjay/src/lib/booking-actions.ts#bookServiceAction`
- calls: @elkdonis/checkout/booking#publicOriginFrom, @elkdonis/checkout/booking#startServiceCheckout, @elkdonis/services#getServiceOffering
  - `sa:apps/elastrocal/src/app/services/[slug]/actions.ts#bookServiceAction`

### set-up-relay-destinations (arts-collective.studio)

Manage relay destinations and feeds.

- calls: obsAddFeedScene
  - `sa:apps/arts-collective/src/lib/relay-actions.ts#relayFeedToScene`
- calls: relayAddFeed
  - `sa:apps/arts-collective/src/lib/relay-actions.ts#relayAddFeed`
- calls: relayRemoveFeed
  - `sa:apps/arts-collective/src/lib/relay-actions.ts#relayRemoveFeed`
- calls: removeStreamDestination
  - `sa:apps/arts-collective/src/lib/relay-actions.ts#relayRemoveDestination`
- calls: saveStreamDestination
  - `sa:apps/arts-collective/src/lib/relay-actions.ts#relaySaveDestination`
- calls: setStreamDestinationEnabled
  - `sa:apps/arts-collective/src/lib/relay-actions.ts#relaySetEnabled`

### set-where-i-show (arts-collective.hub)

Choose where I show. Canonical: `services setPresence`.

- calls: @elkdonis/services#setPresence
  - `api:apps/innergathering/src/app/api/center/presence/route.ts#POST`
- calls: setPresence
  - `api:apps/arts-collective/src/app/api/center/presence/route.ts#POST`

### share-piece-to-social (arts-collective.studio)

Share a published piece to a social account. Canonical: `one publish-to-outlet service in @elkdonis/services (startPublishJob/finishPublishJob wrapper)`.

- calls: @elkdonis/db#db, @elkdonis/meta#postImageToInstagram, @elkdonis/meta#postLinkToPage, @elkdonis/meta#postToThreads, @elkdonis/meta/instagram-login#postImageWithInstagramLogin, @elkdonis/services#canEditProfile, @elkdonis/services#finishPublishJob, @elkdonis/services#getInstagramLoginTarget, @elkdonis/services#getMetaPageTarget, @elkdonis/services#getProfile, @elkdonis/services#getThreadsTarget, @elkdonis/services#getWritingPostById, @elkdonis/services#listConnections, @elkdonis/services#startPublishJob, @elkdonis/services#subscribePageFeed
  - `sql:apps/arts-collective/src/lib/share-actions.ts#sharePiece`
- calls: finishPublishJob, postImageToInstagram, postLinkToPage, postToThreads, startPublishJob
  - `sa:apps/arts-collective/src/lib/share-actions.ts#sharePiece`

### shipping-address-correct (orgapps.commerce.shipping)

Correct the shipping address.

- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#correctShipTo`
- calls: katie/lib/shipping/shipments#correctShipTo
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#correctAddressAction`

### shipping-choose-pay (orgapps.commerce.shipping)

Choose a shipping option and pay for it. Canonical: `katie shipments.chooseRate/startShippingPayment; the art-auction copy order-shipping-choose is simpler (no pay step: shipping is added to the unpaid order).`.

- calls: @elkdonis/checkout/stripe#expireShippingLabelSession, @elkdonis/checkout/stripe#startShippingLabelCheckout, @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#startLabelPayment`
- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#chooseRate`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#ensureLabel`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#markAwaitingPayment`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#markQuoteTestPaid`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#markTestPaid`
- calls: katie/lib/shipping/shipments#chooseRate, katie/lib/shipping/shipments#startShippingPayment
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#chooseShippingAction`
- calls: katie/lib/shipping/shipments#startShippingPayment
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#continueShippingPaymentAction`

### shipping-mark-shipped (orgapps.commerce.shipping)

Add tracking and mark shipped.

- calls: @elkdonis/commerce/server#markOrderFulfilled, katie/lib/shipping/shipments#recordKatieShipped
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#markShippedWithTrackingAction`
- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#recordKatieShipped`

### shipping-mode-set (orgapps.commerce.shipping)

Switch shipping Off, Test or On.

- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/settings.ts#remove`
  - `sql:apps/katie-the-potter/src/lib/shipping/settings.ts#write`
- calls: katie/lib/shipping/settings#liveBlockers, katie/lib/shipping/settings#setShippingMode
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#setShippingModeAction`

### shipping-packing-save (orgapps.commerce.shipping)

Save packing and insurance settings.

- calls: katie/lib/shipping/settings#saveInsurance
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#saveInsuranceAction`
- calls: katie/lib/shipping/settings#savePacking
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#savePackingAction`

### shipping-rates-refresh (orgapps.commerce.shipping)

Refresh shipping prices.

- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#ratesForOrder`
- calls: katie/lib/shipping/shipments#ratesForOrder
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#refreshShippingRatesAction`

### shipping-rechoose (orgapps.commerce.shipping)

Choose a different shipping option.

- calls: @elkdonis/checkout/stripe#expireShippingLabelSession, @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#reopenChoice`
- calls: katie/lib/shipping/shipments#reopenChoice
  - `sa:apps/katie-the-potter/src/lib/shipping/actions.ts#rechooseShippingAction`

### shipping-shipment-internal (orgapps.commerce.shipping)

Shipment bookkeeping and notices.

- calls: @elkdonis/checkout/stripe#refundShippingLabelPayment, @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#failLabel`
- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/notices.ts#logWouldSend`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#cancelShipmentRow`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#claimOnce`
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#refreshPendingLabel`

### shipping-tracking-webhook (orgapps.commerce.shipping)

Receive Easyship tracking events.

- calls: @elkdonis/db#db
  - `sql:apps/katie-the-potter/src/lib/shipping/shipments.ts#applyTracking`
- calls: katie/lib/shipping/webhook#handleEasyshipWebhook
  - `api:apps/katie-the-potter/src/app/api/shipping/webhook/route.ts#POST`

### shop-cart-remove-line (orgapps.commerce.shop)

Remove a piece from the cart. Canonical: `commerce removeCartLine with the ownership check moved inside.`.

- calls: @elkdonis/checkout/server#readCartToken, @elkdonis/commerce/server#removeCartLine
  - `sa:apps/katie-the-potter/src/lib/shop-actions.ts#removeFromCart`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/index.ts#removeCartLine`

### shop-checkout (orgapps.commerce.shop)

Buy pieces (checkout). Canonical: `commerce createOrderFromCart / createOrder as the single order maker; one kit checkout action.`.

- calls: (none resolved)
  - `sql:packages/commerce/src/server/orders.ts#createOrder`
  - `sql:packages/commerce/src/server/orders.ts#recordStripeCheckout`
- calls: @elkdonis/checkout/stripe#isCardPaymentAvailable, @elkdonis/checkout/stripe#startStripeCheckout, @elkdonis/commerce/server#createOrderFromCart
  - `sa:apps/katie-the-potter/src/lib/shop-actions.ts#placeOrder`
- calls: @elkdonis/checkout/stripe#startStripeCheckout, @elkdonis/commerce/server#createOrder, @elkdonis/commerce/server#loadVariantItem
  - `sa:apps/katie-the-potter/src/lib/shop-actions.ts#buyPieceNow`
- calls: @elkdonis/checkout/stripe#startStripeCheckout, @elkdonis/commerce/server#createOrderFromCart
  - `sa:apps/katie-the-potter/src/lib/shop-actions.ts#expressCheckoutCart`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/orders.ts#recordCheckoutCustomer`

### shop-order-cancel (orgapps.commerce.shop)

Cancel an unpaid order.

- calls: (none resolved)
  - `sql:packages/commerce/src/server/orders.ts#cancelOrder`
- calls: @elkdonis/commerce/server#cancelOrder
  - `sa:apps/katie-the-potter/src/lib/manage-actions.ts#cancelOrderAction`

### shop-order-pay-etransfer (orgapps.commerce.shop)

Switch an order to Interac eTransfer.

- calls: @elkdonis/commerce/server#switchOrderToEtransfer
  - `sa:apps/katie-the-potter/src/lib/shop-actions.ts#payOrderByEtransfer`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/orders.ts#switchOrderToEtransfer`

### site-section-copy-save (orgapps.cms)

Edit a page's wording. Canonical: `the site-section-save hub entry (SiteBuilderAdapter) as the one write, with a services saveSiteSection that validates sectionKey against the page layout and merges.`.

- calls: (raw INSERT ... ON CONFLICT org_site_sections), (requireOrgEditor: signed in and canEdit = owner or guide)
  - `sa:apps/amrit-canada/src/lib/cms/actions.ts#saveSectionAction`
  - `sa:apps/elktours/src/lib/cms/actions.ts#saveSectionAction`
  - `sa:apps/innergathering/src/lib/cms/actions.ts#saveSectionAction`
  - `sa:apps/sunjay/src/lib/cms/actions.ts#saveSectionAction`
- calls: (raw INSERT org_site_sections), @elkdonis/utils#sanitizeRichText
  - `api:apps/fourthwayBookreaders/src/app/api/manage/section/route.ts#PUT`
- calls: @elkdonis/db#db
  - `sql:apps/amrit-canada/src/lib/cms/actions.ts#saveSectionAction`
  - `sql:apps/elktours/src/lib/cms/actions.ts#saveSectionAction`
  - `sql:apps/innergathering/src/lib/cms/actions.ts#saveSectionAction`
  - `sql:apps/sunjay/src/lib/cms/actions.ts#saveSectionAction`
- calls: @elkdonis/db#db, @elkdonis/utils#sanitizeRichText
  - `sql:apps/fourthwayBookreaders/src/app/api/manage/section/route.ts#PUT`

### site-style-save (orgapps.site-style)

Change the site's look (colours, fonts, header and footer). Canonical: `One org-site kit action: getApiEditor + services saveSiteTheme + a services saveSiteChrome (moves the raw site_config SQL out of apps) + revalidatePath('/', 'layout'); the SITE_STYLE schema stays per app as config.`.

- calls: (calls local saveSiteStyle)
  - `sa:apps/elktours/src/lib/site-style-actions.ts#saveSiteStyleAction`
  - `sa:apps/hidden-enneagram/src/lib/site-style-actions.ts#saveSiteStyleAction`
  - `sa:apps/katie-the-potter/src/lib/site-style-actions.ts#saveSiteStyleAction`
  - `sa:apps/sunjay/src/lib/site-style-actions.ts#saveSiteStyleAction`
- calls: @elkdonis/db#withOrg, @elkdonis/direct-edit/site#cleanSiteStyle, @elkdonis/services#saveSiteTheme
  - `sql:apps/elktours/src/lib/site-style.ts#saveSiteStyle`
  - `sql:apps/hidden-enneagram/src/lib/site-style.ts#saveSiteStyle`
  - `sql:apps/katie-the-potter/src/lib/site-style.ts#saveSiteStyle`
  - `sql:apps/sunjay/src/lib/site-style.ts#saveSiteStyle`

### site-theme-save (orgapps.site-style)

Change the site's theme (palette and fonts). Canonical: `site_themes via services saveSiteTheme (the site-style-save path); danamccool migrates its palette/fonts into site_themes vars.`.

- calls: (local saveFonts)
  - `sa:apps/danamccool/src/lib/theme-actions.ts#saveFontsAction`
- calls: (local savePalette + saveFonts)
  - `sa:apps/danamccool/src/lib/theme-actions.ts#saveThemeAction`
- calls: (local savePalette)
  - `sa:apps/danamccool/src/lib/theme-actions.ts#savePaletteAction`
- calls: @elkdonis/db#db
  - `sql:apps/danamccool/src/lib/theme-store.ts#saveFonts`
  - `sql:apps/danamccool/src/lib/theme-store.ts#savePalette`
- calls: @elkdonis/services#hasOrgRole, @elkdonis/services#saveSiteTheme
  - `sa:apps/ifac/src/lib/theme-actions.ts#saveIfacThemeAction`
- calls: hasOrgRole, saveSiteTheme
  - `sa:apps/arts-collective/src/lib/theme-actions.ts#saveSiteThemeAction`

### slot-booking-window (orgapps.commerce.booking)

Close or reopen booking on a tour date.

- calls: @elkdonis/checkout/booking-server#closeSlotNow
  - `sa:apps/elktours/src/lib/slot-actions.ts#closeSlotNow`
- calls: @elkdonis/checkout/booking-server#reopenSlot
  - `sa:apps/elktours/src/lib/slot-actions.ts#reopenSlot`
- calls: @elkdonis/db#db
  - `sql:packages/booking/src/server/slots.ts#closeSlotNow`
  - `sql:packages/booking/src/server/slots.ts#reopenSlot`

### slot-cancel (orgapps.commerce.booking)

Cancel a tour date. Canonical: `booking tables cancelSlot, with the refund-due list.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/slots.ts#cancelSlot`
- calls: @elkdonis/checkout/booking-server#cancelSlot, @elkdonis/commerce/server#cancelDeparture, @elkdonis/commerce/server#listDepartureBookings
  - `sa:apps/elktours/src/lib/slot-actions.ts#cancelSlot`
- calls: @elkdonis/commerce/server#cancelDeparture
  - `sa:apps/elktours/src/lib/tour-actions.ts#cancelDepartureAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/tours.ts#cancelDeparture`

### slot-edit (orgapps.commerce.booking)

Change a tour date. Canonical: `slot-actions updateSlot on the booking tables.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/slots.ts#setOverrides`
  - `sql:packages/booking/src/server/slots.ts#updateSlot`
- calls: @elkdonis/checkout/booking-server#updateSlot, @elkdonis/commerce/server#updateDeparture
  - `sa:apps/elktours/src/lib/slot-actions.ts#updateSlot`
- calls: @elkdonis/commerce/server#createDeparture, @elkdonis/commerce/server#updateDeparture
  - `sa:apps/elktours/src/lib/tour-actions.ts#saveDepartureAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/tours.ts#updateDeparture`

### slot-run (orgapps.commerce.booking)

Run a tour date that is below its minimum.

- calls: @elkdonis/checkout/booking-server#runSlot
  - `sa:apps/elktours/src/lib/slot-actions.ts#runSlot`
- calls: @elkdonis/db#db
  - `sql:packages/booking/src/server/slots.ts#runSlot`

### slots-create (orgapps.commerce.booking)

Add tour dates (slots). Canonical: `slot-actions createSlots on the booking tables; retire addDeparturesAction at the cutover.`.

- calls: (none resolved)
  - `sql:packages/booking/src/server/slots.ts#createSlots`
- calls: @elkdonis/checkout/booking-server#createSlots, @elkdonis/commerce/server#createDeparture
  - `sa:apps/elktours/src/lib/slot-actions.ts#createSlots`
- calls: @elkdonis/commerce/server#createDeparture
  - `sa:apps/elktours/src/lib/tour-actions.ts#addDeparturesAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/tours.ts#createDeparture`

### sophia-course-author (apps.sophia)

Author and run a course. Canonical: `packages/lms-ui handleLmsAction (already shared)`.

- calls: @elkdonis/lms-ui#handleLmsAction, lms#createCourse
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#createRun
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#publishCourse
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#setRealm
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#setWorkshopListing
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#syncWorkshopEnrolments
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#updateCourse
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#updateRun
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`

### sophia-course-authoring-internal (apps.sophia)

Edit a course outline, step or pool. Canonical: `packages/lms-ui handleLmsAction (already shared)`.

- calls: @elkdonis/lms-ui#handleLmsAction, connectors.uploadMedia, lms#upsertStepDraft
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#addToPool
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#editOutline
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#updatePoolItem
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#upsertStepDraft
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#usePoolItem
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`

### sophia-course-guide (apps.sophia)

Guide a course group. Canonical: `packages/lms-ui handleLmsAction (already shared)`.

- calls: @elkdonis/lms-ui#handleLmsAction, lms#acknowledge
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#addRunGuideByEmail
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#adoptLatestVersion
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#openRunDiscussions
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#waiveStep
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`

### sophia-course-learn (apps.sophia)

Take a course. Canonical: `packages/lms-ui handleLmsAction (already shared)`.

- calls: @elkdonis/lms-ui#handleLmsAction, lms#completeStep
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#completeStep, lms#saveResponse
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#deleteResponse
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#enrol
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#withdraw
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`

### sophia-registry-admin (apps.sophia)

Curate traditions and listed guides. Canonical: `packages/lms-ui handleLmsAction (already shared)`.

- calls: @elkdonis/lms-ui#handleLmsAction, lms#addGuideByEmail
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#deleteTradition
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#removeGuide
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#saveGuide
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`
- calls: @elkdonis/lms-ui#handleLmsAction, lms#saveTradition
  - `api:apps/sophia/src/app/api/lms/[action]/route.ts#POST`

### start-piece-plan (arts-collective.channel)

Start a plan for a piece. Canonical: `planPiece with a no-proposals option`.

- calls: @elkdonis/actions/server#performSiteChannelAction
  - `sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction`
  - `sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction`
- calls: ensureChannelPlan
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#startPlanAction`

### stop-email-to-address (arts-collective.hub)

Stop all email to an address.

- calls: (getApiEditor: owner or guide), @elkdonis/email#suppressAddress
  - `api:apps/ifac/src/app/api/hub/email/addresses/route.ts#PATCH`
- calls: @elkdonis/email#suppressAddress
  - `api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#PATCH`
- calls: suppressAddress
  - `api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#PATCH`

### store-pause (apps.art-auction.admin)

Pause or reactivate a store.

- calls: @elkdonis/commerce/server#approveStore
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminReactivateStore`
- calls: @elkdonis/commerce/server#pauseStore
  - `sa:apps/art-auction/src/app/admin/actions.ts#adminPauseStore`

### submit-artist-wizard (arts-collective.network)

Finish your artist profile questionnaire. Canonical: `services artistProfile.submit`.

- calls: @elkdonis/services#gainSpace
  - `sql:apps/arts-collective/src/app/api/wizard/submit/route.ts#POST`
- calls: gainSpace
  - `api:apps/arts-collective/src/app/api/wizard/submit/route.ts#POST`

### submit-business-wizard (arts-collective.network)

Finish your business questionnaire. Canonical: `services artistProfile module`.

- calls: @elkdonis/db#db, @elkdonis/services#gainSpace
  - `sql:apps/arts-collective/src/app/api/wizard/business/submit/route.ts#POST`
- calls: gainSpace
  - `api:apps/arts-collective/src/app/api/wizard/business/submit/route.ts#POST`

### sunjay-center-layout-save (apps.sunjay.center)

Arrange the organisation's Center page. Canonical: `services saveCenterLayout behind one shared route (already a service); keep per-app auth only`.

- calls: (getViewer; allowed: global admin, or canEditOrgIdentity for the org in ?org=; the network config org needs admin), @elkdonis/services#saveCenterLayout
  - `api:apps/hidden-enneagram/src/app/api/center/layout/route.ts#PATCH`
- calls: @elkdonis/auth-server#isAdmin, @elkdonis/services#canEditOrgIdentity, @elkdonis/services#saveCenterLayout
  - `api:apps/amrit-canada/src/app/api/center/layout/route.ts#PATCH`
  - `api:apps/elktours/src/app/api/center/layout/route.ts#PATCH`
  - `api:apps/innergathering/src/app/api/center/layout/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/center/layout/route.ts#PATCH`

### sunjay-chat-name-set (apps.sunjay.hub)

Choose my chat name. Canonical: `packages/chat createChatApi`.

- calls: (withMember: getApiMember), @elkdonis/services#setOrgChatDisplayName
  - `api:apps/hidden-enneagram/src/app/api/chat/identity/route.ts#PUT`
  - `api:apps/ifac/src/app/api/chat/identity/route.ts#PUT`
- calls: @elkdonis/services#setOrgChatDisplayName
  - `api:apps/amrit-canada/src/app/api/chat/identity/route.ts#PUT`
  - `api:apps/elktours/src/app/api/chat/identity/route.ts#PUT`
  - `api:apps/innergathering/src/app/api/chat/identity/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/chat/identity/route.ts#PUT`

### sunjay-chat-post (apps.sunjay.hub)

Post in the group chat. Canonical: `packages/chat createChatApi (already shared)`.

- calls: (withMember via createChatApi: getApiMember), @elkdonis/services#getProfile, @elkdonis/services#postOrgChatMessage
  - `api:apps/hidden-enneagram/src/app/api/chat/messages/route.ts#POST`
  - `api:apps/ifac/src/app/api/chat/messages/route.ts#POST`
- calls: @elkdonis/services#getProfile, @elkdonis/services#postOrgChatMessage
  - `api:apps/amrit-canada/src/app/api/chat/messages/route.ts#POST`
  - `api:apps/elktours/src/app/api/chat/messages/route.ts#POST`
  - `api:apps/innergathering/src/app/api/chat/messages/route.ts#POST`
  - `api:apps/sunjay/src/app/api/chat/messages/route.ts#POST`

### sunjay-cycle-confirm (apps.sunjay.audience)

Confirm or cancel this cycle's gathering. Canonical: `a shared cycle-event handler in services`.

- calls: (raw INSERT thread_cycle_events)
  - `api:apps/amrit-canada/src/app/api/threads/[id]/cycle/route.ts#POST`
  - `api:apps/sunjay/src/app/api/threads/[id]/cycle/route.ts#POST`
- calls: (raw SQL INSERT into thread_cycle_events)
  - `api:apps/innergathering/src/app/api/threads/[id]/cycle/route.ts#POST`
- calls: raw SQL INSERT thread_cycle_events
  - `api:apps/elktours/src/app/api/threads/[id]/cycle/route.ts#POST`

### sunjay-document-assign (apps.sunjay.hub)

Attach a document to an idea. Canonical: `services assignOrgDocument`.

- calls: (getApiMember: owner, guide or member), @elkdonis/services#assignOrgDocument
  - `api:apps/hidden-enneagram/src/app/api/hub/documents/route.ts#PATCH`
- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), @elkdonis/services#assignOrgDocument
  - `api:apps/ifac/src/app/api/hub/documents/route.ts#PATCH`
- calls: @elkdonis/services#assignOrgDocument
  - `api:apps/amrit-canada/src/app/api/hub/documents/route.ts#PATCH`
  - `api:apps/elktours/src/app/api/hub/documents/route.ts#PATCH`
  - `api:apps/innergathering/src/app/api/hub/documents/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/hub/documents/route.ts#PATCH`

### sunjay-document-create (apps.sunjay.hub)

Start a shared document. Canonical: `services createOrgDocument (already shared); route is a thin mount`.

- calls: (getApiMember: owner, guide or member), @elkdonis/services#createOrgDocument
  - `api:apps/hidden-enneagram/src/app/api/hub/documents/route.ts#POST`
- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), @elkdonis/services#createOrgDocument
  - `api:apps/ifac/src/app/api/hub/documents/route.ts#POST`
- calls: @elkdonis/services#createOrgDocument
  - `api:apps/amrit-canada/src/app/api/hub/documents/route.ts#POST`
  - `api:apps/elktours/src/app/api/hub/documents/route.ts#POST`
  - `api:apps/innergathering/src/app/api/hub/documents/route.ts#POST`
  - `api:apps/sunjay/src/app/api/hub/documents/route.ts#POST`

### sunjay-email-settings-save (apps.sunjay.audience)

Write the gathering emails. Canonical: `a shared email-template-settings module in services (the file is copied per app)`.

- calls: @/lib/email-template-settings#saveEmailTemplateSettings, cleanTemplateConfig
  - `api:apps/elktours/src/app/api/threads/[id]/email-settings/route.ts#PATCH`
- calls: @elkdonis/db#db
  - `sql:apps/amrit-canada/src/lib/email-template-settings.ts#deleteEmailTemplateSettings`
  - `sql:apps/amrit-canada/src/lib/email-template-settings.ts#saveEmailTemplateSettings`
  - `sql:apps/sunjay/src/lib/email-template-settings.ts#deleteEmailTemplateSettings`
  - `sql:apps/sunjay/src/lib/email-template-settings.ts#saveEmailTemplateSettings`
- calls: raw SQL INSERT ... ON CONFLICT email_template_settings
  - `sql:apps/elktours/src/lib/email-template-settings.ts#saveEmailTemplateSettings`
- calls: saveEmailTemplateSettings
  - `api:apps/amrit-canada/src/app/api/threads/[id]/email-settings/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/threads/[id]/email-settings/route.ts#PATCH`

### sunjay-idea-submit (apps.sunjay.hub)

Suggest an idea. Canonical: `services createOrgIdea`.

- calls: (getHubViewer: owner, guide or member of ifac via hasOrgRole), @elkdonis/services#createOrgIdea
  - `api:apps/ifac/src/app/api/hub/ideas/route.ts#POST`
- calls: @elkdonis/services#createOrgIdea
  - `api:apps/amrit-canada/src/app/api/hub/ideas/route.ts#POST`
  - `api:apps/elktours/src/app/api/hub/ideas/route.ts#POST`
  - `api:apps/sunjay/src/app/api/hub/ideas/route.ts#POST`
- calls: @elkdonis/services#createOrgIdea, @elkdonis/services#ensureIdeasFeed
  - `api:apps/fourthwayBookreaders/src/app/api/suggest/route.ts#POST`

### sunjay-inquiry-send (apps.sunjay.audience)

Send an inquiry about a service. Canonical: `one shared inquiry handler in services`.

- calls: (raw INSERT guest_submissions, contacts)
  - `api:apps/amrit-canada/src/app/api/inquiry/route.ts#POST`
  - `api:apps/sunjay/src/app/api/inquiry/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:apps/amrit-canada/src/app/api/inquiry/route.ts#POST`
  - `sql:apps/sunjay/src/app/api/inquiry/route.ts#POST`
- calls: raw SQL
  - `sql:apps/elktours/src/app/api/inquiry/route.ts#POST`
- calls: raw SQL INSERT guest_submissions, contacts
  - `api:apps/elktours/src/app/api/inquiry/route.ts#POST`

### sunjay-login (apps.sunjay.center)

Sign in. Canonical: `auth-server login handler (shared); decide whether sign-in should ever join an org (signup already does)`.

- calls: (raw UPDATE contacts), @elkdonis/auth-server#handleLogin
  - `api:apps/admin/src/app/api/auth/login/route.ts#POST`
- calls: @elkdonis/auth-server#createLoginHandler (joinOrgs viewer)
  - `api:apps/katie-the-potter/src/app/api/auth/login/route.ts#POST`
  - `api:apps/sunjay/src/app/api/auth/login/route.ts#POST`
- calls: @elkdonis/auth-server#handleLogin
  - `api:apps/fourthwayBookreaders/src/app/api/auth/login/route.ts#POST`
- calls: @elkdonis/auth-server#handleLogin, @elkdonis/db#db
  - `sql:apps/admin/src/app/api/auth/login/route.ts#POST`

### sunjay-media-upload (apps.sunjay.audience)

Upload a file for the site. Canonical: `one upload route in services with a per-app policy object (types, sizes, who)`.

- calls: (getApiEditor: owner or guide), @elkdonis/services#getUploadPath, @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/hidden-enneagram/src/app/api/upload/route.ts#POST`
- calls: (raw INSERT media), @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/amrit-canada/src/app/api/upload/route.ts#POST`
  - `api:apps/sunjay/src/app/api/upload/route.ts#POST`
- calls: (raw INSERT media), @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer, getStorageSlug, resolveUserPath
  - `api:apps/katie-the-potter/src/app/api/media/upload/route.ts#POST`
- calls: @elkdonis/db#db, @elkdonis/services#createUserFolder, @elkdonis/services#getProxyFileUrl, @elkdonis/services#getStorageSlug, @elkdonis/services#resolveUserPath, @elkdonis/services#uploadFile, @elkdonis/services#uploadFilename, @elkdonis/utils#validateUploadBuffer
  - `sql:apps/katie-the-potter/src/app/api/media/upload/route.ts#POST`
- calls: @elkdonis/services#uploadFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/innergathering/src/app/api/upload/route.ts#POST`
- calls: @elkdonis/services#uploadOrgFile, @elkdonis/utils#validateUploadBuffer
  - `api:apps/fourthwayBookreaders/src/app/api/upload/route.ts#POST`

### sunjay-pipeline-attachment-add (apps.sunjay.pipeline)

Attach a file to a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withMember: getApiMember = owner, guide or member)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST`
- calls: @/lib/pipeline#addPipelineAttachment
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST`
- calls: lib/pipeline#addPipelineAttachment
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/attachments/route.ts#POST`

### sunjay-pipeline-attachment-delete (apps.sunjay.pipeline)

Remove a pipeline attachment. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE`
- calls: @/lib/pipeline#removePipelineAttachment
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE`
- calls: lib/pipeline#removePipelineAttachment
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/attachments/[attachmentId]/route.ts#DELETE`

### sunjay-pipeline-card-add (apps.sunjay.pipeline)

Add a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withMember: getApiMember = owner, guide or member)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/route.ts#POST`
  - `api:apps/ifac/src/app/api/pipeline/cards/route.ts#POST`
- calls: @/lib/pipeline#createPipelineCard
  - `api:apps/elktours/src/app/api/pipeline/cards/route.ts#POST`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/route.ts#POST`
  - `api:apps/sunjay/src/app/api/pipeline/cards/route.ts#POST`
- calls: lib/pipeline#createPipelineCard
  - `api:apps/innergathering/src/app/api/pipeline/cards/route.ts#POST`

### sunjay-pipeline-card-assign (apps.sunjay.pipeline)

Assign a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: @/lib/pipeline#setPipelineCardAssignee
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT`

### sunjay-pipeline-card-delete (apps.sunjay.pipeline)

Delete a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE`
- calls: @/lib/pipeline#deletePipelineCard
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE`
- calls: lib/pipeline#deletePipelineCard
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/route.ts#DELETE`

### sunjay-pipeline-card-edit (apps.sunjay.pipeline)

Edit a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withMember: getApiMember = owner, guide or member)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT`
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT`
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH`
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT`
- calls: @/lib/pipeline#updatePipelineCard
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH`
- calls: lib/pipeline#updatePipelineCard
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/route.ts#PATCH`

### sunjay-pipeline-card-label (apps.sunjay.pipeline)

Label a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: @/lib/pipeline#setPipelineCardLabel
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT`

### sunjay-pipeline-card-move (apps.sunjay.pipeline)

Move a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withMember: getApiMember = owner, guide or member)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT`
- calls: @/lib/pipeline#movePipelineCard
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT`
- calls: lib/pipeline#movePipelineCard
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/reorder/route.ts#PUT`
- calls: lib/pipeline#setPipelineCardArchived, lib/pipeline#setPipelineCardDone
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT`
- calls: lib/pipeline#setPipelineCardAssignee
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/assignees/route.ts#PUT`
- calls: lib/pipeline#setPipelineCardLabel
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/labels/route.ts#PUT`

### sunjay-pipeline-card-state (apps.sunjay.pipeline)

Tick or archive a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: @/lib/pipeline#setPipelineCardArchived, @/lib/pipeline#setPipelineCardDone
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/state/route.ts#PUT`

### sunjay-pipeline-comment-add (apps.sunjay.pipeline)

Comment on a pipeline card. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withMember: getApiMember = owner, guide or member), @elkdonis/services#getProfile
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST`
- calls: @/lib/pipeline#addPipelineComment, @elkdonis/services#getProfile
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST`
- calls: @elkdonis/services#getProfile, lib/pipeline#addPipelineComment
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/comments/route.ts#POST`

### sunjay-pipeline-comment-delete (apps.sunjay.pipeline)

Delete a pipeline comment. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE`
  - `api:apps/ifac/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE`
- calls: @/lib/pipeline#deletePipelineComment
  - `api:apps/elktours/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE`
- calls: lib/pipeline#deletePipelineComment
  - `api:apps/innergathering/src/app/api/pipeline/cards/[cardId]/comments/[commentId]/route.ts#DELETE`

### sunjay-pipeline-list-add (apps.sunjay.pipeline)

Add a pipeline list. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/stacks/route.ts#POST`
  - `api:apps/ifac/src/app/api/pipeline/stacks/route.ts#POST`
- calls: @/lib/pipeline#createPipelineStack
  - `api:apps/elktours/src/app/api/pipeline/stacks/route.ts#POST`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/stacks/route.ts#POST`
  - `api:apps/sunjay/src/app/api/pipeline/stacks/route.ts#POST`
- calls: lib/pipeline#createPipelineStack
  - `api:apps/innergathering/src/app/api/pipeline/stacks/route.ts#POST`

### sunjay-pipeline-list-delete (apps.sunjay.pipeline)

Delete a pipeline list. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE`
  - `api:apps/ifac/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE`
- calls: @/lib/pipeline#deletePipelineStack
  - `api:apps/elktours/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE`
- calls: lib/pipeline#deletePipelineStack
  - `api:apps/innergathering/src/app/api/pipeline/stacks/[stackId]/route.ts#DELETE`

### sunjay-pipeline-list-rename (apps.sunjay.pipeline)

Rename a pipeline list. Canonical: `packages/pipeline createPipelineApi + services org-deck (already shared)`.

- calls: (withEditor: getApiEditor = owner or guide)
  - `api:apps/hidden-enneagram/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH`
  - `api:apps/ifac/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH`
- calls: @/lib/pipeline#renamePipelineStack
  - `api:apps/elktours/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH`
- calls: @elkdonis/services (org-deck)
  - `api:apps/amrit-canada/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH`
- calls: lib/pipeline#renamePipelineStack
  - `api:apps/innergathering/src/app/api/pipeline/stacks/[stackId]/route.ts#PATCH`

### sunjay-quote-submit (apps.sunjay.center)

Add a line to the Center quote band. Canonical: `services submitQuote`.

- calls: (getViewer: any signed-in person; owner or guide publish directly), @elkdonis/services#submitQuote
  - `api:apps/hidden-enneagram/src/app/api/center/quotes/route.ts#POST`
- calls: @elkdonis/services#submitQuote
  - `api:apps/amrit-canada/src/app/api/center/quotes/route.ts#POST`
  - `api:apps/elktours/src/app/api/center/quotes/route.ts#POST`
  - `api:apps/sunjay/src/app/api/center/quotes/route.ts#POST`

### sunjay-reminder-set (apps.sunjay.audience)

Set when a gathering reminder goes out. Canonical: `services setThreadReminder behind one shared route`.

- calls: (raw UPDATE threads reminder_minutes_before)
  - `api:apps/amrit-canada/src/app/api/threads/[id]/reminder/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/threads/[id]/reminder/route.ts#PATCH`
- calls: @elkdonis/db#db
  - `sql:apps/amrit-canada/src/app/api/threads/[id]/reminder/route.ts#PATCH`
  - `sql:apps/sunjay/src/app/api/threads/[id]/reminder/route.ts#PATCH`
- calls: raw SQL
  - `sql:apps/elktours/src/app/api/threads/[id]/reminder/route.ts#PATCH`
- calls: raw SQL UPDATE threads
  - `api:apps/elktours/src/app/api/threads/[id]/reminder/route.ts#PATCH`

### sunjay-reminders-send (apps.sunjay.audience)

Send due gathering reminders. Canonical: `one shared reminder tick in services, called by each app instrumentation`.

- calls: (raw INSERT thread_reminder_sends, UPDATE recipients), @elkdonis/email#sendReminderEmail
  - `sql:apps/amrit-canada/src/lib/reminders.ts#runReminderTick`
  - `sql:apps/sunjay/src/lib/reminders.ts#runReminderTick`
- calls: @elkdonis/email#sendReminderEmail, raw SQL INSERT thread_reminder_sends, raw SQL UPDATE thread_reminder_sends
  - `sql:apps/elktours/src/lib/reminders.ts#runReminderTick`

### sunjay-rsvp-guest (apps.sunjay.audience)

RSVP as a guest, without an account. Canonical: `one shared guest RSVP handler in services with rate limit and email validation`.

- calls: (raw INSERT guest_submissions, contacts), @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification
  - `api:apps/amrit-canada/src/app/api/rsvp/route.ts#POST`
  - `api:apps/sunjay/src/app/api/rsvp/route.ts#POST`
- calls: (raw SQL in the same function)
  - `sql:apps/innergathering/src/app/api/rsvp/route.ts#POST`
- calls: @elkdonis/db#db, @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification
  - `sql:apps/amrit-canada/src/app/api/rsvp/route.ts#POST`
  - `sql:apps/sunjay/src/app/api/rsvp/route.ts#POST`
- calls: @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification
  - `api:apps/innergathering/src/app/api/rsvp/route.ts#POST`
- calls: @elkdonis/email#sendRsvpConfirmation, @elkdonis/email#sendRsvpNotification, raw SQL INSERT guest_submissions, contacts
  - `api:apps/elktours/src/app/api/rsvp/route.ts#POST`
- calls: raw SQL
  - `sql:apps/elktours/src/app/api/rsvp/route.ts#POST`

### sunjay-social-account-manage (apps.sunjay.center)

Edit or check a connected account. Canonical: `services connectionsHandlers (already shared)`.

- calls: @elkdonis/services#centerRoutes (connections)
  - `api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH`
- calls: @elkdonis/services#connectionsHandlers
  - `api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH`
  - `api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH`

### sunjay-trigger-email-send (apps.sunjay.audience)

Email everyone who said they are coming. Canonical: `a shared trigger-email handler in services`.

- calls: @elkdonis/email#sendMeetingTriggerEmail
  - `api:apps/amrit-canada/src/app/api/threads/[id]/trigger-email/route.ts#POST`
  - `api:apps/sunjay/src/app/api/threads/[id]/trigger-email/route.ts#POST`
- calls: @elkdonis/email#sendMeetingTriggerEmail, @elkdonis/utils#lastOccurrenceEnd
  - `api:apps/innergathering/src/app/api/threads/[id]/trigger-email/route.ts#POST`
- calls: @elkdonis/email#sendMeetingTriggerEmail, getEmailTemplateSettingsForThread
  - `api:apps/elktours/src/app/api/threads/[id]/trigger-email/route.ts#POST`

### sunjay-whiteboard-save (apps.sunjay.hub)

Draw on the group's whiteboard. Canonical: `services saveWhiteboard`.

- calls: (getApiMember: owner, guide or member), @elkdonis/services#saveWhiteboard
  - `api:apps/hidden-enneagram/src/app/api/hub/whiteboard/route.ts#PUT`
  - `api:apps/ifac/src/app/api/hub/whiteboard/route.ts#PUT`
- calls: @elkdonis/services#saveWhiteboard
  - `api:apps/amrit-canada/src/app/api/hub/whiteboard/route.ts#PUT`
  - `api:apps/elktours/src/app/api/hub/whiteboard/route.ts#PUT`
  - `api:apps/innergathering/src/app/api/hub/whiteboard/route.ts#PUT`
  - `api:apps/sunjay/src/app/api/hub/whiteboard/route.ts#PUT`

### tick-plan-step (arts-collective.channel)

Tick a plan step. Canonical: `packages/actions server/channel.ts planStep`.

- calls: @elkdonis/actions/server#performSiteChannelAction
  - `sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction`
  - `sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction`
- calls: setChannelPlanStep
  - `sa:apps/arts-collective/src/lib/channel/actions.ts#setPlanStepAction`

### tour-booking-cancel (orgapps.commerce.booking)

Cancel a guest's tour booking.

- calls: @elkdonis/booking#orgCancelBooking, elktours/lib/departures#cancelTourBooking
  - `sa:apps/elktours/src/lib/tour-actions.ts#cancelBookingAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/tours.ts#cancelTourBooking`

### tour-booking-defaults-save (orgapps.commerce.booking)

Save a tour's booking defaults.

- calls: @elkdonis/checkout/booking-server#setOfferDefaults
  - `sa:apps/elktours/src/lib/slot-actions.ts#saveTourBookingDefaults`
- calls: @elkdonis/checkout/booking-server#setOfferDefaults, @elkdonis/db#db
  - `sql:apps/elktours/src/lib/slot-actions.ts#saveTourBookingDefaults`
- calls: @elkdonis/db#db
  - `sql:packages/booking/src/server/slots.ts#setOfferDefaults`

### tour-places-book (orgapps.commerce.booking)

Book places on a tour. Canonical: `startBookingCheckout on the booking tables.`.

- calls: (none resolved)
  - `sql:packages/commerce/src/server/tours.ts#createTourBooking`
- calls: @elkdonis/checkout/booking#bookingAvailability, @elkdonis/checkout/booking#publicOriginFrom, @elkdonis/checkout/booking#startBookingCheckout, @elkdonis/checkout/booking#startTourCheckout
  - `sa:apps/elktours/src/lib/tour-actions.ts#bookTourAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/tours.ts#markTourBookingPaid`
- calls: elktours/lib/tour-actions#bookTourAction, elktours/lib/tour-slots#quoteBooking
  - `sa:apps/elktours/src/lib/book-actions.ts#payForSlotAction`

### tour-save (orgapps.commerce.tours)

Save a tour. Canonical: `patchTourAction (merging, schema-limited) for edits; saveTourAction for create only.`.

- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/utils#deriveExcerpt, @elkdonis/utils#sanitizeRichText
  - `sql:apps/elktours/src/lib/tour-actions.ts#saveTourAction`
  - `sql:apps/elktours/src/lib/tour-live-actions.ts#patchTourAction`
- calls: @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/utils#sanitizeRichText
  - `sa:apps/elktours/src/lib/tour-live-actions.ts#patchTourAction`
- calls: @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/utils#sanitizeRichText, elktours/lib/tour-cache#refreshTourRoute
  - `sa:apps/elktours/src/lib/tour-actions.ts#saveTourAction`

### tour-stops-save (orgapps.commerce.tours)

Save a tour's stops.

- calls: @elkdonis/commerce/server#listTourStops, @elkdonis/db#db
  - `sql:apps/elktours/src/lib/tour-cache.ts#refreshTourRoute`
- calls: @elkdonis/commerce/server#saveTourStops, @elkdonis/utils#sanitizeRichText
  - `sa:apps/elktours/src/lib/tour-actions.ts#saveStopsAction`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/tours.ts#saveTourStops`
  - `sql:packages/commerce/src/server/tours.ts#setTourStopStill`

### unfollow-organisation (arts-collective.hub)

Stop following an organisation.

- calls: (getViewer; refuses members: leave from the hub), @elkdonis/services#unfollowOrg
  - `api:apps/hidden-enneagram/src/app/api/center/follow/route.ts#DELETE`
- calls: @elkdonis/services#unfollowOrg
  - `api:apps/amrit-canada/src/app/api/center/follow/route.ts#DELETE`
  - `api:apps/fourthwayBookreaders/src/app/api/center/follow/route.ts#DELETE`
  - `api:apps/innergathering/src/app/api/center/follow/route.ts#DELETE`
  - `api:apps/sunjay/src/app/api/center/follow/route.ts#DELETE`
- calls: unfollowOrg
  - `api:apps/arts-collective/src/app/api/org/[slug]/follow/route.ts#DELETE`

### upload-profile-photo (arts-collective.hub)

Upload a photo to my storage.

- calls: (getViewer: any signed-in person), @elkdonis/services#getStorageSlug, @elkdonis/services#uploadUserFile
  - `api:apps/hidden-enneagram/src/app/api/center/avatar/route.ts#POST`
  - `api:apps/ifac/src/app/api/center/avatar/route.ts#POST`
- calls: @elkdonis/services#getStorageSlug, @elkdonis/services#uploadUserFile
  - `api:apps/amrit-canada/src/app/api/center/avatar/route.ts#POST`
  - `api:apps/elktours/src/app/api/center/avatar/route.ts#POST`
  - `api:apps/innergathering/src/app/api/center/avatar/route.ts#POST`
  - `api:apps/sunjay/src/app/api/center/avatar/route.ts#POST`
- calls: uploadUserFile
  - `api:apps/arts-collective/src/app/api/center/avatar/route.ts#POST`

### use-video-extras (arts-collective.studio)

Video helpers (sounds, music, transcript).

- calls: importFreesound
  - `sa:apps/arts-collective/src/lib/video-actions.ts#importVideoFreesound`
- calls: queueReelTranscript
  - `sa:apps/arts-collective/src/lib/video-actions.ts#transcribeVideo`
- calls: shareReelMusic
  - `sa:apps/arts-collective/src/lib/video-actions.ts#shareVideoMusic`
- calls: shareReelSound
  - `sa:apps/arts-collective/src/lib/video-actions.ts#shareVideoSound`

### user-theme-save (orgapps.site-style)

Change my own profile look. Canonical: `services saveUserTheme via the kit.`.

- calls: @elkdonis/services#saveUserTheme
  - `sa:apps/ifac/src/lib/theme-actions.ts#saveMyIfacThemeAction`
- calls: saveUserTheme
  - `sa:apps/arts-collective/src/lib/theme-actions.ts#saveMyThemeAction`

### workshop-join (orgapps.commerce.shop)

Join a workshop (free or paid). Canonical: `the booking module with a capacity-locked createBooking, or services RSVP + startThreadCheckout.`.

- calls: @elkdonis/auth-server#getServerSession, @elkdonis/commerce/server#createThreadOrder, @elkdonis/db#db, @elkdonis/services#checkRsvpEligibility
  - `sql:apps/inner-gathering/src/app/api/workshops/[id]/join/route.ts#POST`
- calls: @elkdonis/commerce/server#createThreadOrder, @elkdonis/services#checkRsvpEligibility
  - `api:apps/inner-gathering/src/app/api/workshops/[id]/join/route.ts#POST`
- calls: @elkdonis/db#db
  - `sql:packages/commerce/src/server/service-orders.ts#createThreadOrder`

### workshop-save (orgapps.meetings)

Save a workshop offering. Canonical: `services upsertWorkshopOffering plus the autosave guard moved into services (as meeting and post already do).`.

- calls: @elkdonis/db#db (autosave status read), @elkdonis/services#ensureWorkshopMaterialsFolder, @elkdonis/services#upsertWorkshopOffering, @elkdonis/services#workshopInputFromAnswers
  - `sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteWorkshopSaveAction`
- calls: @elkdonis/services#ensureWorkshopMaterialsFolder, @elkdonis/services#upsertWorkshopOffering
  - `sa:apps/innergathering/src/lib/cms/workshop-actions.ts#saveWorkshopAction`
- calls: ensureWorkshopMaterialsFolder, upsertWorkshopOffering
  - `sa:apps/arts-collective/src/lib/cms/actions.ts#saveWorkshopAction`

### writing-piece-delete (orgapps.writing)

Delete (archive) a piece of writing. Canonical: `services deleteWritingPost behind one shared desk action.`.

- calls: (local helper; no @elkdonis call resolved)
  - `sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#removePublishPiece`
- calls: @elkdonis/services#deleteWritingPost
  - `sa:apps/artdirect/src/lib/writing-actions.ts#deletePieceAction`
  - `sa:apps/ifac/src/lib/writing-actions.ts#deletePieceAction`
- calls: @elkdonis/services#deleteWritingPost, @elkdonis/services#getWritingPostById
  - `sa:apps/amrit-canada/src/lib/writing-room-actions.ts#deleteRoomPiece`
  - `sa:apps/danamccool/src/lib/writing-actions.ts#deletePieceAction`
- calls: deleteWritingPost
  - `sa:apps/arts-collective/src/lib/studio-actions.ts#removeStudioPiece`

### writing-piece-save (orgapps.writing)

Save changes to a piece of writing. Canonical: `services updateWritingPost + canEditProfile behind one shared desk action.`.

- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#listActingIdentities, @elkdonis/utils#deriveExcerpt, @elkdonis/utils#sanitizeRichText, @elkdonis/utils/essay#renderEssayHtml
  - `sql:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#savePublishPiece`
- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/utils#sanitizeRichText
  - `sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#savePublishPiece`
- calls: @elkdonis/services#canEditProfile, @elkdonis/services#updateWritingPost
  - `sa:apps/ifac/src/lib/writing-actions.ts#savePieceAction`
- calls: @elkdonis/services#createWritingPost, @elkdonis/services#updateWritingPost
  - `sa:apps/amrit-canada/src/lib/writing-room-actions.ts#saveRoomPiece`
- calls: @elkdonis/services#getWritingPostById, @elkdonis/services#updateWritingPost
  - `sa:apps/danamccool/src/lib/writing-actions.ts#savePieceAction`
- calls: @elkdonis/services#updateWritingPost
  - `sa:apps/artdirect/src/lib/writing-actions.ts#savePieceAction`
- calls: listActingIdentities, updateWritingPost
  - `sa:apps/arts-collective/src/lib/studio-actions.ts#saveStudioPiece`

### writing-piece-start (orgapps.writing)

Start a piece of writing. Canonical: `services createWritingPost (+updateWritingPost) behind one shared desk action in the org-site kit; HE converts to it and drops raw SQL.`.

- calls: @elkdonis/db#db, @elkdonis/services#ensureUniqueThreadSlug, @elkdonis/services#getOrgFeed
  - `sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#startPublishPiece`
  - `sql:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#startPublishPiece`
- calls: @elkdonis/services#canEditProfile, @elkdonis/services#createWritingPost
  - `sa:apps/ifac/src/lib/writing-actions.ts#startPieceAction`
  - `sa:apps/innergathering/src/lib/writing-actions.ts#startPieceAction`
- calls: @elkdonis/services#createWritingPost
  - `sa:apps/artdirect/src/lib/writing-actions.ts#startPieceAction`
  - `sa:apps/danamccool/src/lib/writing-actions.ts#startPieceAction`
- calls: @elkdonis/services#createWritingPost, @elkdonis/services#getProfile
  - `sa:apps/artdirect/src/lib/writing-actions.ts#openNewPieceAction`
- calls: createWritingPost
  - `sa:apps/arts-collective/src/lib/studio-actions.ts#startStudioPiece`

## Hosts with raw SQL in their own body

191 sa/api hosts write SQL directly instead of going through a service. 565 sql sites in total (see inventory).

| app | raw-SQL sa/api hosts | claimed |
|---|--:|--:|
| admin | 8 | 8 |
| amrit-canada | 9 | 9 |
| art-auction | 1 | 1 |
| artdirect | 6 | 6 |
| arts-collective | 21 | 20 |
| danamccool | 3 | 3 |
| elastrocal | 7 | 7 |
| elkdonis-arts-collective | 3 | 3 |
| elktours | 51 | 47 |
| fourthwayBookreaders | 6 | 6 |
| hidden-enneagram | 4 | 4 |
| ifac | 9 | 8 |
| inner-gathering | 25 | 1 |
| innergathering | 10 | 10 |
| katie-the-potter | 4 | 4 |
| pigeonshoot | 14 | 13 |
| sunjay | 10 | 10 |

### admin

- `api:apps/admin/src/app/api/auth/login/route.ts#POST` (cap: sunjay-login)
- `api:apps/admin/src/app/api/contacts/route.ts#PATCH` (cap: admin-contact-status-set)
- `api:apps/admin/src/app/api/meetings/[id]/workshop/route.ts#PATCH` (cap: admin-workshop-promote)
- `api:apps/admin/src/app/api/nextcloud/setup-folders/route.ts#POST` (cap: admin-nextcloud-setup-folders)
- `api:apps/admin/src/app/api/nextcloud/sync-user/[userId]/route.ts#POST` (cap: admin-nextcloud-sync-user)
- `api:apps/admin/src/app/api/nextcloud/sync-users/route.ts#POST` (cap: admin-nextcloud-sync-users)
- `api:apps/admin/src/app/api/users/[userId]/route.ts#PATCH` (cap: admin-user-update)
- `api:apps/admin/src/app/api/work-question/route.ts#POST` (cap: admin-work-question-set)

### amrit-canada

- `api:apps/amrit-canada/src/app/api/inquiry/route.ts#POST` (cap: sunjay-inquiry-send)
- `api:apps/amrit-canada/src/app/api/rsvp/route.ts#POST` (cap: sunjay-rsvp-guest)
- `api:apps/amrit-canada/src/app/api/threads/[id]/reminder/route.ts#PATCH` (cap: sunjay-reminder-set)
- `api:apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts#POST` (cap: rsvp-to-event)
- `sa:apps/amrit-canada/src/lib/account-actions.ts#setOwnProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/amrit-canada/src/lib/cms/actions.ts#saveContentAction` (cap: manage-content-save)
- `sa:apps/amrit-canada/src/lib/cms/actions.ts#saveSectionAction` (cap: site-section-copy-save)
- `sa:apps/amrit-canada/src/lib/cms/actions.ts#setContentPinnedAction` (cap: manage-content-pin)
- `sa:apps/amrit-canada/src/lib/cms/actions.ts#setContentStatusAction` (cap: manage-content-status-set)

### art-auction

- `sa:apps/art-auction/src/app/studio/actions.ts#createLotAction` (cap: lot-create)

### artdirect

- `sa:apps/artdirect/src/lib/dossier-editor-actions.ts#saveDossierFieldAction` (cap: artdirect-dossier-field-save)
- `sa:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileLayoutAction` (cap: artdirect-profile-layout-set)
- `sa:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/artdirect/src/lib/profile-editor-actions.ts#setProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/artdirect/src/lib/social-actions.ts#setSocialSectionAction` (cap: artdirect-social-section-set)
- `sa:apps/artdirect/src/lib/space-actions.ts#setPageBackgroundAction` (cap: artdirect-page-background-set)

### arts-collective

- `api:apps/arts-collective/src/app/api/admin/orgs/[slug]/confirm/route.ts#POST` (cap: confirm-org-address)
- `api:apps/arts-collective/src/app/api/org/join/route.ts#POST` (cap: join-organisation)
- `api:apps/arts-collective/src/app/api/pureland/save/route.ts#PUT` (cap: sync-pureland-save)
- `api:apps/arts-collective/src/app/api/silex/layout/route.ts#POST` (cap: save-silex-layout)
- `api:apps/arts-collective/src/app/api/silex/publish/route.ts#POST` (cap: publish-silex-site)
- `api:apps/arts-collective/src/app/api/silex/token/route.ts#POST` (cap: open-silex-editor)
- `api:apps/arts-collective/src/app/api/wizard/business/save/route.ts#POST` (cap: save-business-wizard)
- `api:apps/arts-collective/src/app/api/wizard/business/submit/route.ts#POST` (cap: submit-business-wizard)
- `api:apps/arts-collective/src/app/api/wizard/save/route.ts#POST` (cap: save-artist-wizard)
- `api:apps/arts-collective/src/app/api/wizard/submit/route.ts#POST` (cap: submit-artist-wizard)
- `sa:apps/arts-collective/src/app/wizard/confirm/actions.ts#startOverAction` (cap: restart-wizard)
- `sa:apps/arts-collective/src/lib/cms/actions.ts#createThreadAction` (cap: create-content)
- `sa:apps/arts-collective/src/lib/cms/actions.ts#togglePinAction` (cap: lead-site-with-post)
- `sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldAction` (cap: edit-workshop-live)
- `sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopThemeAction` (cap: edit-workshop-live)
- `sa:apps/arts-collective/src/lib/cms/actions.ts#upsertWorkshopPageAction`
- `sa:apps/arts-collective/src/lib/cms/draft-actions.ts#publishDraftAction` (cap: publish-draft-post)
- `sa:apps/arts-collective/src/lib/cms/payout-actions.ts#setProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/arts-collective/src/lib/org-identity-actions.ts#saveOrgIdentityAction` (cap: save-org-identity)
- `sa:apps/arts-collective/src/lib/pureland-actions.ts#setPurelandCloudSave` (cap: set-pureland-cloud-save)
- `sa:apps/arts-collective/src/lib/share-actions.ts#sharePiece` (cap: share-piece-to-social)

### danamccool

- `api:apps/danamccool/src/app/api/contact/route.ts#POST` (cap: send-org-contact-message)
- `api:apps/danamccool/src/app/api/media/upload/route.ts#POST` (cap: dana-media-upload)
- `sa:apps/danamccool/src/lib/artwork-actions.ts#changeArtwork` (cap: artwork-display-set)

### elastrocal

- `api:apps/elastrocal/src/app/api/mobile/v1/lamrim/review/route.ts#DELETE` (cap: lamrim-review-delete)
- `api:apps/elastrocal/src/app/api/mobile/v1/lamrim/review/route.ts#POST` (cap: lamrim-review-save)
- `api:apps/elastrocal/src/app/api/mobile/v1/marks/route.ts#DELETE` (cap: astro-passage-mark-delete)
- `api:apps/elastrocal/src/app/api/mobile/v1/marks/route.ts#POST` (cap: astro-passage-mark-save)
- `api:apps/elastrocal/src/app/api/mobile/v1/outlines/route.ts#PUT` (cap: book-outline-save)
- `api:apps/elastrocal/src/app/api/mobile/v1/publish/route.ts#POST` (cap: jerusalem-video-publish)
- `api:apps/elastrocal/src/app/api/mobile/v1/sync/route.ts#POST` (cap: app-records-sync)

### elkdonis-arts-collective

- `api:apps/elkdonis-arts-collective/src/app/api/admin/site-config/route.ts#PATCH` (cap: eac-site-config-save)
- `api:apps/elkdonis-arts-collective/src/app/api/contact/route.ts#POST` (cap: send-org-contact-message)
- `api:apps/elkdonis-arts-collective/src/app/api/inquiries/route.ts#POST` (cap: eac-site-inquiry-record)

### elktours

- `api:apps/elktours/src/app/api/inquiry/route.ts#POST` (cap: sunjay-inquiry-send)
- `api:apps/elktours/src/app/api/rsvp/route.ts#POST` (cap: sunjay-rsvp-guest)
- `api:apps/elktours/src/app/api/threads/[id]/reminder/route.ts#PATCH` (cap: sunjay-reminder-set)
- `api:apps/elktours/src/app/api/threads/[id]/rsvp/route.ts#POST` (cap: rsvp-to-event)
- `api:apps/elktours/src/app/api/upload/forum/route.ts#POST` (cap: elktours-upload-forum-media)
- `sa:apps/elktours/src/lib/account-actions.ts#setOwnProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/elktours/src/lib/artist-wizard-actions.ts#decideExperienceAction` (cap: elktours-experience-decide)
- `sa:apps/elktours/src/lib/artist-wizard-actions.ts#saveArtistProfileAction` (cap: elktours-artist-profile-save)
- `sa:apps/elktours/src/lib/artist-wizard-actions.ts#saveAvailabilityAction` (cap: elktours-artist-availability-save)
- `sa:apps/elktours/src/lib/artist-wizard-actions.ts#saveExperienceDraftAction` (cap: elktours-experience-draft-save)
- `sa:apps/elktours/src/lib/artist-wizard-actions.ts#submitExperienceForReviewAction` (cap: elktours-experience-submit)
- `sa:apps/elktours/src/lib/cms/actions.ts#saveContentAction` (cap: manage-content-save)
- `sa:apps/elktours/src/lib/cms/actions.ts#saveSectionAction` (cap: site-section-copy-save)
- `sa:apps/elktours/src/lib/cms/actions.ts#setContentPinnedAction` (cap: manage-content-pin)
- `sa:apps/elktours/src/lib/cms/actions.ts#setContentStatusAction` (cap: manage-content-status-set)
- `sa:apps/elktours/src/lib/collaborate-actions.ts#inviteForDepartureAction` (cap: elktours-artist-invite-for-departure)
- `sa:apps/elktours/src/lib/collaborate-actions.ts#linkExperienceToStopAction` (cap: elktours-experience-link-to-stop)
- `sa:apps/elktours/src/lib/custom-place-actions.ts#attachPhotoToPinAction` (cap: elktours-place-photo-pin)
- `sa:apps/elktours/src/lib/custom-place-actions.ts#createPlaceFromPhoto` (cap: elktours-place-create-from-photo)
- `sa:apps/elktours/src/lib/custom-place-actions.ts#discardPendingPhotoAction` (cap: elktours-place-photo-discard)
- `sa:apps/elktours/src/lib/experience-actions.ts#saveExperienceAction` (cap: elktours-experience-save)
- `sa:apps/elktours/src/lib/experience-actions.ts#saveExperiencePageAction` (cap: page-save)
- `sa:apps/elktours/src/lib/experience-actions.ts#setExperiencePeopleAction` (cap: elktours-experience-people-set)
- `sa:apps/elktours/src/lib/experience-actions.ts#setExperienceStatusAction` (cap: elktours-experience-status-set)
- `sa:apps/elktours/src/lib/hero-actions.ts#setHeroLeadAction` (cap: elktours-hero-lead-set)
- `sa:apps/elktours/src/lib/place-actions.ts#approvePlaceLinkAction` (cap: elktours-place-link-approve)
- `sa:apps/elktours/src/lib/place-actions.ts#archivePlaceAction` (cap: elktours-place-archive)
- `sa:apps/elktours/src/lib/place-actions.ts#createPlaceFromStopAction`
- `sa:apps/elktours/src/lib/place-actions.ts#updatePlaceFromStopAction` (cap: elktours-place-update-from-stop)
- `sa:apps/elktours/src/lib/place-favourite-actions.ts#setFeaturedPlaceAction`
- `sa:apps/elktours/src/lib/place-favourite-actions.ts#toggleFavouritePlaceAction` (cap: elktours-place-favourite-toggle)
- `sa:apps/elktours/src/lib/place-website-actions.ts#setPlaceWebsiteAction` (cap: elktours-place-website-set)
- `sa:apps/elktours/src/lib/review-actions.ts#deleteOwnReviewAction` (cap: elktours-review-delete-own)
- `sa:apps/elktours/src/lib/review-actions.ts#saveReviewAction` (cap: elktours-review-save)
- `sa:apps/elktours/src/lib/review-actions.ts#setReviewHiddenAction` (cap: elktours-review-hide)
- `sa:apps/elktours/src/lib/slot-actions.ts#saveTourBookingDefaults` (cap: tour-booking-defaults-save)
- `sa:apps/elktours/src/lib/stop-note-actions.ts#addStopNoteAction` (cap: elktours-stop-note-add)
- `sa:apps/elktours/src/lib/stop-note-actions.ts#deleteStopNoteAction` (cap: elktours-stop-note-delete)
- `sa:apps/elktours/src/lib/stop-note-actions.ts#promoteStopNoteAction` (cap: elktours-stop-note-promote)
- `sa:apps/elktours/src/lib/stop-note-actions.ts#updateStopNoteAction`
- `sa:apps/elktours/src/lib/suggest-lead-actions.ts#submitSuggestionAction` (cap: elktours-suggest-lead)
- `sa:apps/elktours/src/lib/suggestion-actions.ts#acceptSuggestionAction` (cap: elktours-suggestion-accept)
- `sa:apps/elktours/src/lib/suggestion-actions.ts#rejectSuggestionAction` (cap: elktours-suggestion-reject)
- `sa:apps/elktours/src/lib/suggestion-actions.ts#suggestRouteAction` (cap: elktours-suggest-route)
- `sa:apps/elktours/src/lib/suggestion-actions.ts#suggestSpotFromPhotoAction` (cap: elktours-suggest-spot-from-photo)
- `sa:apps/elktours/src/lib/suggestion-actions.ts#withdrawSuggestionAction`
- `sa:apps/elktours/src/lib/tour-actions.ts#saveTourAction` (cap: tour-save)
- `sa:apps/elktours/src/lib/tour-actions.ts#setTourPinnedAction` (cap: tour-status-set)
- `sa:apps/elktours/src/lib/tour-actions.ts#setTourStatusAction` (cap: tour-status-set)
- `sa:apps/elktours/src/lib/tour-live-actions.ts#patchTourAction` (cap: tour-save)
- `sa:apps/elktours/src/lib/tour-type-actions.ts#setTourTypeAction` (cap: tour-type-set)

### fourthwayBookreaders

- `api:apps/fourthwayBookreaders/src/app/api/manage/section/route.ts#PUT` (cap: site-section-copy-save)
- `api:apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts#POST` (cap: rsvp-to-event)
- `sa:apps/fourthwayBookreaders/src/lib/circle-actions.ts#setFeaturedGroup` (cap: fourthway-circle-featured-set)
- `sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#addSessionNote` (cap: fourthway-group-sitting-record)
- `sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#createReadingGroup` (cap: fourthway-circle-create)
- `sa:apps/fourthwayBookreaders/src/lib/manage-actions.ts#setGroupPage` (cap: fourthway-group-bookmark-set)

### hidden-enneagram

- `sa:apps/hidden-enneagram/src/lib/cms/actions.ts#saveContentAction` (cap: manage-content-save)
- `sa:apps/hidden-enneagram/src/lib/cms/actions.ts#setContentStatusAction` (cap: manage-content-status-set)
- `sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#savePublishPiece` (cap: writing-piece-save)
- `sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#startPublishPiece` (cap: writing-piece-start)

### ifac

- `api:apps/ifac/src/app/api/hub/profile-sections/route.ts#PATCH` (cap: profile-section-toggle)
- `api:apps/ifac/src/app/api/manage/content/route.ts#POST` (cap: ifac-site-section-save)
- `api:apps/ifac/src/app/api/manage/events/route.ts#POST` (cap: ifac-event-add)
- `api:apps/ifac/src/app/api/signup/route.ts#POST`
- `api:apps/ifac/src/app/api/upload/route.ts#POST` (cap: ifac-image-upload)
- `sa:apps/ifac/src/lib/cms/actions.ts#saveContentAction` (cap: manage-content-save)
- `sa:apps/ifac/src/lib/cms/blog-actions.ts#setBlogStateAction` (cap: profile-blog-set)
- `sa:apps/ifac/src/lib/cms/payout-actions.ts#setProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/ifac/src/lib/showcase-actions.ts#setThreadPinnedAction` (cap: ifac-showcase-pin)

### inner-gathering

- `api:apps/inner-gathering/src/app/api/about-document/route.ts#DELETE`
- `api:apps/inner-gathering/src/app/api/about-document/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/account/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/admin/site-config/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/contact/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/content/[id]/route.ts#DELETE`
- `api:apps/inner-gathering/src/app/api/content/[id]/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/content/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/guestbook/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/inquiries/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/meetings/[id]/attendees/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/meetings/[id]/guides/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/notifications/mark-read/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts#DELETE`
- `api:apps/inner-gathering/src/app/api/org/[orgId]/blog-password/route.ts#PUT`
- `api:apps/inner-gathering/src/app/api/profile/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/threads/[id]/rsvp/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/upload/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/work-question/respond/route.ts#POST`
- `api:apps/inner-gathering/src/app/api/workshops/[id]/join/route.ts#POST` (cap: workshop-join)
- `api:apps/inner-gathering/src/app/api/workshops/[id]/route.ts#PATCH`
- `api:apps/inner-gathering/src/app/api/workshops/route.ts#POST`
- `sa:apps/inner-gathering/src/lib/actions.ts#createMeetingAction`
- `sa:apps/inner-gathering/src/lib/draft-actions.ts#deleteDraftAction`
- `sa:apps/inner-gathering/src/lib/draft-actions.ts#saveDraftAction`

### innergathering

- `api:apps/innergathering/src/app/api/contact/route.ts#POST` (cap: send-org-contact-message)
- `api:apps/innergathering/src/app/api/rsvp/route.ts#POST` (cap: sunjay-rsvp-guest)
- `api:apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts#POST` (cap: ig-rsvp-join)
- `api:apps/innergathering/src/app/api/work-question/route.ts#POST` (cap: ig-question-answer)
- `sa:apps/innergathering/src/lib/cms/actions.ts#saveContentAction` (cap: manage-content-save)
- `sa:apps/innergathering/src/lib/cms/actions.ts#saveSectionAction` (cap: site-section-copy-save)
- `sa:apps/innergathering/src/lib/cms/actions.ts#setContentStatusAction` (cap: manage-content-status-set)
- `sa:apps/innergathering/src/lib/cms/blog-actions.ts#setBlogStateAction` (cap: profile-blog-set)
- `sa:apps/innergathering/src/lib/cms/blog-actions.ts#setProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/innergathering/src/lib/cms/blog-actions.ts#setStoreSectionAction` (cap: profile-section-toggle)

### katie-the-potter

- `api:apps/katie-the-potter/src/app/api/media/upload/route.ts#POST` (cap: sunjay-media-upload)
- `sa:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkSaveAction` (cap: artwork-draft-save)
- `sa:apps/katie-the-potter/src/lib/manage-actions.ts#retireSamplesAction` (cap: katie-samples-retire)
- `sa:apps/katie-the-potter/src/lib/manage-actions.ts#setShownAsAction` (cap: katie-piece-shown-as-set)

### pigeonshoot

- `api:apps/pigeonshoot/src/app/api/cards/route.ts#POST` (cap: pigeon-card-submit)
- `api:apps/pigeonshoot/src/app/api/reports/route.ts#POST` (cap: pigeon-card-report)
- `api:apps/pigeonshoot/src/app/api/upload/route.ts#POST` (cap: pigeon-photo-upload)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#deactivateCriterion` (cap: pigeon-criterion-retire)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#moderateCard` (cap: pigeon-card-moderate)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#promoteProposedSpecies` (cap: pigeon-species-promote)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#rateCard` (cap: pigeon-card-rate)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#resolveReport` (cap: pigeon-report-resolve)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#saveSection` (cap: pigeon-site-copy-save)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#setGuestBlocked` (cap: pigeon-guest-block)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#updateCard`
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#updateSpeciesStatus` (cap: pigeon-species-status)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#upsertCriterion` (cap: pigeon-criterion-save)
- `sa:apps/pigeonshoot/src/lib/manage/actions.ts#upsertTier` (cap: pigeon-tier-save)

### sunjay

- `api:apps/sunjay/src/app/api/inquiry/route.ts#POST` (cap: sunjay-inquiry-send)
- `api:apps/sunjay/src/app/api/rsvp/route.ts#POST` (cap: sunjay-rsvp-guest)
- `api:apps/sunjay/src/app/api/threads/[id]/reminder/route.ts#PATCH` (cap: sunjay-reminder-set)
- `api:apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts#POST` (cap: rsvp-to-event)
- `sa:apps/sunjay/src/lib/account-actions.ts#setOwnProfileSectionAction` (cap: profile-section-toggle)
- `sa:apps/sunjay/src/lib/banner-actions.ts#saveBanner` (cap: site-banner-save)
- `sa:apps/sunjay/src/lib/cms/actions.ts#saveContentAction` (cap: manage-content-save)
- `sa:apps/sunjay/src/lib/cms/actions.ts#saveSectionAction` (cap: site-section-copy-save)
- `sa:apps/sunjay/src/lib/cms/actions.ts#setContentStatusAction` (cap: manage-content-status-set)
- `sa:apps/sunjay/src/lib/puck/event-actions.ts#setDetailPageAction` (cap: gathering-detail-page-set)

## Same export name in 3+ apps (homogenising candidates)

51 server-action names appear in 3 or more apps. Top 40:

| export | apps | where |
|---|--:|---|
| `savePageAction` | 7 | art-auction, danamccool, elktours, hidden-enneagram, innergathering, katie-the-potter, sunjay |
| `createQuestionnaireAction` | 6 | amrit-canada, arts-collective, elktours, ifac, innergathering, sunjay |
| `disconnectPayoutsAction` | 6 | arts-collective, elktours, ifac, innergathering, katie-the-potter, sunjay |
| `saveContentAction` | 6 | amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay |
| `setProfileSectionAction` | 6 | artdirect, arts-collective, elktours, ifac, innergathering, sunjay |
| `sitePostContextAction` | 6 | amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay |
| `sitePostListAction` | 6 | amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay |
| `sitePostLoadAction` | 6 | amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay |
| `sitePostSaveAction` | 6 | amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay |
| `defineTermAction` | 5 | amrit-canada, arts-collective, elktours, fourthwayBookreaders, sunjay |
| `deleteContentAction` | 5 | amrit-canada, elktours, hidden-enneagram, innergathering, sunjay |
| `loadProfilePageAction` | 5 | arts-collective, elktours, ifac, innergathering, sunjay |
| `lookupTermAction` | 5 | amrit-canada, arts-collective, elktours, fourthwayBookreaders, sunjay |
| `setContentStatusAction` | 5 | amrit-canada, elktours, hidden-enneagram, innergathering, sunjay |
| `siteMeetingContextAction` | 5 | amrit-canada, elktours, ifac, innergathering, sunjay |
| `siteMeetingLoadAction` | 5 | amrit-canada, elktours, ifac, innergathering, sunjay |
| `siteMeetingSaveAction` | 5 | amrit-canada, elktours, ifac, innergathering, sunjay |
| `startPayoutsAction` | 5 | arts-collective, elktours, ifac, innergathering, sunjay |
| `saveFeedAction` | 4 | amrit-canada, elktours, innergathering, sunjay |
| `saveGuideProfileAction` | 4 | amrit-canada, elktours, innergathering, sunjay |
| `savePayoutSetupAction` | 4 | art-auction, elktours, katie-the-potter, sunjay |
| `savePieceAction` | 4 | artdirect, danamccool, ifac, katie-the-potter |
| `saveSectionAction` | 4 | amrit-canada, elktours, innergathering, sunjay |
| `saveSiteStyleAction` | 4 | elktours, hidden-enneagram, katie-the-potter, sunjay |
| `setMemberRoleAction` | 4 | amrit-canada, elktours, innergathering, sunjay |
| `setStandingMeetingAction` | 4 | amrit-canada, elktours, innergathering, sunjay |
| `startPieceAction` | 4 | artdirect, danamccool, ifac, innergathering |
| `startStripeOnboardingAction` | 4 | art-auction, elktours, katie-the-potter, sunjay |
| `updateOwnProfileAction` | 4 | amrit-canada, elktours, innergathering, sunjay |
| `bookServiceAction` | 3 | artdirect, elastrocal, sunjay |
| `canChangeOrgPeopleAction` | 3 | arts-collective, ifac, innergathering |
| `checkNewPageAction` | 3 | art-auction, elktours, sunjay |
| `checkSiteAction` | 3 | arts-collective, ifac, innergathering |
| `checkStoreAction` | 3 | arts-collective, ifac, innergathering |
| `createSiteAction` | 3 | arts-collective, ifac, innergathering |
| `deletePieceAction` | 3 | artdirect, danamccool, ifac |
| `listOrgPeopleAction` | 3 | arts-collective, ifac, innergathering |
| `listOwnServicesAction` | 3 | arts-collective, ifac, innergathering |
| `loadJourneyAction` | 3 | arts-collective, ifac, innergathering |
| `loadPieceListingAction` | 3 | artdirect, ifac, innergathering |
