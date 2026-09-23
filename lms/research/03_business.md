# LMS research 03 — Business models, money, law, go-to-market (2026-09-18)

Research only. No code, schema or database was touched.

**Legend:** **[V]** verified today at a cited source or in the repo · **[S]** secondary/vendor-blog source, treat as indicative · **[O]** my opinion or assumption · **[$]** ask an accountant · **[L]** ask a lawyer.
Web search was US-routed; Canadian figures come from canada.ca / priv.gc.ca / CRTC / law-firm pages where cited. Nothing here is legal or tax advice.

**Repo facts this builds on [V]:** money model = maker is payee, store is a front, org cut needs an accepted agreement, append-only ledger (migrations 096-098); `marketplace_artists.commission_rate` defaults to **30.00**; order lines split two-way only (`artist_share_minor` / `gallery_share_minor`); `packages/payments` has eTransfer live and Stripe stubbed, no keys, no Stripe columns in schema; org tiers are **`free | supported | partner`** (migration 082); SendGrid key is a placeholder — nothing sends; paid `workshop_join_requests` already exist.

---

## 1. Business models

### 1.1 Menu (what each is good for)

| Model | Works when | Watch out | Fit for Elkdonis [O] |
|---|---|---|---|
| **Free / open** | Top of funnel, mission content, intro modules | Completion ~3-6% on open MOOCs [V §2] | Yes — first module of every path free |
| **Dana (donation after/alongside)** | Contemplative norm; teaching is "priceless", gift supports teacher | Yields are small: reported ~$5-6/person for a day sitting, $1-2 for an evening group; a full-time retreat teacher ~$8-12k/yr from dana [V, Inquiring Mind]. Not a receipt-able gift unless a registered charity [§4] | Yes as an *add-on* ("offer dana to the teacher"), not as the only revenue line |
| **Sliding scale (3 named tiers)** | Community with mixed means; trust culture | Needs a stated "true cost" anchor or everyone picks the bottom [O]. Some coaches advise against PWYC for solo practitioners [S, George Kao] | **Default for paid cohorts**: Supported / Standard / Sustainer |
| **Pay-what-you-can (open amount, floor ≥ 0)** | Small self-paced items, recordings | Unpredictable; processor min fees eat tiny payments | OK for recordings; set a suggested amount |
| **One-off purchase** | Self-paced evergreen course | Low completion, no recurring revenue | Secondary |
| **Cohort tuition** | Live, dated, facilitated; the high-value product | Teacher time doesn't scale; refunds matter | **Flagship model.** Cohort = workshop thread already [V repo] |
| **Membership / all-access** | Catalogue ≥ ~10 courses, steady new content | Royalty-pool maths punishes small teachers (Skillshare/Udemy, §1.2) | Year 2+. Don't launch with 1-3 courses |
| **Bundles / paths** | Curriculum with sequence (Elkdonis Path) | Accounting: allocate bundle revenue per course/teacher up front | Yes once ≥3 courses; record allocation in the ledger |
| **Scholarships** | Always | Fund source must be explicit | Yes — funded by Sustainer tier + sponsor-a-seat |
| **Gift / sponsor-a-seat** | Communities with patrons | Buyer ≠ learner: consent + CASL for the recipient email | Yes, cheap to build on the order line |
| **B2B / org licence (seats)** | Member orgs buying for their members | Invoicing, GST, seat management | Later; the PaaS tiers (§3) are the nearer version |

Reference price bands [S, BuddyBoss/industry blogs]: self-paced US$100-500; live cohort US$800-2,500; "average course" ~$182 is a meaningless mean. Contemplative/community cohorts sit well below the professional-skills band [O].

### 1.2 Platform ↔ teacher revenue-share norms

