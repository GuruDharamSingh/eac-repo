# Confirm wording, wave 01

Generated from inventory of 2026-11-16. Do not edit; regenerate with `pnpm --filter @elkdonis/actions atlas:reports`.

## How to answer

When the dock helps someone do something on the network, it first shows a small card asking "are you sure?". Below is every card in this batch, so you can check the wording before anyone sees it. Nothing here is live until you approve it.

Each item has a short description, the card text, and one line to answer:

- **Approve:** put an x in "approve" if the card text is right as it is.
- **Change:** put an x in "change to" and write the sentence you want after it.
- Words in {curly braces}, such as {title} or {org}, are filled in with the real name when the card appears. Leave them in.
- The badges tell you how careful the card must be. MONEY cards never run anything: the dock only takes the person to the checkout or Stripe page.
- The style we aimed for: short, plain, "you", say what changes and who will see it. Tell us if a card does not sound like you.

86 cards.

## Channel (social posting) (channel.board)

### 1. Accept a suggested post (accept-channel-suggestion)

Puts a suggested post for a piece on the queue as a draft and adds a step to the piece's plan. Done by any signed-in person, an owner or a guide. You find it at: The Accept button on a suggestion row.

[No special risk]

> **The card will say:** Add a {outlet} post about “{title}” to your queue for {when}? It stays a draft, so nothing is posted yet.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 2. Dismiss a suggestion (dismiss-channel-suggestion)

Records that a suggested outlet for a piece is not wanted, so it stops suggesting itself. Done by any signed-in person, an owner or a guide. You find it at: The Dismiss / Skip for this piece control on a suggestion.

[No special risk]

> **The card will say:** Stop suggesting {outlet} for “{title}”? You can still post there by hand.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Channel (social posting) (channel.plan)

### 3. Start a plan for a piece (start-piece-plan)

Creates the piece's plan (a checklist of steps) if it has none. Done by any signed-in person, an owner or a guide. You find it at: The Start a plan button on a piece with no plan.

[No special risk]

> **The card will say:** Start a plan for “{title}”? It begins as an empty checklist that only you see.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 4. Tick a plan step (tick-plan-step)

Ticks or unticks one step of a piece's plan. Done by any signed-in person, an owner or a guide. You find it at: The tick box beside a step in the plan list.

[No special risk]

> **The card will say:** Mark the step “{name}” of “{title}” as {state}?

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Channel (social posting) (channel.posts)

### 5. Plan or schedule a post for a piece (plan-or-schedule-post)

Saves a post about a piece on an outlet with its text and time, as a draft or as scheduled to go out. Done by any signed-in person, an owner or a guide. You find it at: The quick sheet that opens from a slot or a grid cell; Schedule vs Save draft.

[PUBLIC: others can see the result]

> **The card will say:** Save a {outlet} post about “{title}” for {when}? If you schedule it, it goes out by itself at that time.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.agreements)

### 6. Accept an agreement (accept-agreement)

A member agrees for themselves to an organisation's revenue-share terms. Done by a member. You find it at: The Accept button at the end of AgreementsManager.tsx.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Accept “{title}”? {share}% of your sales through {org} will be shared with it. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 7. Draft a revenue-share agreement (draft-agreement)

An owner writes a new agreement (or a new version) with a share percentage. Done by an owner. You find it at: "New agreement" in components/hub/AgreementsManager.tsx.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Save a draft agreement “{title}” that takes {share}% of sales? Nothing is in force until you publish it. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 8. Publish an agreement (publish-agreement)

Puts a drafted agreement in force so members can accept it. Done by an owner. You find it at: The Publish button on a draft in AgreementsManager.tsx.

[MONEY: the dock only points to the checkout, it never pays or charges] [PUBLIC: others can see the result] [AFFECTS OTHER PEOPLE]

> **The card will say:** Publish “{title}”? Members are asked to accept it, and {share}% of their sales goes to {org}. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 9. Retire an agreement (retire-agreement)

Ends a published agreement for new acceptances. Done by an owner. You find it at: The Retire button on a published agreement in AgreementsManager.tsx.

