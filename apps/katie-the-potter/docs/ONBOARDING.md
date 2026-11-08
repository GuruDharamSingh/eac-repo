# Onboarding Katie (2026-11-07)

Two parts. The first is for Justin. The second is written for Katie and can be
sent to her as it is.

A full dress rehearsal ran on 2026-11-06 with a throwaway account. It covered
the hand-over link, sign-in, the claim, adding a piece (draft, then on sale),
editing the price, taking it off sale, phone width and payouts. Everything was
put back afterwards. See the dated entry in `docs/PATCH_NOTES.md`.

---

## For Justin

### Before you send anything: fix the sign-up button (needs you)

The site's "Create account" form uses Cloudflare Turnstile, and the Turnstile
widget is **not set up for `pottery.arts-collective.com`**. The widget shows
"Unable to connect to website" (error 110200, *domain not allowed*), and the
**Join the Collective** button stays greyed out. As things stand, nobody can
create an account on her site. Signing in to an existing account works.

Do one of these:

- **Best (1 minute):** Cloudflare dashboard → Turnstile → the widget whose
  site key the network uses → Hostname management → add
  `pottery.arts-collective.com`. No rebuild needed. Reload
  `https://pottery.arts-collective.com/login?mode=signup` and check that the
  box turns into a green tick and the button lights up.
- **Or:** turn Turnstile off for this site only, which needs a rebuild. The
  server has no `TURNSTILE_SECRET_KEY`, so the token was never checked anyway.
  An agent was not allowed to do this without your OK.
- **Fallback on the day:** create her account yourself (GoTrue admin, as in
  `scripts/seed-katie.md`), tell her the password, and she uses **Sign in**
  instead of Create account.

### Tomorrow, step by step

1. Sign in at `https://pottery.arts-collective.com/manage` as **Guru Dharam
   Singh** (gurudharamsingh@gmail.com). That account is an owner of the site,
   so it can make the link. The placeholder account can as well.
2. Open **People** → **Hand the shop to its owner** → **Create a hand-over
   link** → **Copy link**. The link is shown only once. It works once and
   lasts 7 days. Making a new link stops the old one.
3. Send her the link together with the "For Katie" part below.
4. What she sees: the link takes her to the sign-up form. She creates her
   account (or signs in) and comes back to "Claim Katie the Potter". She
   presses **Yes, make me the owner** and lands on the Manage overview, which
   says "Welcome. The shop is yours now."
5. Afterwards, check:
   - **People**: she is Owner, you are still Owner, and
     katie@katiethepotter.example is Viewer.
   - Open `/` while signed out: the pieces still show.
   - Her **Overview** has an "Add a piece" button and no "picture folder"
     warning. If the warning shows, have her press **Finish setting up your
     picture folder**.
   - She has set up **Payouts**. Until she has, eTransfer checkout cannot
     tell buyers where to send money. Card sales still go through, and her
     share is held.
   - Her name on Collect Art (`market.arts-collective.com/artworks/<id>`) is
     the name she typed at sign-up. If it shows an email address, she can fix
     it in her profile.

### Status on 2026-11-07 (morning check)