| Platform | Teacher keeps | Notes |
|---|---|---|
| **Udemy** | 37% of organic marketplace sales; 97% on instructor-coupon sales; subscription pool cut **25% → 20% (2024) → 17.5% (2025) → 15% (Jan 2026)** | [V] [Udemy announcement](https://teach.udemy.com/enabling-investment-subscription-terms-update/), [Class Central](https://www.classcentral.com/report/udemy-broken-promise-instructor-payouts/). Cautionary tale: unilateral cuts. |
| **Skillshare** | Share of a pool ≈ **30% of membership revenue**, by paid minutes watched; from 2026 needs ≥50 followers to be paid | [V] [Skillshare help](https://help.skillshare.com/hc/en-us/articles/41694886825229-Skillshare-Teacher-Earnings-Update-Effective-January-1-2026); ~$0.05-0.10/min [S] |
| **Insight Timer** | **100% of donations** (minus Apple's 30% on iOS); **50% of subscription revenue** shared by plays, 25-30% of that via a "return rate" fund | [V] [Insight Timer help](https://help.insighttimer.com/support/solutions/articles/67000664874-how-can-teachers-earn-revenue-from-their-work-), [TechCrunch](https://techcrunch.com/2024/02/21/in-a-reversal-apple-is-now-demanding-30-of-the-donations-to-meditation-app-insight-timers-teachers/) |
| **Maven** (cohorts) | **90%** (10% platform fee) + card fees | [S] several reviews; comparators quoted: Reforge keeps 50%, Uplimit 70% |
| **Teachable** | 92.5% on Starter (7.5% fee) → 100% on higher plans, plus US$39-139+/mo SaaS | [S] [Ruzuku](https://www.ruzuku.com/compare/teachable-pricing) |
| **Kajabi** | 100% (0% fee), high flat SaaS fee | [S] |
| **Podia** | 95% on basic (5% fee), 100% above | [S] |
| **Skool / Gumroad** | ~90% (10%) | [S] [Ruzuku fee comparison](https://www.ruzuku.com/learn/articles/platform-transaction-fees) |
| **Domestika** | Undisclosed; produces courses in-house, pays royalties | [V that it's confidential] [Whop](https://whop.com/blog/skillshare-domestika/) |

**Pattern [O]:** the split tracks *who brings the learner and who does the production*. Marketplace-brings-audience = platform keeps 50-85%. Teacher-brings-audience SaaS = platform keeps 0-10% + a flat fee.

**What's fair for a collective [O]:**
- The existing **30% default commission is a gallery norm, not a teaching-platform norm**. For a teacher who brings their own students to a tool, 30% reads as Udemy-ish. Recommend a course-specific default rather than inheriting the store rate.
- Suggested ladder: **teacher-sourced enrolment 90/10** (Maven parity; 10% covers card fees ~3% + infra + scholarship fund) · **collective-sourced enrolment (network feed, newsletter, Path bundle) 75/25** · **collective-produced course (Elkdonis staff film/edit/facilitate) 50/50 or a fee + royalty**. **Dana: 100% to teacher minus processor cost**, stated plainly (Insight Timer precedent).
- Publish the split, put it in the accepted agreement (already required by the money model [V]), and commit to **≥90 days' notice and no retroactive change** — the Udemy sequence is precisely what a collective should promise not to do.
- A curator/referrer share has nowhere to go today — the split is two-way [V, COMMERCE_HANDOVER §1]. "Collective-sourced" above needs that third leg or a simple attribution flag on the order line.

---

## 2. Pricing, completion, retention, earnings

| Finding | Number | Confidence |
|---|---|---|
| Open MOOC completion (HarvardX/MITx, all participants) | 3.1% (2017-18), down from ~6% (2014-15) | [V] Reich & Ruipérez-Valiente, *Science* 2019 — [MIT post-print](https://dspace.mit.edu/bitstream/handle/1721.1/136215/post_print-MOOC_Pivot.pdf), [IHE](https://www.insidehighered.com/digital-learning/article/2019/01/16/study-offers-data-show-moocs-didnt-achieve-their-goals) |
| Same courses, **paying "verified" learners** | 46% (2017-18), 56% earlier | [V] same. Paying ≈ 10× completion — but self-selection, not causation |
| Cohort vs open self-paced on one SaaS platform | 53.4% vs 41.9% | [S] [Ruzuku own data](https://www.ruzuku.com/learn/articles/cohort-vs-self-paced) |
| "Cohorts get 85-96%" | Self-reported by platforms; no independent head-to-head | [V that it is unverified] [critique](https://aienablement.academy/insights/cohort-completion-rates-honest) |
| Large-marketplace self-paced | ~12-15% | [S] |
| Drivers that replicate | deadlines, live contact, peers/community, shorter length, money down | [S/O] consistent across sources |
| Median creator income | ~US$3k/yr; >50% under $5k; ~4% over $100k; Gumroad median ~$72/mo | [S] [archive.com roundup](https://archive.com/blog/creator-economy-income-statistics), [Ruzuku](https://www.ruzuku.com/learn/articles/make-money-selling-courses) |
| Kajabi "average creator ~$37k/yr" | mean, survivor-biased | [S] |

**Cohort vs self-paced economics [O]:** cohort = high price × small N × teacher hours each run (linear cost, strong completion, strong community — which is the collective's actual product). Self-paced = low price × needs traffic the network doesn't have yet. Sensible sequence: run it live → record → sell the recording self-paced cheaply/dana → re-run live annually. One cohort of 15 at CA$250 average = CA$3,750 gross; be honest with teachers that this is supplementary income.

**Refund norms:** Maven: full refund until the course midpoint (<4 wks) or end of week 2 (≥4 wks); workshops until start [V] [Maven guarantee](https://help.maven.com/en/articles/8705540-maven-s-satisfaction-guarantee). Self-paced industry habit: 14-30 days, sometimes capped by % consumed [S/O]. Recommend: cohort — full refund to end of week 2 or midpoint; self-paced — 14 days if <30% consumed; dana — non-refundable except error. Because the maker is the payee, **hold payout until the refund window closes** (the ledger needs a `pending → available` state) [O]. Provincial consumer-protection rules for distance/internet contracts may add cancellation rights [L].

**Metrics honesty [O]:** for contemplative material, "completion" is a weak proxy. Track *practice continuity* (returned in week 4, reflections written) alongside it.

---

## 3. LMS as a service to member orgs (tier gating)

Market reference [S, [Ruzuku](https://www.ruzuku.com/compare/teachable-pricing)/[Thinkific](https://www.ruzuku.com/compare/thinkific-pricing)]: Teachable gates **products + students** (1/100 → 5/1,000 → 50/5,000), custom domain and **certificates** (US$139 tier); Thinkific gives unlimited courses on all paid plans but gates certificates, quizzes, live cohorts, memberships one tier up and charges 1-5% to use your own Stripe.

Proposed mapping onto existing `organizations.tier` [O] — do not invent a fourth vocabulary (memory: exactly two vocabularies, role and tier; `TIER_QUOTAS` keys already match neither):

| | `free` | `supported` | `partner` |
|---|---|---|---|
| Published courses | 1-2 | ~10 | unlimited |
| Active learners / course | ~50 | ~500 | unlimited (fair use) |
| Free + dana courses | yes | yes | yes |
| **Paid** courses | after agreement accepted; higher platform % | yes | yes; negotiated % |
| Media storage (Nextcloud) | small quota | larger | negotiated |
| Hosted video minutes (if CDN, §5) | none / link-out | capped | capped higher |
| Custom domain | no (subdomain) | yes | yes |
| Certificates / Open Badges | collective-branded | own branding | own branding + issuer profile |
| Cohort tooling (Talk room, rota, reminders) | yes | yes | yes |
| Listing in network catalogue / Path bundles | by curation, not tier | same | same |
| Co-teachers / assistants | 1 | several | unlimited |
| Analytics | basic | full + export | full + export |

**Never gate [O, strongly held]:**
1. **Export** — learner roster (with consent), course content, a teacher's own media, earnings ledger. Portability is the trust asset (§6).
2. **Learner's access to their own data** — reflections, progress, certificates; download and delete.
3. **Accessibility** — captions, transcripts, keyboard nav, contrast.
4. **Safety** — reporting, blocking, moderation tools, safeguarding notices.
5. **Privacy/security** — private reflections, unsubscribe, breach handling.
6. **Refunds and honest receipts.**
7. **Free and dana offerings** — a tradition that teaches freely must be able to on the free tier.
8. **The learner count on a free course** in a way that locks out people mid-course (cap new enrolments, never eject).

Gate *scale, branding and hand-holding*; never gate *dignity, safety or exit*.

---

## 4. Canadian specifics — all of this section is [$]/[L] before money moves

### 4.1 GST/HST
- **Small supplier:** no registration needed under CA$30,000 taxable supplies in a quarter / four quarters; **CA$50,000 for a public service body (includes non-profit organizations and charities)**; charities also have a $250k gross-revenue test [V] [CRA RC4022](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html), [CRA small suppliers](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/2-2/small-suppliers.html). Whether EAC *is* an NPO "public service body" for this purpose depends on its actual legal form **[$]** — the brief says "not-for-profit-style"; if it is unincorporated or a sole proprietorship the number is $30k.
- **Are courses taxable?** The education exemptions (Excise Tax Act Sch. V Pt III) attach to *who supplies* — school authorities, universities, public colleges, **vocational schools** (courses leading to a certificate attesting competence in a trade/vocation) — not to "education" in general [V] [CRA Memorandum 20-4](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/20-4/vocational-schools-courses.html). A contemplative/arts course from a collective is **most likely a taxable supply** [O]; pre-recorded content is commonly treated as a taxable digital product [S]. **[$]** get a ruling-grade answer before registering.
- **Whose threshold?** If the maker is the payee and the supplier, each teacher has their own $30k threshold and most will be small suppliers charging no tax. If the platform is the merchant of record for everything, **all course sales count toward the platform's threshold** — and Stripe's own Canada marketplace guide notes third-party sales can count toward a platform operator's threshold [V] [Stripe guide](https://stripe.com/guides/understanding-the-tax-obligations-of-marketplaces-in-canada). Canada's deemed-supplier "distribution platform operator" rules (since July 2021) mainly target sales by *non-registered* vendors of goods/digital services facilitated by platforms [S]; whether they bite on a domestic course collective is **[$]**. This is the strongest tax argument for per-teacher connected accounts.
- **Place of supply:** rate follows the *learner's* province (5% GST to 15% HST) for intangible/digital supplies [S] **[$]**. Collect learner province at checkout from day one; tax-inclusive sliding-scale prices are simpler for learners. Quebec QST is separate **[$]**. Foreign learners: generally zero-rated/out of scope, but EU/UK VAT on digital services has no threshold for B2C **[$]** — low priority at this scale [O].

### 4.2 Not-for-profit vs charity
- An ITA **149(1)(l) NPO** must be organized and operated exclusively for a purpose *other than profit*, with no income available to members. **Intentional, sustained profit from course sales is the classic way to lose the exemption**; cost-recovery pricing with incidental surplus is the safe posture [V general rule] [TaxPage profit-purpose test](https://taxpage.com/articles-and-tips/when-can-a-non-profit-organization-turn-a-profit-the-profit-purpose-test-for-non-profit-organizations-tax-exempt-status-under-the-canadian-income-tax-act/) **[$][L]**.
- **Only registered charities issue official donation receipts.** An NPO cannot [V] [Charity Law Group](https://www.charitylawgroup.ca/charity-law-questions/what-are-the-fundraising-guidelines-for-nonprofit-organizations-in-canada). So: **never call a dana receipt a "tax receipt"**; label it "acknowledgement of gift — not an official receipt for income tax purposes". Dana paid *to a teacher* is that teacher's income [O] **[$]**. Dana given in exchange for access is a payment, not a gift, even for a charity (split-receipting rules) **[$]**.
- "Advancement of education" and "advancement of religion" are charitable heads; registering is a multi-month legal project with constraints on paying directors/related teachers **[L]** — not year one [O].
- **New NPO reporting:** Budget 2025 / 2026 draft legislation expands filing — full T1044 above a gross-revenue threshold (proposed $50k, **recalibrated to $100k** in later drafts) and a new short-form return below it; latest drafts apply to fiscal years beginning on/after **1 Jan 2027** — still draft [V] [Miller Thomson](https://www.millerthomson.com/en/insights/social-impact/npo-reporting-rules-recalibrated-what-all-organizations-need-to-know-about-ottawas-latest-proposed-changes/), [PwC](https://www.pwc.com/ca/en/services/tax/publications/tax-insights/expand-information-reporting-non-profit-organizations-2026.html) **[$]**.
- Paying teachers: contractors, not employees, needs to be true on the facts; **T4A** slips for fees over $500/yr **[$]**. The append-only ledger is exactly the record an accountant will want [O].

### 4.3 Stripe: Connect vs one account + manual payouts
Memory records an unresolved contradiction ("Stripe Express vs one-core-account", COMMERCE_HANDOVER). Facts:

| | **Single account, manual payouts (e-Transfer)** | **Connect Express, destination charges** | **Connect Standard, direct charges** |
|---|---|---|---|
| Merchant of record | Collective | Collective (platform) | Teacher |
| Refund/chargeback liability | Collective | **Platform bears negative balances** [V] [Stripe docs](https://docs.stripe.com/connect/charges) | Teacher |
| GST threshold exposure | All sales are the collective's | Likely the collective's **[$]** | Teacher's |
| KYC / onboarding | none for teachers | Stripe-hosted, light | Teacher owns a full Stripe account |
| Cost | card fees only | + **US$2 / active account-month + 0.25% + 25¢ per payout** (platform-priced) [V] [Stripe Connect pricing](https://stripe.com/connect/pricing) — CAD figures differ, check | no Connect fees if Stripe bills the account directly [V] |
| Fit with "maker is payee, store is a front" | **Contradicts it** — the collective receives the money and re-pays | Partial | **Matches it literally** |
| Regulatory | Holding and forwarding others' funds at scale edges toward payment-service territory (RPAA) **[L]** | Stripe carries it | Stripe carries it |
| Build effort now | lowest (ledger + eTransfer exist) | medium (`stripe_account_id`, onboarding, webhooks) | medium |

Recommendation [O]: **year one = single account + ledger + manual e-Transfer payouts** for the collective's *own* flagship course and 3-5 founding teachers (volume is tiny; T4A-able; no per-account fees). Treat it explicitly as the collective selling and paying teachers a contracted share — and **accept that for that period the collective, not the maker, is legally the seller**; write the agreement accordingly **[L]**. Move to **Connect** when any of: >~10 paid teachers, a teacher approaching the GST threshold, member-org courses (orgs should be their own merchant), or monthly payout admin >2 hrs. Standard/direct suits orgs; Express/destination suits individual teachers. Add `stripe_account_id` on the store row when that time comes — not before.

### 4.4 CASL (course email)
- Purely transactional messages (enrolment confirmation, receipts, access/schedule changes for a course the person joined) are exempt from *consent* but still need sender identification; promotional content inside them removes the exemption [V] [ISED](https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email), [McInnes Cooper](https://www.mcinnescooper.com/publications/canadas-anti-spam-legislation-casl-10-faqs/).
- **Implied consent:** 2 years from a purchase/contract, 6 months from an inquiry; **2 years from membership in a not-for-profit club/association**, renewing on each purchase/renewal [V] [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm). Registered charities have a fundraising exemption NPOs do not [V].
- Practical: **two streams per learner** — *course-operational* (on with enrolment) and *news/offers* (express opt-in, unticked box, logged with timestamp + wording). "Next cohort opens" and "you might like course B" are **commercial**. Every message: legal name, mailing address, working unsubscribe honoured ≤10 business days. A waitlist sign-up is an inquiry (6 months) unless it has an express opt-in — **add the opt-in** [O]. The HMAC unsubscribe + per-org From identity already built (migration 128; memory) is the right substrate. Gift/sponsored seats: the recipient hasn't consented — send one transactional invitation only. Penalties up to $10M per violation for organizations [V general].

### 4.5 PIPEDA / learner data
- NPOs are not automatically exempt; PIPEDA applies to **commercial activity**, and the OPC lists membership fees, newsletters and fundraising as *not* commercial, while selling goods/services may be [V] [OPC on non-profits](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/02_05_d_19/), [CBA](https://www.cba.org/sections/charities-and-not-for-profit-law/member-articles/why-charities-and-not-for-profits-should-comply-with-pipeda/). **Selling courses is plainly the commercial end — assume PIPEDA applies** [O]; BC/Alberta/Quebec (Law 25: privacy officer, PIAs, stricter consent) have their own statutes for learners/orgs there **[L]**.
- **Reflections are sensitive.** OPC's sensitivity bulletin includes **religious or philosophical beliefs** and health; context can make anything sensitive; sensitive data needs **express consent** and stronger safeguards [V] [OPC bulletin](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_10_sensible/). Contemplative journals will contain belief, mental-health and trauma content.
- **Breach:** report to OPC + notify individuals where there is a **real risk of significant harm** (sensitivity × probability of misuse), regardless of head-count; keep a record of *every* breach for 24 months [V] [OPC breach guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/).
- Design consequences [O]: reflections **private to the learner by default**; sharing with the teacher/cohort is a per-reflection, revocable choice with a visible audience label; teachers see *that* a reflection was done, not its text, unless shared; no reflections in analytics, search indexes, email bodies or logs; **no AI/LLM processing without separate express consent**; learner export + delete; retention clock after course end; name a privacy contact; restrict admin read access and audit it (repo trap: `listPendingReviews()` currently returns every submitted response network-wide [V, COURSE_RESEARCH]); `author_id = viewer` is a visibility grant and forum admin branches ignore `visibility` [V memory] — lesson/reflection kinds must not ride those paths. Backups sit on the same pool and are not off-box [V CLAUDE.md] — encrypt before moving them off-box. Self-hosting in Canada is a genuine advantage: no cross-border transfer disclosure for core data; any video CDN/Stripe/SendGrid *is* a cross-border processor and belongs in the privacy notice.
- Minors: decide 18+ or build parental consent; recommend **18+ in year one** [O][L].

---

## 5. Go-to-market with a tiny team

**Sequence [O]**
1. **One flagship, run live.** Elkdonis Course module 1 as a 4-6 week cohort, 12-20 people, drawn from existing members (inner_group, reading group, Amrit). Sliding scale + scholarship seats. Manual where software is missing (invoices by e-Transfer are fine for 20 people). Record it.
2. **Founding-teacher cohort (3-5 teachers).** Already-trusted members with their own small following. Offer: 90/10 locked for 24 months, white-glove setup, a say in the roadmap, founding badge. In return: run one course within 6 months, give structured feedback, accept rough edges. Don't open self-serve teacher signup in year one.
3. **Waitlist** per course and one for "teach on the network": email + province + express CASL opt-in + one question ("what do you hope for?"). Useless until email actually sends — **SendGrid going live is on the critical path, ahead of Stripe** (eTransfer can take money; nothing can replace email).
4. **Second run + self-paced recording** of the flagship; first founding-teacher courses; only then bundles/Path pricing.
5. **Member-org LMS tiers** (§3) after two orgs have asked and one has run a course by hand.

**Metrics (small-N: read them as lists of names, not percentages) [O]**
- *Activation:* enrolled → completed first step within 7 days (target ≥70% for cohorts).
- *Week-2 and midpoint retention*; live-session attendance.
- *Completion* + *practice continuity* (reflections written, returned 30 days after).
- *NPS / "would you recommend"* + one open question at midpoint and end; NPS is noise below ~30 responses — read the comments.
- *Revenue per learner*, *% choosing each sliding-scale tier*, *scholarship seats funded vs requested*, *dana per learner*.
- *Refund rate* (>10% = a promise mismatch).
- *Teacher side:* hours per cohort, teacher net per hour, would-teach-again.
- *Cost:* infra $/active learner/month; video minutes delivered.
- *Second-course rate* within 6 months — the real health metric for a path-based curriculum.

**Video hosting cost**

| Option | Price (USD, 2026) | Notes |
|---|---|---|
| **Nextcloud (existing)** | $0 marginal; your uplink + disk | No adaptive bitrate/HLS, no transcoding ladder; a 1080p MP4 to 20 simultaneous learners ≈ 100 Mbps of **upload** from a TrueNAS box on a home/office line [O]. Fine for audio, PDFs, short clips, downloads. Already has enrolment-gated media authz [V repo]. |
| **Bunny Stream** | storage ~$0.01/GB-mo, delivery ~$0.005-0.01/GB NA/EU, H.264 encoding free | [V] [bunny.net pricing](https://bunny.net/pricing/stream/), [docs](https://docs.bunny.net/stream/pricing). 100 h library (~150 GB) + 500 learner-hours/mo (~750 GB) ≈ **$5-10/mo** [O arithmetic]. Token-auth URLs, captions. EU company. |
| **Cloudflare Stream** | $5 / 1,000 min stored + $1 / 1,000 min delivered, encoding included | [S] same scenario ≈ $30 + $30 = **~$60/mo**. Predictable per-minute; signed URLs. |
| **Mux** | per-minute encode + store + deliver; cut prices ~17-23% in 2026; best analytics/DX | [S] [Mux](https://www.mux.com/articles/the-best-video-apis-right-now); typically the dearest of the three at this scale; has a free tier |
| **PeerTube (self-host)** | VPS/box with ~4 cores/8 GB for transcoding; HLS + Web Video doubles storage; bandwidth is the wildcard; P2P offsets only with concurrent viewers | [V] [PeerTube docs](https://docs.joinpeertube.org/admin/configuration). Built for *public* federated video; private/enrolment-gated use fights its grain [O]. One more service for a tiny team. |

Recommendation [O]: **audio-first + Nextcloud for files; Bunny Stream (or Cloudflare) for lesson video, behind the existing authz with signed URLs; keep masters in Nextcloud** so the CDN is a disposable cache and there is no lock-in. Live sessions stay on Nextcloud Talk (already wired) or link out for >~15 video participants [O]. Revisit PeerTube only if public, free teaching video becomes a mission goal. Cost at year-one scale is a rounding error next to one hour of staff time; *uplink saturation and support burden* are the real risks of self-hosting video.

---

## 6. Risks

| Risk | Why it matters here | Mitigation [O] |
|---|---|---|
| **Teacher churn / lock-in fear** | Tiny catalogue; one departure is visible. Platforms that cut terms unilaterally (Udemy 25→15%) poison trust | Written **export right** (content, media, consented learner contact list, earnings ledger) in a standard format; notice period for term changes; no exclusivity by default |
| **Learner contact portability vs privacy** | Teacher wants "my students"; PIPEDA/CASL say the learner consented to *whom*? | At enrolment, separate consent: "share my email with [teacher] for their own announcements". Export only those. **[L]** |
| **Content IP** | Default expectation in a collective is unclear; co-produced recordings muddy it | **Teacher retains copyright; grants the collective a non-exclusive licence** to host/stream/market for the term + a wind-down period so enrolled learners can finish (e.g. 12 months). Collective-produced courses: written co-ownership or work-for-hire terms *before* filming. Third-party material (texts, music, images, lineage teachings/translations) = teacher warranty + takedown process. Canadian moral rights must be waived in writing if the collective will edit. **[L]** |
| **Traditional / lineage material** | Some teachings carry transmission restrictions beyond copyright | Ask on the course intake form; respect "not for recording" |
| **Learner access after a teacher leaves** | "Lifetime access" promises become liabilities | Promise "access for N months after the course ends", never lifetime |
| **Safeguarding — contemplative practice** | Adverse effects are documented: in one MBP sample 83% reported ≥1 meditation-related side effect, **37% with negative impact on functioning**, ~6-14% lasting [V] [Britton et al. 2021](https://journals.sagepub.com/doi/10.1177/2167702621996340). Online, asynchronous, unscreened delivery raises the risk. Plus teacher-student power dynamics | Intake note + "is this right for you now" screen for intensive practices; "not therapy / not medical care" statement; crisis resources on every practice page; teachers name their training and supervision; trauma-sensitive guidance for founding teachers ([Cheetah House trainings](https://www.cheetahhouse.org/about-trainings)); a **code of ethics + independent complaint route** (not only to the teacher or their org); ability to pause a teacher; 18+; teachers never see private reflections by default. Tier-ungated (§3) |
| **Liability** | Collective as seller/host of another's teaching | Teacher agreement with warranties + indemnity; learner terms with assumption-of-risk; **general liability + cyber insurance quote**; directors' exposure if incorporated **[L]** |
| **Moderation** | Cohort discussion threads ride the shared `threads` namespace | Lesson/reflection kinds in `OFF_FEED_KINDS`; per-cohort visibility; report button; named moderator per cohort |
| **NPO status drift** | A successful LMS starts to look like a business | Cost-recovery pricing, surplus → scholarships/infra, annual accountant review; consider a taxable subsidiary if it takes off **[$][L]** |
| **Single-box operations** | DB, media and backups on one pool [V] | Encrypted off-box backup before taking the first paid enrolment |
| **Payment disputes** | Platform bears chargebacks under single-account and destination charges | Payout hold through refund window; small reserve in the ledger |
| **Founder/maintainer bus factor** | From-scratch LMS + tiny team | Keep v1 to four tables (per COURSE_RESEARCH); manual ops over features |

---

## 7. Needs a professional before money moves

- **[$]** Legal form of EAC and whether it qualifies as an NPO "public service body" ($50k vs $30k GST threshold); whether its courses are taxable; whose supply it is under each Stripe topology; platform deemed-supplier exposure; QST; T4A/contractor treatment; dana characterization; new NPO return thresholds and start date.
- **[L]** Teacher agreement (IP licence, split, notice, export, indemnity, conduct); learner terms + refund policy vs provincial consumer law; privacy policy incl. sensitive-data consent, Quebec Law 25; safeguarding policy and complaint process; whether holding/forwarding teacher funds raises RPAA/money-services questions; insurance.

---

## Recommended default business posture for year one

1. **Mission-first, cost-recovery.** Goal is *break-even on direct costs and teachers paid fairly*, not margin. This is also the posture that protects NPO status. [O][$]
2. **One flagship Elkdonis cohort, live, 12-20 people, sliding scale in three named tiers with a stated true cost, ≥2 scholarship seats, dana button for the teacher.** First module free and open.
3. **No subscription, no bundles, no self-serve teacher signup, no B2B licences this year.** Add self-paced recordings of what has already run live.
4. **Founding-teacher cohort of 3-5**, by invitation: **90/10 on students they bring, 75/25 on students the network brings, 100% of dana less processing**, terms locked 24 months, 90-day notice on any change thereafter, written export right. Course default commission is its own number — do **not** inherit the 30% gallery rate.
5. **Money:** single collective account + append-only ledger + manual e-Transfer payouts after the refund window; agreement says plainly that the collective is the seller during this phase. Revisit Connect (Standard for orgs, Express for individuals) at ~10 paid teachers or when member orgs sell. Collect learner province at checkout from the first sale; prices tax-inclusive; stay under the small-supplier threshold knowingly, with the accountant's number, and register deliberately rather than by accident.
6. **Receipts say "not an official donation receipt".** No charity language anywhere.
7. **Email before Stripe.** Get SendGrid live with two consent streams (course-operational vs news) and logged express opt-ins, including on waitlists.
8. **Privacy by default:** reflections private to the learner, express consent for any sharing, no AI processing, export + delete, 18+, encrypted off-box backup before the first paid enrolment.
9. **Refunds:** cohort — full to end of week 2/midpoint; self-paced — 14 days under 30% consumed.
10. **Video:** audio and files on Nextcloud; lesson video on Bunny Stream (or Cloudflare) behind existing authz, masters kept in Nextcloud. Budget <CA$25/mo.
11. **Org tiers:** map LMS limits onto the existing `free / supported / partner`; gate scale, branding and support; never gate export, learner data access, accessibility, safety, privacy, refunds, or the ability to teach for free.
12. **Safeguarding shipped with v1, not after:** intake screen, not-therapy notice, crisis resources, code of ethics, independent complaint route, pause-a-teacher.
13. **Watch six numbers:** first-step activation, midpoint retention, completion + 30-day practice continuity, sliding-scale tier mix, teacher net per hour, second-course rate. Review with the founding teachers quarterly and publish the split and the numbers to them — transparency is the one advantage a collective has over every platform in §1.2.