[MONEY: the dock only points to the checkout, it never pays or charges] [CANNOT BE UNDONE] [AFFECTS OTHER PEOPLE]

> **The card will say:** Retire “{title}”? No one new can accept it, and existing acceptances are kept. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 10. Withdraw my acceptance of an agreement (revoke-agreement-acceptance)

A member withdraws their acceptance. Done by a member. You find it at: The Revoke button in AgreementsManager.tsx.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Withdraw your acceptance of “{title}”? The terms stop applying to you from now on. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.bookings)

### 11. Cancel a booking (cancel-booking)

The seller cancels a booking and tells the buyer; any refund is handled by email. Done by any signed-in person. You find it at: The cancel control on a booking row in app/hub/bookings/page.tsx.

[SENDS EMAIL] [CANNOT BE UNDONE] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Cancel {person}’s booking of “{title}”? They get an email, and any refund is arranged by reply. This cannot be undone. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.content)

### 12. Create a post, event, meeting or workshop (create-content)

Make a new piece of content on an organisation's site, as a draft or published at once. Done by an owner or a guide. You find it at: Create button on the Organization tab; surface compose:{kind}.

[PUBLIC: others can see the result]

> **The card will say:** Create the {kind} “{title}” on {org}’s site? If you publish it now, visitors can see it at once.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 13. Lead the site with a post (lead-site-with-post)

Pins or unpins a published public post so it leads the organisation's site (one at a time). Done by an owner or a guide. You find it at: "Lead the site with this" in the post popup.

[PUBLIC: others can see the result]

> **The card will say:** Change whether “{title}” leads {org}’s site? A leading post replaces whatever leads now.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 14. Publish a draft (publish-draft-post)

Puts a draft post live on the organisation's site. Done by an owner or a guide. You find it at: The Publish button on a draft in the Unfinished band.

[PUBLIC: others can see the result]

> **The card will say:** Publish “{title}” on {org}’s site? Visitors will see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.email)

### 15. Save the organisation's sending name and reply address (save-org-email-identity)

Sets the name mail is sent under, the reply-to, and whether replies come into the org inbox. Done by an owner or a guide. You find it at: The email popup (console tile; EmailSurface from cms-ui/email, Look tab).

[SENDS EMAIL]

> **The card will say:** Send {org}’s mail under the name “{name}”, with replies to {email}? Everyone who gets mail from {org} sees this.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.org)

### 16. Show a post from another site (approve-post-from-other-site)

Lets a post from another network site that asked to show here appear on this site too (owners and guides). Done by an owner or a guide. You find it at: Approve on a request in the Review queue card (packages/hub review ReviewQueue).

[PUBLIC: others can see the result]

> **The card will say:** Show “{title}” from another site on {org}’s site? Visitors to {org} can then read it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 17. Change someone's role in the organisation (change-person-role)

Make a person a viewer, member or guide of an organisation. Done by an owner or a guide. You find it at: Settings > People & roles, or the People band "Roles & removal"; also the Center journey on /learn.

[AFFECTS OTHER PEOPLE]

> **The card will say:** Make {person} a {role} of {org}? This changes what they can do there.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 18. Start an organisation (create-organisation)

Creates an organisation with a name and an address on the network, and makes the person its owner. Done by any signed-in person. You find it at: The tier cards show SetupForm; its Create button posts here.

[PUBLIC: others can see the result]

> **The card will say:** Create {org} at {where}? You will be its owner, and the address goes public once the collective confirms it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 19. Decide a member’s submission (decide-submission)

Lets a member’s post or store panel through, or turns it down (owners and guides). Done by an owner or a guide. You find it at: Approve or Decline on a submission in the Review queue card (review ReviewQueue).

[PUBLIC: others can see the result]

> **The card will say:** Mark “{title}” as {state} on {org}’s site? If it is approved, visitors to {org} can see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 20. Turn down a post from another site (decline-post-from-other-site)

Keeps a post from another network site off this site. Done by an owner or a guide. You find it at: Decline on a request in the Review queue card (review ReviewQueue).