- **Sign-up is still blocked.** Checked in a fresh browser at 10:45 EST:
  the widget still answers **110200** and **Join the Collective** stays
  greyed out. The site key the page serves is the one in `.env` (same
  hash as the container's), so this is the Cloudflare widget's hostname
  list, not a rebuild. Add `pottery.arts-collective.com` under Hostname
  management, or use the fallback above. Also: the katie service passes
  `TURNSTILE_SECRET_KEY`, but `.env` only has
  `TURNSTILE_SECRET_KEY_PENDING`, so the server does not check tokens yet.
- **Shipping is quote-only and switched Off** (changed the evening of
  2026-11-07, your "keep it quote only for now"). The collective buys no
  labels and the Easyship account needs no funding: it only gives quotes.
  Buyers choose a carrier after paying and pay **Katie** for shipping in a
  second card page (straight to her Stripe account once she has connected
  it under Payouts, otherwise held for her in the ledger like her sales);
  she buys the label herself and types in the tracking. Nothing changes
  for buyers until Katie (the shop's owner) switches /manage/shipping to
  **On**: her steps are "For Katie", step 7. Rebuild art-auction at a quiet
  moment so the network's Stripe webhook also records shipping payments
  (katie's own return hop already does).

### What changed tonight (so you know what to expect)

- The site now follows its **store**, not "the first owner". The store is
  pinned in `site_config` (`shop:store`), and the artist is whoever owns that
  store. After the claim that is Katie, even though you stay an owner.
- Her picture folder is created right after the claim. If that step fails,
  her first upload creates it.
- Order emails are on. Buyers get their invoice or receipt, and Katie gets a
  "new order" email at her sign-up address.
- On /manage the "Site style" button no longer floats over things. It is
  still on every public page.

---

## For Katie

Hi Katie! Everything you need to run your shop is at
**pottery.arts-collective.com/manage**. Here's how to get going.

### 1. Make it yours

1. Open the link Justin sent you.
2. Choose **Create account**. Type your name the way you want buyers to see
   it, your email and a password, then press **Join the Collective**. (If
   you already have an Arts Collective account, choose **Sign in**.)
3. You'll see "Claim Katie the Potter". Press **Yes, make me the owner**.
4. You're in! You land on your **Overview** page. Bookmark it.

### 2. Set up how you get paid (do this first)

Go to **Payouts**. Choose **Canada**, then pick one:
- **Interac e-Transfer**: type the email you want to be paid at and press
  **Save**. That's all.
- **Connect a Stripe account**: card sales are paid to you automatically.
  It takes a few minutes and asks for your bank details.

### 3. Add a piece

Go to **Pieces** → **Add a piece** (it works on your phone too).

- **Title**, a few words in **Description** (how it was made, how to use it,
  how to care for it), **Medium** and **Glaze**.
- **Size** in cm and the **Price**. If you leave the price empty, it shows as
  "Price on request".
- **Pictures:** tap the box to add photos. You can add up to 12.
  - Shoot in daylight, near a window, not in direct sun.
  - Use a plain background, like a sheet of paper or a bare wall.
  - Take several angles: front, side, the inside, the foot, a detail of the
    glaze.
  - **The first picture is the cover.** Drag the pictures to reorder them, or
    press **Set cover** on one.
  - On an iPhone, add photos straight from your Photos. If a photo says
    "HEIC photo: please send a JPEG", go to Settings → Camera → Formats and
    choose **Most Compatible**, then take the photo again. Photos up to 25 MB
    are fine.

Then choose:
- **Save draft**: only you can see it. Come back to it any time.
- **Save and put on sale**: it appears on your site and on Collect Art
  straight away, ready to buy.

To change a piece later, open it from **Pieces**, change it, and press
**Save changes**. To take one off sale, press **Hidden** next to it. Press
**For sale** to put it back. **Picture only** shows it without a price.

### 4. Retire the sample pots

The site came with six sample pots so it wasn't empty. Once a few of your own
pieces are on sale, go to **Pieces** and press **Retire all … samples**, then
**OK**. They leave the site. The two marked Reserved and Sold stay in your
records.

### 5. Pick a card look

On any page of your public site (not in Manage), press **Site style** at the
bottom left. Under **Shop** → **Card look**, try the looks, then press
**Save**. You can also change colours, fonts and corners there.

### 6. When an order comes in

You'll get an email, and it shows under **Orders** (the Overview shows the
count too).
- **Paid by eTransfer:** wait until the money is in your bank, then press
  **Confirm eTransfer received** on the order.
- **Paid by card:** it's already paid.
- Pack it, send it, then press **Mark shipped**.
- If a buyer doesn't pay, press **Cancel**. The piece goes back on sale.

### 7. Shipping quotes (when you're ready)

Today you arrange shipping with each buyer by email. When you'd like buyers
to choose a carrier from live quotes and pay you for shipping:

1. **Weigh your pieces** (a kitchen scale is fine; the piece itself, no
   box) and add the **Weight (kg)** on each piece's page, next to the size.
2. Go to **Shipping**. Fill in **Ship from**: your name (up to 22
   characters), your studio name, the address you ship from, a phone and an
   email. Press **Save**.
3. Check **Packing**: 4 cm of padding on each side and 0.6 kg for the box
   are the starting values. Change them if your boxes are different.
4. **Insurance**: "I'll insure parcels" is ticked to start, so every quote
   includes insurance for the piece's price (you add it when you buy the
   label). Untick it if you won't insure, or tick "Let buyers choose" to
   give them a tick box. Press **Save insurance**.
5. **Try it**: pick a piece and an example address and press **Try it**.
   You see what a buyer would be offered. (Your address is now "checked".)
   You can also press **Test** first: only you see Choose shipping then,
   with sample prices and no payment.
6. Switch **Shipping quotes** to **On**.

From then on, once a buyer has paid for a piece, their order page says
**Choose shipping**. They pick a carrier and pay for shipping on a second
card page. That money is yours: it goes straight to your Stripe account if
you connected one under Payouts, otherwise the collective holds it for you
with your sales. You get an email, **Ship this order**, and under **Orders**
a card with the carrier and service they chose, the address and the box
size and weight.

1. **Buy that label yourself**: in your own Easyship account
   (app.easyship.com), on the carrier's website, or at the post office
   counter. Same carrier and service, and insure it if the card says so.
2. Pack it, tape the label on, drop it off.
3. On the order's card type the **carrier** and the **tracking number** and
   press **Mark shipped**. The buyer gets the tracking by email.

The label may cost a little more or less than the buyer's quote. Small
differences are yours; buyers are never charged again.

While shipping is on (Test or On), a piece can only be put on sale once it
has its height, width and weight.

### If something goes wrong

1. Something won't save: wait a minute and try again. Nothing you do is lost
   by trying twice.
2. "Join the Collective" stays greyed out, or the link says it has been used
   or has expired: ask Justin for a new link.
3. A photo won't upload: read the message on the picture. Usually the photo
   is too big or in iPhone format (see step 3).
4. A piece or order looks wrong: don't delete anything. Take a screenshot.
5. For anything else, contact **Justin**, the collective's site manager. He
   can see everything you see.