[No special risk]

> **The card will say:** Keep “{title}” off {org}’s site? Its author can ask again.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 21. Dismiss someone who arrived from another site (dismiss-arrival)

Takes an arrival off the arrivals queue without giving a role (owners and guides). Done by an owner or a guide. You find it at: The Dismiss control on the Arrivals tab of the Members card (members ArrivalsTab).

[No special risk]

> **The card will say:** Dismiss {person} from the arrivals list of {org}? They get no role here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 22. List or unlist someone in the organisation's directory (list-person-in-directory)

Show or hide a person on the organisation's public people list. Done by an owner, a guide or a member. You find it at: The listed switch in the People surface.

[PUBLIC: others can see the result]

> **The card will say:** Set {person} to {state} on {org}’s public people list? Visitors can see who is listed.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 23. Remove someone from the organisation (remove-person-from-org)

Takes a person out of an organisation. Done by an owner. You find it at: People surface "Roles & removal"; control not traced to the exact button.

[CANNOT BE UNDONE] [AFFECTS OTHER PEOPLE]

> **The card will say:** Remove {person} from {org}? They lose access to its members area, but their account stays.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 24. Save the organisation's identity (save-org-identity)

Change an organisation's name, line, bio, photo and place as the network shows them. Done by an owner, a guide or a network admin. You find it at: Settings > Identity section, the Save button in components/hub/OrgIdentityPanel.tsx.

[PUBLIC: others can see the result]

> **The card will say:** Save {org}’s identity? Its name, line and bio change on the network and on its site.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 25. Hold members’ submissions for a look (switch-submission-review)

Sets whether members’ posts wait for a look first, and whether members’ store panels are hosted. Done by an owner or a guide. You find it at: The review switches in the Review queue card (review card).

[PUBLIC: others can see the result]

> **The card will say:** Turn the check on members’ {what} {state} for {org}? While it is on, their {what} wait for your look before showing.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 26. Welcome someone who arrived from another site (welcome-arrival)

Gives a signed-in arrival from another network site a role here (owners pick viewer, member or guide; guides welcome as viewer). Done by an owner or a guide. You find it at: The Welcome control on the Arrivals tab of the Members card (members ArrivalsTab).

[AFFECTS OTHER PEOPLE]

> **The card will say:** Welcome {person} to {org} as {role}? They join unlisted and can do what that role allows.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.profile)

### 27. Show a post on other sites (choose-sites-for-post)

Pick which organisations' sites also list one of the person's published posts. Done by any signed-in person. You find it at: The "Where you show" / Show on panel in the profile popup.

[PUBLIC: others can see the result]

> **The card will say:** Show “{title}” on {where}? Visitors to those sites can read it, and some sites check posts first.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 28. Connect or adjust a social account (connect-social-account)

Add an Instagram, Facebook, Threads or YouTube connection, check it, add a page, or set which channel an organisation posts under. Done by any signed-in person, an owner or a guide. You find it at: Connections tab of the profile popup (ConnectionsBand on the Organization tab for orgs). Backed by services connectionsHandlers.

[PUBLIC: others can see the result]

> **The card will say:** Connect {account}? Posts you choose to send can then go out under it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 29. Edit my profile (edit-my-profile)

Change the name, line, bio, place, links, page address and comment colour that the network shows for a person. Done by any signed-in person. You find it at: The profile card on the Network tab opens the profile popup; its Save button (cms-ui surface profile, served by api/center/profile).

[PUBLIC: others can see the result]

> **The card will say:** Save your profile changes? Your name, line and bio update on your public page and in the directory.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Your hub (hub.store)

### 30. Suggest a charity to receive a share of sales (add-charity-beneficiary)

Adds a charity as a possible beneficiary of the organisation's sales. Done by an owner or a network admin. You find it at: The beneficiaries panel in store-panels.tsx.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Add {name} as a possible beneficiary of {org}’s sales? It stays a suggestion until approved. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 31. Add a beneficiary to the organisation’s store (add-org-beneficiary)

Adds an approved beneficiary so a share of the store’s sales goes to them. Done by an owner or a network admin. You find it at: The add control in the beneficiaries panel.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Add {name} as a beneficiary of {org}’s store? A share of its sales goes to them from now on. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 32. Approve a beneficiary (approve-beneficiary)

Marks a suggested charity active so it can receive a share of sales. Done by an owner or a network admin. You find it at: The approve control in the beneficiaries panel.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Approve {name} to receive a share of {org}’s sales? Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 33. Open the organisation's store (open-org-store)

Opens a store on the marketplace owned by the organisation. Done by an owner or a network admin. You find it at: The Open a store button on /hub/store.

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Open a store for {org} on the marketplace? Visitors can then see its work. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 34. Remove a beneficiary from the organisation’s store (remove-org-beneficiary)

Removes a beneficiary so sales no longer go to them. Done by an owner or a network admin. You find it at: The remove control in the beneficiaries panel.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Remove {name} as a beneficiary of {org}’s store? Its sales stop going to them from now on. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Learning (learn.journeys)

### 35. Disconnect payouts (disconnect-payouts)

Disconnects the person's Stripe payout account. Done by any signed-in person. You find it at: The disconnect control on the Payouts tab.

[MONEY: the dock only points to the checkout, it never pays or charges] [CANNOT BE UNDONE]

> **The card will say:** Disconnect your payout account? Sales and bookings cannot be paid out until you set it up again. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 36. Open your store on the market (open-your-store)

Publishes the person's own store on the collective's art marketplace. Done by any signed-in person. You find it at: The Open store step of the sell-your-art journey popup.

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Open your own store on the art market? Buyers can then see your work. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 37. Publish artworks to the market (publish-artworks)

Publishes up to 50 saved artwork drafts so they appear on the marketplace. Done by any signed-in person. You find it at: The Publish button of the artwork step in the sell-your-art journey popup.

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Publish {count} artworks at the prices you set? Visitors to the market can buy them. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 38. Save a service of my own (save-my-service)

Saves a service (title, short text, price, format) on the person's own page; publishing it makes it public. Done by any signed-in person. You find it at: The Offer form in the me popup.

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Save your service “{title}” at {price}? If it is published, visitors can book it. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 39. Publish or hide a service of mine (set-my-service-status)

Switches one of the person's own services between draft and published. Done by any signed-in person. You find it at: The publish / unpublish switch on a service row in the me popup.

[PUBLIC: others can see the result]

> **The card will say:** Set your service “{title}” to {state}? Visitors see it only while it is published.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 40. Set up payouts (start-payouts)

Starts Stripe onboarding so sales and bookings can be paid out to the person. Done by any signed-in person. You find it at: The Set up payouts button on the Payouts tab of the profile popup; it returns a Stripe link.

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Set up payouts? You go to Stripe to confirm your details, and the collective never sees your bank details. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 41. Take your space (take-your-space)

Gives a person a folder of their own, membership of the artist directory and a listing, in one step. Done by any signed-in person. You find it at: The one-button task of the getting-started step.

[PUBLIC: others can see the result]

> **The card will say:** Set up your space? You get a folder of your own, and a public page and listing in the artists’ directory.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## Account and network (network.bookings)

### 42. Confirm a booking time (buyer) (confirm-booking-time-as-buyer)

The buyer opens their private link and picks one of the proposed times. Done by a visitor. You find it at: The time buttons on the buyer’s booking page (app/bookings/[token])

[MONEY: the dock only points to the checkout, it never pays or charges] [AFFECTS OTHER PEOPLE] [SENDS EMAIL]

> **The card will say:** Confirm {when} for “{title}”? {person} is told, and the time is held for you. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The other organisations’ sites (orgapps.artwork)

### 43. Change how an artwork is shown on the site (artwork-display-set)

Sets an artwork as for sale, portfolio-only or hidden on the artist's own site, and may confirm its title. Done by an owner. You find it at: artwork row mode buttons

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Show “{title}” as {state} on {org}’s site? Visitors see the change straight away. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 44. Save an artwork (artwork-draft-save)

Creates or updates an artwork (title, picture, size, price) in the person's marketplace store as a draft; katie's form can publish in the same save. Done by any signed-in person, an owner or a guide. You find it at: artwork journey card, Save piece

[MONEY: the dock only points to the checkout, it never pays or charges] [PUBLIC: others can see the result]

> **The card will say:** Save “{title}” at {price} in {where}? It stays private until you put it on sale. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 45. Put artworks on sale (artwork-journey-publish)

Publishes up to 50 of the person's artworks on the marketplace and returns their links. Done by any signed-in person. You find it at: artwork journey card, Publish

[MONEY: the dock only points to the checkout, it never pays or charges] [PUBLIC: others can see the result]

> **The card will say:** Put {count} artworks on sale on the marketplace? Visitors can buy them. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The other organisations’ sites (orgapps.cms)

### 46. Place or clear the promotion on the Center page (center-promo-save)

Puts a hand-written promotion card (title, blurb, link, image) on the /center page, or clears it. Done by an owner or a guide. You find it at: center promo editor Save

[PUBLIC: others can see the result]

> **The card will say:** Show “{title}” as the promotion on the {org} Center page? Visitors will see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 47. Publish or update a teacher or guide page (guide-profile-save)

Fills in a member's public teacher page: URL slug, display name, role title, bio, photo, city, order and whether it is public. Done by an owner. You find it at: profile editor in components/manage/member-row.tsx

[PUBLIC: others can see the result] [AFFECTS OTHER PEOPLE]

> **The card will say:** Publish {name}'s page at /about/{slug} on {org}'s site? Their name, photo and bio become public, and the name and photo also change on their global profile.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 48. Pin a post to the top of the landing page (manage-content-pin)

Pins or unpins one post at the top of the home page. Done by an owner or a guide. You find it at: Pin button in components/manage/content-row-actions.tsx

[PUBLIC: others can see the result]

> **The card will say:** Pin “{title}” to the top of {org}'s home page?

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 49. Take a post off the site (manage-content-remove)

Archives a post or gathering so it leaves the site. Done by an owner or a guide. You find it at: Remove button (with a confirm) in components/manage/content-row-actions.tsx

[PUBLIC: others can see the result]

> **The card will say:** Take “{title}” off {org}'s site? It is archived, not erased, and you can publish it again.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 50. Write or edit a post, gathering or service in the site manager (manage-content-save)

Creates or updates one piece of content (a post, a dated gathering, or in hidden-enneagram a service offering) from the /manage editor: title, body, which page it lives on, status, audience, and for gatherings the schedule, RSVP rules, attached files, a shared document and a Talk room. Done by an owner, a guide or a member. You find it at: content form, Save / Publish

[PUBLIC: others can see the result] [SENDS EMAIL]

> **The card will say:** Publish “{title}” on the {page} page of {org}? {audience} will be able to read it. Gatherings may notify people on the list.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 51. Publish or unpublish a post (manage-content-status-set)

Switches one post or gathering between draft and published from the row buttons in the content list, without opening the editor. Done by an owner or a guide. You find it at: Publish / Unpublish button in components/manage/content-row-actions.tsx

[PUBLIC: others can see the result]

> **The card will say:** Publish “{title}” on {org}? Everyone who can see that page will see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 52. Change a member's role from the owner console (manage-member-role-set)

Sets a person in the org to viewer, member or guide from the /manage/people table (owners only). Done by an owner. You find it at: role dropdown in components/manage/member-row.tsx

[AFFECTS OTHER PEOPLE]

> **The card will say:** Make {name} a {role} of {org}? This changes what they can see and do on {org}'s site.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 53. Remove a service offering (service-offering-remove)

Takes a service offering off the site (archived) from the services list. Done by an owner or a guide. You find it at: service list delete (kept for the services list)

[PUBLIC: others can see the result]

> **The card will say:** Take the service “{title}” off {org}'s site? It is archived, not erased.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 54. Confirm that an e-Transfer payment arrived (service-order-confirm)

Marks a service order's e-Transfer as received so the buyer's booking is confirmed. Done by an owner or a guide. You find it at: Confirm button in app/manage/orders/confirm-order-button.tsx

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Confirm that {amount} from {buyer} for {service} arrived by e-Transfer? The booking is then confirmed.

Note: money: the dock only links here, never runs it

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 55. Add or edit a site page (name, tagline, visibility) (site-feed-save)

Creates or updates one of the site's pages (feeds): its name, tagline, description, presenter, accent, order and whether it is public. Done by an owner or a guide. You find it at: feed editor Save

[PUBLIC: others can see the result]

> **The card will say:** Save the {page} page of {org} as “{name}”? {visibility}

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 56. Edit a page's wording (site-section-copy-save)

Saves the copy slots of one fixed-layout page (headline, intro and so on) into the site's page-copy table. Done by an owner or a guide. You find it at: section editor Save

[PUBLIC: others can see the result]

> **The card will say:** Update the wording of the {section} page on {org}'s site? Visitors will see the new text.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 57. Choose the gathering the hub leads with (standing-meeting-set)

Flags one gathering (or none) as the standing one the hub puts first, instead of letting the hub guess. Done by an owner or a guide. You find it at: Standing gathering toggle in components/manage/content-row-actions.tsx

[PUBLIC: others can see the result]

> **The card will say:** Make “{title}” the gathering {org}'s hub leads with?

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The other organisations’ sites (orgapps.content)

### 58. Start a new gallery (gallery-create)

Creates a gallery (a titled set of pictures) on the person's page. Done by any signed-in person, an owner or a guide. You find it at: New gallery button in components/galleries-section.tsx

[No special risk]

> **The card will say:** Start a new gallery called “{title}”? It begins private; you choose when it shows.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 59. Delete a gallery (gallery-delete)

Deletes a gallery. Done by any signed-in person, an owner or a guide. You find it at: Delete in gallery-editor.tsx

[CANNOT BE UNDONE] [PUBLIC: others can see the result]

> **The card will say:** Delete the gallery “{title}”? The pictures stay in your files, but the gallery page is gone.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 60. Change a gallery's title, description, page or privacy (gallery-details-save)

Edits a gallery's title and description, whether it is public, which page it is attached to, whether it also shows on IFAC, or its own look. Done by any signed-in person, an owner or a guide. You find it at: inline title and description in the live editor

[PUBLIC: others can see the result]

> **The card will say:** Make the gallery “{title}” {visibility}? Visitors to your page can see public galleries.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 61. Change the pictures in a gallery (gallery-items-save)

Adds, removes, reorders, retitles or links the pictures of a gallery (including artworks from the catalogue in danamccool). Done by any signed-in person, an owner or a guide. You find it at: picture grid editor in components/gallery-editor.tsx

[PUBLIC: others can see the result]

> **The card will say:** Save the changes to the pictures in “{title}”? Visitors see them if the gallery is public.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 62. Reorder my galleries (gallery-reorder)

Saves the order the person's galleries are listed in. Done by an owner or a guide. You find it at: drag to reorder in the galleries panel

[PUBLIC: others can see the result]

> **The card will say:** Save this order for your galleries? Visitors will see them in this order.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 63. Disconnect my payout account (innergathering Center) (payout-disconnect-center)

Disconnects the person's Stripe account and forgets the country. Done by any signed-in person, a member, an owner or a guide. You find it at: Disconnect in the Payouts tab

[MONEY: the dock only points to the checkout, it never pays or charges] [CANNOT BE UNDONE]

> **The card will say:** Disconnect your payout account? You will need to set payouts up again before you can be paid.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 64. Connect Stripe to get paid (innergathering Center) (payout-stripe-start-center)

Begins or resumes Stripe Express onboarding for the signed-in person and returns the Stripe link. Done by any signed-in person, a member, an owner or a guide. You find it at: Payouts tab of the profile pop-up (first tab of the Center)

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Take you to Stripe to set up payouts for {email}? You choose the country there.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 65. Turn my blog on or off (profile-blog-set)

Switches the Writing shelf on or off on the member's own page, and remembers whether it shows only pieces written here or everything they have written on the network. Done by a member, an owner or a guide. You find it at: Page sections card in the profile surface (hub); href goes to /artists|/dealers/<slug>/writing

[PUBLIC: others can see the result]

> **The card will say:** Show a Writing shelf with your pieces on your page at {org}? Anyone can see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 66. Show or hide a section on my page (profile-section-toggle-more)

Flips one optional section (writing shelf, available work, feed) on or off on the member's own page. Done by a member, an owner or a guide. You find it at: Page sections panel in the profile surface

[PUBLIC: others can see the result]

> **The card will say:** Show the {section} section on your page? Anyone who visits your page will see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The other organisations’ sites (orgapps.editing)

### 67. Turn the designed page on for a gathering (gathering-detail-page-set)

Switches a gathering's designed detail page on or off, and makes its Talk room when it is turned on. Done by an owner or a guide. You find it at: Detail page toggle in the gathering editor

[PUBLIC: others can see the result]

> **The card will say:** Give “{title}” its own designed page? Visitors will see it, and a Talk room is made if none exists.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 68. Create a Talk room for a gathering (gathering-talk-room-create)

Makes a Nextcloud Talk room for a gathering that has none. Done by an owner or a guide. You find it at: Create room button in the gathering editor

[PUBLIC: others can see the result]

> **The card will say:** Create a Talk room for “{title}”? Anyone with the link can join.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 69. Change the hub's look (hub-skin-save)

Chooses the visual skin of the members' hub. Done by an owner or a guide. You find it at: skin picker on the appearance page

[PUBLIC: others can see the result]

> **The card will say:** Change the look of {org}'s hub to {skin}? Everyone who uses the hub will see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 70. Put the home page back as it was written in code (landing-restore)

Deletes the saved home page tree so the site shows the original code-written home page again. Done by an owner or a guide. You find it at: Restore original in the direct-edit menu

[CANNOT BE UNDONE] [PUBLIC: others can see the result]

> **The card will say:** Throw away your designed home page for {org} and show the original again? Your design cannot be brought back.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 71. Publish the home page tree (landing-save)

Saves the home page as a designed tree from the canvas, instead of the version written in code. Done by an owner or a guide. You find it at: Publish on the home page in direct-edit

[PUBLIC: others can see the result]

> **The card will say:** Publish your changes to {org}'s home page? Visitors will see them straight away.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 72. Publish a phone page design (mobile-page-save)

Saves one of ElkTours' phone page documents (home, tours and so on) from the phone studio. Done by an owner or a guide. You find it at: Publish in the phone studio

[PUBLIC: others can see the result]

> **The card will say:** Publish your changes to the {name} phone page of {org}? Phone visitors will see them.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 73. Save edits to the home page text (page-edits-save)

Saves the patches (changed text and images) laid over the home page's fixed layout. Done by an owner or a guide. You find it at: Save in the page-edits direct editor

[PUBLIC: others can see the result]

> **The card will say:** Save your changes to the wording on {org}'s home page? Visitors will see them.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 74. Publish a page from the visual editor (page-save)

Saves the page the person has been editing on the canvas (blocks, layout, words) so visitors see it at its address. Done by an owner or a guide. You find it at: Publish in the direct-edit canvas (lib/puck editor; /manage/builder lists pages)

[PUBLIC: others can see the result]

> **The card will say:** Publish your changes to the {slug} page on {org}? Visitors will see the new version straight away.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 75. Edit my bio or photo on my page (profile-field-save)

Saves the bio text or profile photo of an artist page from the live editor. Done by any signed-in person or an owner. You find it at: bio in the profile editor panel

[PUBLIC: others can see the result]

> **The card will say:** Update your {what} on your public page? Anyone can see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 76. Arrange the pictures on my page (profile-portfolio-save)

Saves the picture wall (portfolio) on an artist's page. Done by any signed-in person or an owner. You find it at: components/gallery-panel.tsx

[PUBLIC: others can see the result]

> **The card will say:** Save this arrangement of pictures on your page? Visitors will see it.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The other organisations’ sites (orgapps.journeys)

### 77. Open my store on the marketplace (auction-store-publish)

One-click step of the Center's auction journey: publishes the signed-in person's store on the art marketplace. Done by any signed-in person. You find it at: auction journey card, Open store step

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Open your own store on the marketplace? Your published artworks can then be sold there. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The other organisations’ sites (orgapps.money)

### 78. Save one of my services (own-service-save)

Creates or updates a service the signed-in person offers (title, price in CAD, format), published to the network when set to published. Done by any signed-in person. You find it at: My services tab, Save

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Save your service “{title}” at {price}? If it is published, visitors can see it. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 79. Disconnect my payout account (payout-disconnect)

Disconnects the person's Stripe account and forgets the country, the only way out of an account created under the wrong country. Done by any signed-in person, an owner or a guide. You find it at: Disconnect in the Payouts tab

[MONEY: the dock only points to the checkout, it never pays or charges] [CANNOT BE UNDONE]

> **The card will say:** Disconnect your payout account? You need to set it up again before you can be paid. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 80. Save where I get paid (country and payout method) (payout-setup-save)

Saves the signed-in person's country and payout rail (Interac e-Transfer, Stripe or manual) and, for e-Transfer, the email to send to. Done by any signed-in person, an owner or a guide. You find it at: PayoutSetup form

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Save your payout details? Payments from {org} will go to {where}. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 81. Connect Stripe to get paid (payout-stripe-start)

Begins or resumes Stripe Express onboarding for the signed-in person and sends the browser to Stripe. Done by any signed-in person, an owner or a guide. You find it at: Payouts tab of the profile pop-up

[MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Set up payouts at Stripe for {email}? You choose the country there, and it cannot be changed without disconnecting. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The Studio (studio.meetings)

### 82. Save or publish a meeting (save-meeting)

Saves a meeting (a gathering with time, place or link) as a draft or publishes it on the organisation's site. Done by an owner or a guide. You find it at: The Meeting kind in the Studio create canvas.

[PUBLIC: others can see the result]

> **The card will say:** Save the meeting “{title}” for {org}? If it is published, visitors can see it and RSVP.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The Studio (studio.offerings)

### 83. Save or publish an artwork (save-artwork)

Saves an artwork with photos, price and availability in the marketplace store; publishes it when asked. Done by any signed-in person. You find it at: The Artwork form in the Studio create canvas.

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Save “{title}” at {price} in your store? If you publish it, visitors can buy it. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 84. Publish a service (save-service-offering)

Saves an offering (lesson, commission, reading...) from the Studio form; published offerings show on the organisation's site. Done by an owner or a guide. You find it at: The Service form in the Studio create canvas.

[PUBLIC: others can see the result] [MONEY: the dock only points to the checkout, it never pays or charges]

> **The card will say:** Save the service “{title}” at {price} for {org}? If it is published, visitors can book it. Payments happen on the checkout or Stripe page, not here.

**Answer:**  [ ] approve   [ ] change to: ______________________________

## The Studio (studio.writing)

### 85. Save or publish a piece of writing (save-writing-piece)

Saves the text, cover, series, byline and status of a piece; setting its status to published puts it live. Done by any signed-in person. You find it at: Autosave, and the Published / Drafts switch in packages/studio/src/writing/WritingEditor.tsx.

[PUBLIC: others can see the result]

> **The card will say:** Save “{title}”? If it is set to published, anyone can read it on your page.

**Answer:**  [ ] approve   [ ] change to: ______________________________

### 86. Start a piece of writing (start-writing-piece)

Creates a new draft piece in the Studio, on the person's blog or one organisation they belong to. Done by any signed-in person, a member, a guide or an owner. You find it at: The new piece control in the Studio shell.

[No special risk]

> **The card will say:** Start a draft called “{title}” on {where}? Only you can see it until you publish.

**Answer:**  [ ] approve   [ ] change to: ______________________________
