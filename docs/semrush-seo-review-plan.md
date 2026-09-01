# yazeed.blog — SEO review and implementation plan

**Prepared:** 1 September 2026 (Semrush review, from a checkout that predates the static prerender)
**Revised:** 1 September 2026 — independent technical review against the repository at `c8fbd8a`, the live site's HTTP responses, refreshed Semrush data, live top-ten results for eight keywords, and Google's own documentation
**Purpose:** A plan the owner can act on, with every claim labelled by how far it can be trusted
**Scope:** Semrush evidence, the repository as committed, live HTTP behaviour, and what Google documents
**Status:** Recommendation only. Nothing in this document has been implemented. What is already live on `main` (the static prerender, self-hosted fonts, canonical-host and retired-page redirects, `noindex` on the 404 and the stubs, the Excel export) is recorded as fact, not proposed. One per-calculator page exists in draft on the review branch, unmerged and unlinked.

## Executive conclusion

The original plan diagnosed two things correctly and one thing wrongly.

**Correct:** the site has no measurable organic visibility and effectively no
link authority. Semrush finds the domain in **no regional database at all**
(re-checked 1 September 2026); its 31 referring domains are near-worthless;
and nothing is being measured — Google Search Console is not known to be
verified, so whether Google has indexed the homepage is simply unknown.

**Wrong, because the site moved:** the plan describes "one indexable URL
serving 33 JavaScript-rendered calculators" with an empty container in the
HTML. Today the page carries **34** calculators and about **7,900 words of
static HTML** — every formula, input, output and explanation — because the
"constraint-preserving fallback" the plan proposed as a last resort was
implemented and shipped before the plan was written. The plan also reads a
one-page rule into `AGENTS.md` that is not there; the wording it inherited
comes from two earlier planning documents, not from the constraints.

**So the central recommendation changes.** Not seven landing pages: a
**one-page pilot** on earned value — already drafted, about 1,700 words of
practitioner prose, generated from the desk's own data so it cannot drift —
shipped with the internal links and the homepage re-titling it depends on,
and measured through Search Console for four to eight weeks before a second
wave of two or three pages on genuinely distinct intents. Two of the plan's
seven pages could never have matched their query: the site has no critical
path solver, and "project management formulas" is a PMP exam-sheet search.
Three of the seven were one cluster that a single page serves; the live top
ten shows two competitors doing exactly that with one URL.

**One finding the original plan could not have made:** the site's most
valuable teaching text — the verdict sentences that read each result back in
plain English — lives inside JavaScript function bodies. It is absent from
the static HTML and absent from the rendered page until a visitor types. No
search engine and no AI answer engine has ever seen it. That is a product
decision for a later phase, and it is worth more than any structured-data
change in this plan.

**The highest-impact first phase is five items**, in order: verify Search
Console; ship the pilot page with its links and the small fixes it still
needs; re-title the homepage as the hub; baseline the measurement; add HSTS
and font caching in one guarded block as hygiene. Everything else waits for
data.

**What this plan will not promise** is rankings on a timeline. A domain with
Authority Score 0 commonly sees little movement for two to four months after
content ships, and the Semrush zero predates both the prerender and the
canonical-host fix. Targets lead with what the site controls — indexing,
links in place, content shipped — and label confidence on what Google
decides.

## How to read this document

| Label | Meaning |
|---|---|
| **Confirmed fact** | Verified by reading the repository or the live site's HTTP responses on 1 September 2026 |
| **Semrush observation** | A figure Semrush reported. The plan's figures (July–August 2026) were re-pulled on 1 September 2026; where they agree one number is shown |
| **Inference** | Follows from the evidence; the reasoning is shown beside it |
| **Assumption** | A premise this plan relies on and cannot verify from here; listed at the end |

Recommendations are separate from all four and carry what they depend on,
how success is measured, and whether the owner must decide.

## Evidence

### The site as it is today — confirmed facts

| Item | State on 1 September 2026 | Source |
|---|---|---|
| Calculators | **34** calculators, 14 domains, 103 metrics | `tests/counts.js` derives these from `PM_DATA` and fails the suite if the title, description or JSON-LD drift |
| Static content | The static mirror inside `#calc-sections` carries about 7,400 words; the whole page without JavaScript carries **7,922 words** and a complete outline — 1 h1, 15 h2 (14 domains plus "At the bench"), 34 h3 (one per calculator), 98 h4, 4 h5. Every formula, input label and meaning, output label and meaning, and chart title is in the static markup, with a 14-entry static table of contents | `tools/prerender.js` writes the mirror between `<!-- prerender:start -->` and `<!-- prerender:end -->`; `tests/prerender.js` fails if it is stale; live since commit `f28b58d` |
| What is **not** in the static HTML | The **verdict sentences** — each output's plain-English reading ("Under budget — the work performed cost less than its budgeted value", "Achievable — no extra efficiency needed") — are produced by `interpret()` functions at runtime. They are not in the mirror, and they are not in the rendered page either until a visitor enters values | `index.html`; confirmed by searching the prerender block |
| Rendered page | The browser script empties `#calc-sections` and rebuilds the desk from the same `PM_DATA`. Google indexes the **rendered** DOM, so anything meant for Google must exist in the JavaScript card template as well as in the mirror | `index.html` (`sectionsEl.innerHTML = ''`) |
| Fragment ids | The mirror uses `#prerender-cat-<id>` and `#prerender-calc-<id>`; the rebuilt desk uses `#cat-<id>` and `#calc-<id>`. A deep link a crawler extracts from the static HTML resolves to nothing in a browser and lands at the top of the page | `tools/prerender.js` lines 172, 279, 286; `index.html` lines 8408, 8623 |
| Title | `Earned Value Explained — CPI, SPI, EAC + 34 PM Calculators` (60 characters) | `index.html` |
| Meta description | 155 characters, leads with earned value | `index.html` |
| Canonical | `https://yazeed.blog/` | `index.html` |
| Structured data | One `WebApplication` with `author` (Person: Yazeed Alotaibi, sameAs LinkedIn), `Offer` (price 0), `inLanguage`, `isAccessibleForFree`, `featureList` of all 34 calculators. No `BreadcrumbList`, `FAQPage`, `HowTo`, `Article` | `index.html` |
| Author signals | Visible "At the bench" section (`#about-h`) with PMI-RMP · PRINCE2 credentials; author in JSON-LD; LinkedIn link | `index.html` |
| Outbound citations | doi.org (Little's Law), scrumguides.org | `index.html` |
| Internal links to other pages | **None.** The homepage links to no other `.html` on the site. Calculator navigation uses `#calc-<id>` fragments, which is correct for in-page navigation and not a separate URL to Google | `index.html` |
| Sitemap (live) | One URL: `https://yazeed.blog/` | `sitemap.xml` on `main` |
| robots.txt | `Allow: /` plus the sitemap line; returns 200 | live |
| Redirects | `http→https` 301; `www→apex` 301; both retired tool pages 301 to `/#calc-sections` — all server-side inside a guarded `<IfModule mod_rewrite.c>` block | `.htaccess`; live `curl -I` |
| Retired stubs | Still on disk with `noindex, follow`, a canonical to the apex and a meta-refresh; never served while `mod_rewrite` works | `pm-calculation-desk.html`, `wbs-estimation-toolkit.html` |
| 404 | Branded page, `noindex`; `/no-such-page` returns a real 404. Its font paths are relative (`fonts/…`), so at a nested path such as `/deep/path/missing` the fonts fail to load and the page renders in fallback faces. Cosmetic; no ranking effect | `404.html`; live `curl` |
| HSTS | **Absent.** No `Strict-Transport-Security` header on any live response | live `curl -I` |
| Other headers | No `Cache-Control`, no `X-Robots-Tag`. Served through Hostinger's CDN (`server: hcdn`, `x-hcdn-cache-status: DYNAMIC`) | live `curl -I` |
| `llms.txt` | Absent (404) | live |
| Core Web Vitals | LCP 280–380 ms, CLS 0.000, no horizontal overflow at 320/390/768/1440 px, zero third-party requests, self-hosted fonts (six woff2, 103 KB) | headless Chromium against the live bytes |
| Page weight | 423 KB raw, 106 KB gzipped | `gzip -c index.html` |
| Constraints | No build step; no dependencies; no third-party requests; **self-contained pages** (plural — `404.html` is a second page); client-side only; ES5. `AGENTS.md` says "Copy the custom properties and font stack from `index.html` **when adding a page**" and establishes `tools/prerender.js` as an accepted commit-time generator. **Nothing in it limits the site to one page.** The "one file" wording the plan inherited is in `docs/parallel-plan.md` and `docs/codex-handoff.md` — working notes, not constraints | `AGENTS.md` line 109; `docs/` |
| Per-calculator prose | Median **170 words** of unique explanatory text per calculator in `PM_DATA`; 30 of 34 under 250 words; the richest is earned value at 547, then three-point (305) and earned schedule (302) | measured from `PM_DATA` |
| Draft page (branch only) | `earned-value-analysis.html`, generated by `tools/calcpage.js`; prose in `content/earned-value-analysis.html` (about 1,700 words); metadata in `content/pages.json`; `tests/pages.js` regenerates and byte-compares. Measured: CLS 0.018 on mobile, LCP about 200 ms, 88 KB gzipped, 2,410 static words, zero third-party requests. **Known defects to fix before merge:** the `BreadcrumbList` middle item has no `item` URL (Google requires one on every entry but the last); *Copy link* on the page produces a desk URL because `stateUrl()` hard-codes `https://yazeed.blog/#`; the footer hard-codes "34 calculators" outside the count tests; the byline does not link to the author section | `tools/calcpage.js` lines 247–249, 376; `index.html` line 8090 |

### What the original plan got wrong about the site

The plan was written against a checkout that predates commit `f28b58d`; the
branch it arrived on lacks `tools/prerender.js` entirely. Its structural
premises are therefore stale or wrong:

| Plan said | Actual | Consequence |
|---|---|---|
| "One indexable URL serving **33** JavaScript-rendered calculators" | 34 calculators, and they are **not** JavaScript-rendered: about 7,900 words are in the static HTML | The count was wrong and the central structural diagnosis no longer holds |
| "The calculator section is an empty `<div id="calc-sections"></div>` in the initial HTML" | It contains a full static mirror of every calculator | Stale since `f28b58d` |
| "If the one-page constraint must remain, the fallback is to place the calculator headings, descriptions, formulas, examples, and navigation in static HTML and progressively enhance them" | **Already implemented and live**, including a 14-entry static table of contents | Not an option to decide on; the current state. The real question is what static content on one URL *cannot* do |
| "Google can render JavaScript, but relying on rendering increases discovery and interpretation risk" | Crawlability is solved. Rendering matters in the opposite direction: Google indexes the rendered DOM, which the script rebuilds — so text and links must exist in the card template too | The paragraph should be replaced, not kept |
| "This option conflicts with the repository's current documented premise of one main HTML page" | `AGENTS.md` has no such premise; it forbids shared files, build steps and dependencies, and describes what to copy "when adding a page" | The approval needed is narrower: whether the generator pattern is the sanctioned way to add pages |
| Site Audit: "Low word count · 4 · Homepage and retired variants"; "Low text-to-HTML ratio" | The homepage now serves about 7,900 static words; the retired variants 301 | Both rows are stale, alongside the robots, sitemap and duplicate-host rows the plan already retired |
| "No Position Tracking campaign, making progress difficult to measure" | True but secondary. The primary gap is that no Google Search Console property is known to exist, so indexing, impressions and clicks are unmeasured | Measurement order in the plan is reversed |

### Semrush observations

**Organic visibility.** `domain_rank` returns "nothing found" for the US and
Saudi databases, and `domain_ranks` returns "nothing found" across **every**
Semrush regional database (1 September 2026). This matches the plan's 0
keywords / 0 traffic and extends it. As the plan correctly says, it is not
proof Google has indexed nothing; it means no top-100 position for any
keyword Semrush tracks. Two things happened after that zero was recorded —
the canonical-host fix and the static prerender — so the baseline should be
re-read about four weeks after Search Console is verified, not inherited.

**Backlinks** (unchanged from the plan; re-pulled 1 September 2026):

| Metric | Value |
|---:|---|
| Authority Score | 0 |
| Backlinks | 32 |
| Referring domains | 31 |
| Follow / nofollow | 10 / 22 |
| Trust score | 0 |

The plan's qualitative reading — 16 `.shop` and 6 `.site` referring
domains, categorised under beauty and travel, with fabricated anchor claims —
was not re-pulled and is carried forward as reported. The conclusion stands:
**effectively zero useful authority.** The plan's stance of not disavowing is
correct and matches Google's stated position that it ignores such links; a
disavow file is for manual actions or links you acquired yourself.

**Site Audit** (31 July 2026 snapshot, 7 pages crawled, Site Health 75).
The plan's own live validation retired most of it. Re-checked on 1 September
2026: `robots.txt` and `sitemap.xml` return 200; `www` and both retired URLs
answer 301; the 404 page is `noindex`; the homepage now carries about 7,900
static words. **Only the HSTS finding is still current.** Site Health is a
Semrush composite, not a Google signal — a hygiene score, not a target.

**Keywords, US database** (re-pulled 1 September 2026; the plan's nine
first-wave figures matched exactly, so one set of numbers is shown):

| Keyword | Volume | KD | Intent | CPC |
|---|---:|---:|---|---:|
| estimate at completion calculator | 40 | 2 | informational | 0.00 |
| project management formulas | 70 | 8 | informational | 2.69 |
| cost performance index calculator | 110 | 10 | informational | 0.00 |
| schedule performance index calculator | 90 | 16 | informational | 3.96 |
| earned value formulas | 40 | 19 | informational | 3.39 |
| critical path calculator | 140 | 22 | informational | 3.71 |
| risk matrix calculator | 90 | 23 | informational | 0.00 |
| earned value management | 3,600 | 35 | informational | 3.44 |
| PERT calculator | 390 | 43 | informational | 0.84 |
| *Added on refresh:* | | | | |
| eac calculator | 90 | 10 | informational | 0.00 |
| spi calculator | 90 | 23 | informational | 3.96 |
| earned value calculator | 30 | 19 | informational | 3.47 |
| tcpi calculator | 20 | 0 | — | — |
| three point estimate calculator | 20 | 0 | — | — |
| project management calculator | 20 | 0 | — | — |
| cpi calculator | 14,800 | 85 | **commercial** | 1.49 |

**Keywords, Saudi database:** earned value formulas 140 (KD 27); earned value
management 170 (KD 30); critical path calculator 20; project management
formulas 10; risk matrix calculator 10; earned value calculator 10. The Saudi
signal is concentrated in earned value.

### What the top ten actually looks like — new evidence

The plan chose keywords from volume and difficulty. It never looked at who
ranks. Live top-ten results (US, 1 September 2026) change several of its
conclusions.

**"critical path calculator"** — positions 1, 2, 3, 6 and 9 are network
solvers: you enter activities, durations and dependencies and they compute
the critical path (pmcalculators.com, sanjiverat.com, atozmath.com, PolyU,
planlab.ai). The rest are an Excel template, a PMI article and vendor
explainers. **This site has no such solver.** Its "Float (slack)" calculator
takes early and late start/finish *as inputs* and returns float; "Crash cost
slope" computes a cost per period. A page titled "critical path calculator"
built on either would not satisfy the query, however well written.
*Inference: intent mismatch; drop as a target.*

**"risk matrix calculator"** — position 1 is a building-physics moisture
matrix; positions 2, 3 and 7 are health-and-safety risk assessment tools;
positions 8–9 are Smartsheet templates. The intent is general and HSE risk
assessment. The site's qualitative risk score (probability 1–5 × impact 1–5)
is a partial match at best. *Inference: weak target; defer, and if built,
build it as a general 5×5 probability–impact tool that mentions safety use,
or it fails the dominant intent.*

**"estimate at completion calculator"** — a mix of explainer articles
(projectmanager.com, productive.io, monday.com, Wrike) and calculators
(vcalc, opteam.ai, pmworld360, mathcelebrity), all project-management EAC.
A page pairing a working EAC calculator with a worked explanation matches
the intent exactly. KD 2. *Inference: the best single target in the set.*

**"cost performance index calculator" and "schedule performance index
calculator"** — two pages rank in the top ten for **both** queries with a
single URL: `ajdesigner.com/earned-value/` (positions 4 and 8) and
`pmpcalculators.com/calculators/cpi-spi/` (positions 3 and 10). Other sites
rank separate per-metric pages. *Inference: one strong earned-value page can
carry the CPI/SPI/EAC cluster; three separate pages built on the same
calculator are not required and would compete with each other.*

**"earned value formulas"** — formula lists and explainers
(projectengineer.net, planacademy's "7 EVM formulas", PMI). A single
earned-value page that states every formula matches.

**"project management formulas"** — positions 1, 2, 4, 7 and 10 are **PMP
exam formula sheets** (projectmanagementacademy "PMP formulas on the exam",
prepcast "PMP formulas", 4pmti, eduhubspot, techademy), plus an r/pmp thread
asking which equations are on the exam. The intent is exam preparation, not
a calculator directory. *Inference: the plan's "content hub" at this keyword
would need to be a formula sheet to match; the calculator desk is adjacent
to the intent, not on it.*

### What Google documents — fetched 1 September 2026

Quoted from Google Search Central rather than remembered.

- **Pre-rendering.** "Server-side or pre-rendering is still a great idea
  because it makes your website faster for users and crawlers, and not all
  bots can run JavaScript." Rendering is queued: a page "may stay on this
  queue for a few seconds, but it can take longer than that." The static
  mirror is exactly this.
- **Fragments.** "Don't use fragments to load different page content" —
  fragment routing is "a bad practice, because Googlebot can't reliably
  resolve the URLs." `#calc-earned-value` is correct as in-page navigation;
  it is not a URL Google will index separately.
- **Doorway abuse.** "Sites or pages are created to rank for specific,
  similar search queries. They lead users to intermediate pages that aren't
  as useful as the final destination" — including "substantially similar
  pages that are closer to search results than a clearly defined, browseable
  hierarchy." **Scaled content abuse:** "many pages are generated for the
  primary purpose of manipulating search rankings and not helping users."
- **Helpful content self-assessment.** "Are you writing to a particular word
  count because you've heard or read that Google has a preferred word
  count?" — and — "Does your content clearly demonstrate first-hand expertise
  and a depth of knowledge?" The word count is not the point; the
  practitioner's knowledge is.
- **Sitemaps.** Needed when "your site is new and has few external links to
  it"; not needed when the site is "about 500 pages or fewer" and
  "comprehensively linked internally." Both apply, so a sitemap is cheap
  insurance rather than a lever.
- **`SoftwareApplication` rich result.** Required properties are `name`,
  `offers.price` **and a rating or review**. Without a rating there is no
  rich result; the site has no honest source of one.
- **`FAQPage`.** "The feature is only shown for well-known, authoritative
  government and health websites." No FAQ rich result is available here.
- **`HowTo`.** Documentation removed 14 September 2023 "as this rich result
  is no longer shown in search results, on both desktop and mobile devices."
- **HSTS.** Not documented by Google as a ranking factor. HTTPS itself is a
  lightweight signal, and the site already has it. hstspreload.org's
  deployment guidance starts at `max-age=300`, then 604800, then 2592000,
  and only then the year required for preload — the reverse of the plan's
  "begin with `max-age=31536000`."

## Keyword prioritisation — revised

The original table ranked by volume and difficulty. That is the right start
and the wrong finish: it never asked whether this site can satisfy the
query, or whether two of its own pages would compete. Both were answered
above with live top-ten results.

| Keyword | Vol (US) | KD | Intent match with what the site actually computes | Cannibalisation | Verdict |
|---|---:|---:|---|---|---|
| estimate at completion calculator | 40 | 2 | Exact — the earned-value card computes three EACs, ETC and VAC; SERP is PM explainers plus calculators | — | **Primary target of the earned-value page** |
| cost performance index calculator | 110 | 10 | Exact — same card | Would compete with a separate EAC page and with the homepage title | **Same page**, not a separate one — the SERP shows one page ranking for CPI *and* SPI |
| schedule performance index calculator | 90 | 16 | Exact — same card | As above | **Same page** |
| eac calculator | 90 | 10 | Exact; SERP not checked; the plan reports it mixed with Equivalent Annual Cost | — | Secondary term on the same page; keep "estimate at completion" in the title |
| earned value formulas | 40 US · **140 SA** | 19 / 27 | Exact — the page states every formula | — | **Same page**, with an explicit "every earned value formula" section; this is where the Saudi demand is |
| earned value calculator | 30 | 19 | Exact | — | Same page |
| tcpi calculator | 20 | 0 | Exact — TCPI to BAC and to EAC | — | Same page (a TCPI section exists) |
| earned value management | 3,600 | 35 | Broad informational; SERP is PMI, vendors, training providers | A separate "pillar" splits authority with the earned-value page | **Not a separate page.** Whichever URL owns earned value — homepage or the new page — grows into this over 6–12 months if it earns links |
| project management formulas | 70 | 8 | **Mismatch as proposed.** The top ten are PMP exam formula sheets and an r/pmp thread | A separate "hub" competes with the homepage | **Reframe as a formula-sheet page in a later wave** — a distinct intent the author's credentials suit, and the plan's Phase 6 "printable guide" under a name that matches a real query |
| critical path calculator | 140 | 22 | **Mismatch.** Five of the top ten are network solvers; the site has none | — | **Drop.** Building a forward/backward-pass solver over an activity list would be a product decision, not an SEO one |
| risk matrix calculator | 90 | 23 | Partial. SERP is HSE tools and templates | — | **Defer.** If ever built, page the whole Risk domain (risk score, EMV, contingency — three cards, about 460 base words) as one page rather than a one-input widget |
| PERT calculator | 390 | 43 | Exact — the three-point card, the second-richest (305 words) | — | **Wave two, or wave one if the owner can write it now.** KD 43 is beyond a zero-authority domain in 90 days; "three point estimate calculator" (20, KD 0) is the entry term |
| cpi calculator / spi calculator / eac calculator (bare) | 14,800 / 90 / 90 | 85 / 23 / 10 | The plan's analysis stands: "cpi calculator" is *commercial* intent (Consumer Price Index); SPI mixes with SIP; EAC with Equivalent Annual Cost | — | Never primary. Use the abbreviation in copy once the long form has been stated |

Three consequences follow.

**The earned-value cluster is one page, not three.** Seven of the terms
above resolve to the same calculator and the same explanation — about 500
US searches a month across the cluster at KD 2–23, plus 140–170 in Saudi
Arabia. Google ranks one strong page for a cluster of closely related
queries, and the SERPs show two competitors doing it with a single URL.
Three near-identical pages built on one calculator would each be thinner
than the one page, would compete with each other, and match Google's
"substantially similar pages that are closer to search results than a
clearly defined, browseable hierarchy."

**Two of the plan's seven pages cannot be built honestly.** A "critical path
calculator" page without a solver, and a "project management formulas" page
that is not a formula sheet, would both fail the query they target.

**Realistic difficulty for this domain.** Authority Score 0, zero ranking
keywords anywhere. Terms at KD 2–19 are attainable with a genuinely good
page and patience; KD 35–43 are not a 90-day proposition. Semrush's KD is
calibrated for an average domain; for this one every figure understates the
effort.

## The architecture decision

### What the plan asked, and what it should have asked

The plan framed the decision as *one-page constraint versus crawlable
landing pages*, with static progressive enhancement as the fallback if pages
were refused. The site has moved since:

- The "fallback" is **live**: about 7,900 static words, every formula and
  metric in plain HTML, a static table of contents. Google calls
  pre-rendering "a great idea" precisely because "not all bots can run
  JavaScript."
- `AGENTS.md` imposes **no one-page constraint**. It forbids pages sharing
  files, build steps and dependencies; it tells you what to copy "when
  adding a page"; a second page already exists.
- A generator for per-calculator pages exists on the review branch
  (`tools/calcpage.js`). It lifts the stylesheet, data, chart renderers,
  spreadsheet export and rendering engine out of `index.html` at build time
  and lets the **unmodified** engine render one card, so no calculator logic
  is duplicated and a page cannot drift from the desk. `tests/pages.js`
  regenerates every page and compares byte for byte.

So the real question is narrower: **what can one URL not do, and is that
worth a page?**

### What one URL can and cannot do

One URL can rank for many closely related queries. The homepage, with a
title leading on earned value and 547 words on it, is a plausible ranker
for the earned-value cluster today — though it ranks for nothing, which is
an authority and measurement problem, not a page-count problem.

One URL cannot hold thirty-four **distinct** intents. "PERT calculator,"
"DPMO calculator," "point of total assumption" are different questions from
different people. A page can lead with one of them in its title and H1; it
cannot lead with fourteen. That is the case for pages — a **few** pages on
distinct intents, not thirty-four.

### The thin-content risk, with numbers

The median calculator has 170 words of unique prose behind it; thirty of
thirty-four have fewer than 250. A page generated from that alone — a
calculator widget wrapped in two paragraphs — is the shape Google's spam
policy describes as scaled content and its helpful-content guidance warns
against ("writing to a particular word count"). It is also unpersuasive to
a reader. **The page split is the easy half; the writing is the work.** The
earned-value draft carries about 1,700 words a practitioner would write and
a calculator site would not: which EAC formula encodes which assumption,
where SPI stops telling the truth, the five mistakes that survive into real
reporting. That is the bar, and it should be a gate: `tests/pages.js` should
fail a page whose content file carries fewer than about 1,000 words.

### Decision

**Recommended: a one-page pilot, then decide with data.**

1. Ship the earned-value page (already drafted) as the only new page.
2. Measure indexing and impressions through Search Console for four to
   eight weeks.
3. If it is indexed and earning impressions for its cluster, add a second
   wave of **two or three** pages on genuinely distinct intents, each with
   at least 1,000 words of practitioner content.
4. Never more than five pages in the first six months. Thirty-four is not a
   target; it is the failure mode.

Reviewers of this plan split on whether the three-point/PERT page should
ship in wave one alongside earned value, since it is the strongest exact
match the site has after earned value and its card is the second richest.
The pilot-first sequence is recommended because it produces a clean signal
about whether generated pages get indexed and shown at all before more
writing is committed; if the owner can write the PERT prose now, shipping
two pages in wave one is a defensible alternative and costs nothing in
architecture.

**The dependency the plan missed: the homepage title.** If the earned-value
page ships while the homepage title still reads *"Earned Value Explained —
CPI, SPI, EAC + 34 PM Calculators"* and its H1 reads *"Earned value,
explained."*, the two compete for one cluster and Google picks one. The
hub/spoke model needs the homepage to become the hub — a title, description
and H1 about the desk itself (34 calculators, 14 domains, free, nothing
leaves the browser) — and the earned-value page to own earned value. That
changes the site's headline framing and is the owner's call. The alternative
— keep the homepage earned-value-first and do not ship the page — is
coherent and forgoes the 1,700-word page. Both is not coherent.

The retitle has a blast radius `tests/counts.js` polices: the title, meta
description, `og:title`, `og:description`, `og:image:alt`,
`twitter:image:alt`, JSON-LD description and hero copy must each keep a
count phrase in one of the tested forms; and if the figures on `og.png`
ever stop being true it must be re-rendered from `design/og-card.source.html`
with the fonts pointed at `../fonts/` first.

**URL form.** Keep `.html` (`/earned-value-analysis.html`). Google has no
preference; a rewrite adds a `mod_rewrite` dependency for a cosmetic gain,
and a canonical pointing at a URL the host does not answer is worse than an
honest one.

**Internal linking is the missing piece, and it has a rule.** The homepage
links to no other page today. A subpage the sitemap lists but nothing links
to is weakly discovered. Because the browser script *replaces* the static
mirror and Google indexes the rendered DOM, a link placed only in the
prerender block disappears from what Google sees; a link placed only in the
JavaScript card is invisible to fetchers that do not run scripts. **Every
shipped page therefore needs the link in both places** — emitted by the card
template from a field in `PM_DATA` (so the runtime renders it) and mirrored
by `tools/prerender.js` (so the static HTML has it) — plus a breadcrumb back
to the desk and contextual links to two or three related calculators.
`tests/pages.js` should assert that `index.html` contains a static link to
every page in `content/pages.json`.

**Approval needed.** Not "abandon the one-file premise" — there is none —
but: *is `tools/calcpage.js`, a commit-time generator in the same pattern as
`tools/prerender.js`, the sanctioned way to add pages?* If yes, `AGENTS.md`
gains a section describing the generator, `content/`, `tests/pages.js`, the
regenerate-after-editing rule, and the prose gate.

**Fixes the draft needs before it can merge** (all small, all verified):

1. `BreadcrumbList`: give the middle entry an `item` URL or emit a two-item
   trail (Desk → calculator); add a `tests/pages.js` check that every
   non-final `ListItem` has an `item`.
2. `stateUrl()` in `index.html` builds `https://yazeed.blog/#…` from a
   constant, so *Copy link* on a subpage copies the desk's URL. Build it
   from `location` instead (ES5: `location.protocol + '//' + location.host +
   location.pathname + '#' + el.id + …`).
3. The generated footer hard-codes "34 calculators". Interpolate the count
   from the full `PM_DATA` before narrowing, and assert it in
   `tests/pages.js` the way `tests/counts.js` does.
4. The byline should link to the author section (`/#about-h`) and the page's
   `dateModified` should come from `pages.json`'s `updated`, kept true.
5. Check CLS in a real browser at 390 px before merging any generated page —
   the draft measured 0.54 before its static mirror was added and 0.018
   after, and no test measures it.
6. Retitle the page's H2s to carry the long-form phrases the cluster is
   searched by ("Cost performance index (CPI)", "Schedule performance index
   (SPI)", "Estimate at completion (EAC)", "Every earned value formula"), so
   the page is query-aware as well as content-complete.

## Technical recommendations — reviewed

| Recommendation in the plan | Verdict | What the revised plan says |
|---|---|---|
| **HSTS** — "add HSTS... begin with `max-age=31536000`" | Correct to add; wrong rollout; mislabelled as SEO | HSTS is a security header. Google does not document it as a ranking factor; HTTPS (the lightweight signal) is already in place. Keep it — the one Site Audit finding still live, ten minutes of work — but label it hygiene. Mechanism on this host: `Header always set Strict-Transport-Security "max-age=300"` inside a new `<IfModule mod_headers.c>` block in `.htaccess` (`always` so the 301 responses carry it too); a bare `Header` line on a host without the module would 500 the whole site, which is the rule `AGENTS.md` already states for `mod_rewrite`. Ramp per hstspreload.org: 300 → 604800 → 2592000 → 31536000, each step after verifying with `curl -I` **from outside** — the CDN terminates the connection and may not pass origin headers; if `hcdn` strips it, set it in Hostinger's panel instead. `includeSubDomains` only after confirming every subdomain serves valid HTTPS (`www` does); no preload. Success: header visible from outside; Semrush notice gone. Measurable SEO value: none |
| **Structured data** — "`WebApplication` and `BreadcrumbList`"; "valid structured data" as a completion criterion | Partly right; overstated | `BreadcrumbList` on subpages: yes — the one type here with a visible payoff, once its middle item is fixed. `SoftwareApplication`/`WebApplication`: keep for entity clarity (author, free, topic), but Google **requires a rating or review** for the rich result and the site has no honest source of one; expect nothing visible and never add a synthetic rating. `TechArticle` with author, `datePublished`, `dateModified` on subpages: reasonable attribution, no rich result. **Do not add `FAQPage`** (restricted to government and health sites since 2023) or `HowTo` (removed September 2023). "Valid structured data" is not a meaningful completion criterion; "every page passes the Rich Results Test with no errors" is |
| **"Three to five visible question-and-answer sections"** per page | Sound as content, not as schema | Keep them where the questions are real — the plan's five earned-value questions belong on the earned-value page as h2/h3 prose; drop the two critical-path questions unless a solver ships. Their value is the answer, not the markup |
| **Sitemap** — "add all canonical landing pages" | Sound | Every real page with an honest `lastmod` (the date the content last changed). `tests/pages.js` already fails if a generated page is missing. Insurance, not a lever |
| **Redirects** — "preserve the existing 301s" | Already done | Nothing to do |
| **JavaScript rendering** — "increases discovery and interpretation risk" | Was true; now solved, and the concern points the other way | Crawlability is solved by the mirror. What rendering now means is that Google's copy is the *rebuilt* DOM: links and text for Google must be in the card template, and the mirror must be kept identical (`node tools/prerender.js --check` is already in the gate). The verdict sentences are the one thing in neither — see phase two |
| **Fragment ids** *(not in the plan)* | Missing | Make the mirror's ids match the desk's (`#cat-<id>`, `#calc-<id>`) or have the runtime map `#prerender-*` to the desk's ids on load, so a deep link extracted from the static HTML lands on the calculator it names |
| **"Ensure all navigational links are ordinary `<a href>` links available without JavaScript"** | Mostly done | The static block carries the table of contents. Making the sidebar nav static too is optional and low value; reviewers were split on it |
| **"Avoid... hash-only navigation for discoverability"** | Right principle, wrong target | Fragments are correct within the desk and wrong as the only path to a separate page — Google says so. The desk uses them for the former |
| **Internal linking** (Phase 5) | Sound and under-weighted | The actual gap. See the linking rule above: both places, every page, tested |
| **`llms.txt`** — "optional... should not displace real SEO work" | Right | Explicit non-priority. AI answer engines read the same static HTML Google does; what helps them is what is already there — the mirror, clean headings, an author byline — and what is not yet there: the verdict text |
| **Low text-to-HTML ratio, low word count** | Right to dismiss, and now stale | Not ranking targets; the homepage carries about 7,900 static words |
| **404 page** *(not in the plan)* | Cosmetic | Returns a real 404 (confirmed). Its relative `fonts/` paths fail at nested URLs; make them root-relative. No ranking effect |
| **`Cache-Control` for `/fonts/`** *(not in the plan)* | Performance hygiene | Needs the same guarded `mod_headers` block HSTS needs. Do both together or neither |
| **Core Web Vitals** *(not in the plan)* | A strength the plan never recorded | LCP 280–380 ms, CLS 0, no third-party requests. Nothing to fix; do not let a new page regress it |

## Authority and measurement — reviewed

### Measurement: Google Search Console before anything else

The plan lists "connect Google Search Console to Semrush if available" as
step five and asks, in its decisions list, whether GSC is configured at all.
That is backwards. **GSC is the only source of truth for whether Google has
indexed the site, what queries it shows for, and how often.** Semrush
Position Tracking tracks a list you choose; it cannot tell you a page was
never indexed. Until a Domain property for `yazeed.blog` is verified, every
target in this plan is unmeasurable.

Verification is an owner action — a DNS TXT record at Hostinger is cleanest
and touches no page. Then: submit the sitemap; run URL Inspection on the
homepage and record three things — indexed yes/no, the Google-selected
canonical, and whether the rendered HTML shows the calculator headings; read
the Pages report for "indexed" versus "discovered – currently not indexed."
**Day 0 of every target below is the day GSC is verified and the first
subpage is live and linked**; everything before is pre-clock.

Semrush Position Tracking stays — 15–20 terms, US and Saudi, mobile and
desktop — as the second instrument. Split the tracked list into
intent-matched terms (the earned-value cluster, "three point estimate
calculator", "pert calculator", "project management formulas", and the Saudi
earned-value pair) and intent-mismatched ones kept only as controls.

### Backlinks: what the plan proposed and what is realistic

The plan's Phase 6 is principled (no paid links, no directories, relevance
over score) and vague about mechanism. Cold outreach offering a formula
guide to "universities" and "training providers" converts at low single
digits at best, and this domain has nothing yet an editor would cite.

- **Define the unit.** A *relevant referring domain* is a live link, placed
  by a third party without payment or reciprocity, on a page about project
  management, from a domain not among the 31 already documented as spam.
  One number, one definition, one source (the Semrush referring-domains
  report, verified by visiting the page). A directory counts only if a human
  editor reviews and rejects submissions, the listing page is
  project-management-specific, and no payment or reciprocal link is asked.
- **LinkedIn links pass no equity** — they are `nofollow`. Publish there for
  reach and for the author's visibility; count it as zero toward the
  referring-domain target.
- **The linkable asset must exist first.** The earned-value page is the
  first candidate. A PMP formula-sheet page would be stronger: the "project
  management formulas" SERP shows that people link to and discuss exam
  formula sheets. Give it a "cite this page" block (author, credentials,
  title, URL, last reviewed) and an inline `@media print` stylesheet —
  printable without breaking the no-shared-files rule.
- **The differentiator is the Excel export.** Every calculator writes a real
  `.xlsx` with native charts; none of the ranking calculators in the SERPs
  above visibly do. That is the hook for a tool roundup, not "we have a
  calculator too."
- **Targets are people who already link to this kind of thing.** The SERPs
  above are the prospect list — sites that rank calculator or formula
  content and cite sources. Ten, hand-picked, each with a reason the page
  helps *their* reader. Assumption, unverified: that any of them accept
  suggestions.
- **A Saudi/GCC track is missing from the plan.** The author is in Saudi
  Arabia; the earned-value pair carries Saudi volume; PMI KSA chapter
  resources, Saudi PMO communities and local training providers are warmer
  than cold US outreach. Same language, so no `hreflang`.
- **Do not disavow.** The plan is right.

### 30/60/90-day targets: replaced

The plan's targets mix things nobody controls (rankings) with things the
site controls (indexing, content), and set "Site Health above 90" as a
day-30 goal — a Semrush composite Google never sees. The replacement orders
leading indicators before lagging ones and labels confidence. New domains
commonly show little ranking movement for two to four months after content
ships; the lagging rows are ranges, not promises. The absolute floors are
proposals to make the rows testable, not forecasts.

| By (from day 0) | Leading indicators — the site controls these | Lagging indicators — Google decides | Confidence |
|---|---|---|---|
| Day 30 | GSC verified; sitemap processed; homepage and pilot page "URL is on Google" with the apex as Google's canonical; the pilot page linked from the desk in both the card and the mirror; HSTS visible from outside; a re-read Semrush baseline four weeks after the prerender and canonical fix went live | Impressions > 0 for any non-brand query; a search for the site's own name returns it first (if not, indexing is broken, not ranking) | High for the leading column; medium for impressions |
| Day 60 | Position Tracking baseline recorded; first content revision made from real GSC queries; the wave-two page decision made on data | ≥100 impressions in a 28-day window and ≥3 distinct non-brand queries with impressions; impressions for ≥3 of the cluster queries; Semrush detects ≥1 keyword in the top 100 | Medium |
| Day 90 | Second-wave page in progress or shipped; ≥1 outreach conversation with a named target | ≥500 impressions and ≥10 clicks in 28 days; ≥5 target keywords in the top 100; one of {estimate at completion calculator, cost performance index calculator, schedule performance index calculator} in the top 20 (stretch); 1 relevant referring domain (stretch) | Medium for top-100; low for top-20 and links |
| Month 6 | Two or three pages live, each ≥1,000 words of practitioner content; the verdict text made indexable (phase two) | 3–5 relevant referring domains; clicks rising month over month | Low–medium |

The fortnightly review the plan proposed becomes a funnel with a cadence:
weekly, the GSC Pages report (indexed count and reasons), Sitemaps status,
manual actions, and the brand-name query; fortnightly, Performance by query
and by page, and Position Tracking; monthly, referring domains against the
definition above. Semrush Site Health drops out of the review entirely; one
audit after the first pages ship, as a broken-link and duplicate-title
check, is enough.

## Recommendations removed or deprioritised, and why

| Removed | Reason |
|---|---|
| Seven-page first wave | Two pages cannot match their query; three are one cluster; the rest is scaled-content-shaped. Replaced by a one-page pilot |
| Separate CPI, SPI and EAC pages | One calculator, one explanation; the SERPs show single pages ranking for the cluster; three pages would cannibalise each other |
| `/earned-value-management.html` as a third earned-value URL | Whichever page owns earned value grows into the head term; a third page splits it |
| `/critical-path-calculator.html` | The site has no critical-path solver. Intent mismatch confirmed by the top ten |
| `/project-management-formulas.html` as a "content hub" | The query is a PMP exam formula sheet; a calculator hub competes with the homepage and misses the intent. Reframed as a possible wave-two formula reference that also serves as the plan's Phase 6 asset |
| `/risk-matrix-calculator.html` in wave one | HSE-dominated SERP; partial match. Deferred, and if built, as a whole-domain risk page |
| "Site Health above 90" as a day-30 target | Semrush composite; not a Google signal. Hygiene only |
| Semrush Site Audit as Phase 1's first step | Demoted to one post-ship check. GSC is the first step |
| `FAQPage` markup, if it was ever intended | Rich result unavailable to this site since 2023. Q&A stays as prose |
| Backlink targets of 2 by day 60 and 5 by day 90 | Not credible from cold outreach on a domain with no citable asset yet. Replaced by month-6 ranges with low–medium confidence and outreach *activity* measured before links |
| "Printable formula guide offered to universities" as the authority play | Replaced by a web page that matches a real query (PMP formula sheet), which is both the asset and the target |
| HSTS "begin with `max-age=31536000`" | Reverse of the documented rollout; risky on first deployment. Ramp instead |
| "Strengthen the homepage around *project management formulas and calculators*" | Half right: the homepage should become the desk hub, but "project management formulas" is an exam-sheet query the homepage cannot match; do not chase it there |
| The four execution lanes as an SEO recommendation | A sound working arrangement (one owner per file, as `AGENTS.md` requires), not an SEO lever. Moved to the appendix, where it also has to be reconciled with the lane map in `docs/parallel-plan.md` |

## Phase one — the smallest set with most of the impact

Five items, in dependency order. Each has a success metric and a note where
the owner's decision is required. Nothing in phase two starts until items
1–3 are done and item 4 has produced four weeks of data.

| # | Item | Depends on | Success metric | Owner decision? |
|---|---|---|---|---|
| 1 | **Verify Google Search Console** for `yazeed.blog` as a Domain property (DNS TXT at Hostinger); submit `sitemap.xml`; run URL Inspection on the homepage and record indexed / Google-selected canonical / rendered headings visible | — | Property verified; sitemap "Success"; homepage "URL is on Google" with the apex as canonical | Yes — DNS or hosting-panel access |
| 2 | **Ship the earned-value pilot page** from the review branch: apply the six pre-merge fixes listed under *Decision*; add the homepage link in **both** the card template (via `PM_DATA`) and the prerender mirror, with a `tests/pages.js` assertion for it; add the ≥1,000-word prose gate to `tests/pages.js`; confirm the sitemap entry; check CLS in a browser at 390 px; merge; request indexing in GSC | 1 | Page returns 200 live; "URL is on Google" within 14 days; impressions for any earned-value query within 60 days | Yes — approve `tools/calcpage.js` as the sanctioned way to add pages (with the `AGENTS.md` section); approve `.html` URLs; approve the prose |
| 3 | **Re-title the homepage as the hub** so it stops competing with item 2: title, meta description, `og:title`, `og:description`, hero H1 and lede lead with the desk (34 calculators, 14 domains, free, client-side), not with earned value; keep a count phrase in every field `tests/counts.js` checks; re-render `og.png` only if its figures change | 2 | Homepage and pilot page show impressions for different query sets in GSC; no double-listing for one query | Yes — this changes the site's headline framing |
| 4 | **Baseline the measurement**: Position Tracking for ~15 intent-matched terms in US and SA, split from mismatched controls; the weekly / fortnightly / monthly funnel above; a Semrush re-baseline four weeks after the prerender and canonical fix went live | 1 | Baseline recorded with sources; first review completed | No |
| 5 | **Security hygiene in one guarded block**: `<IfModule mod_headers.c>` in `.htaccess` carrying `Header always set Strict-Transport-Security "max-age=300"` and `Cache-Control` for `/fonts/`; verify both headers from outside after deploy; ramp `max-age` on the documented schedule; if the CDN strips them, set HSTS in Hostinger's panel | — | `curl -I` from outside shows both headers; Semrush HSTS notice clears on the next audit | No — but confirm no other subdomains exist before `includeSubDomains` |

Item 5 has no SEO value and is in phase one only because it is small, it is
the last live audit finding, and it shares a block with the fonts header
`AGENTS.md` already asked for.

## Phase two — conditional on phase-one data

Start only when the pilot page is indexed and shows impressions.

- **Make the verdict text indexable.** This is the single content change
  with the widest effect and it is a product decision: either express each
  output's threshold sentences as data beside `interpret()` (a `tiers` array
  the mirror and the card can both print), or write the reading into each
  output's `meaning`. Once done, every calculator on the desk gains the
  plain-English interpretation Google and AI answer engines currently never
  see. Never changes a formula; `tests/baseline.json` proves it.
- **Three-point / PERT page.** Exact intent match; the second-richest card;
  "three point estimate calculator" (KD 0) as the entry term, "pert
  calculator" (390, KD 43) as the long-term one. Needs ≥1,000 words: when
  triangular beats beta, where the 68/95 ranges come from, why the path
  roll-up is not a sum. (Or wave one, per the owner's decision below.)
- **PMP formula-sheet page.** A distinct intent the site does not serve,
  matched to the author's credentials, the plan's Phase 6 asset under a name
  that matches a real query, and the most linkable thing available. Every
  formula on the desk grouped as the exam groups them, each linked to its
  calculator; generated by a sibling of `tools/prerender.js` so it cannot
  drift; printable via an inline print stylesheet; a "cite this page" block.
- **A whole-domain risk page** (risk score, EMV, contingency reserve), only
  if the first two are indexed and earning impressions.
- **Fix the mirror's fragment ids** and the 404 page's font paths — small,
  unglamorous, and better done than listed.
- **One Semrush audit** with the plan's settings (crawl from sitemap, no
  subdomains, JavaScript rendering on), as a broken-link and duplicate-title
  check across the new URLs.
- **Outreach begins here, not before:** ten hand-picked targets, one asset,
  a Saudi/GCC track alongside the US one.

## Decisions required from the owner

1. **Is `tools/calcpage.js` the sanctioned way to add pages** — commit-time
   generation in the `tools/prerender.js` pattern, no serve-time build, each
   page self-contained — with `AGENTS.md` updated to describe the generator,
   `content/`, `tests/pages.js`, the regenerate-after-editing rule and the
   prose gate? *(Blocks phase-one item 2. No architectural exception is
   being asked for.)*
2. **May the homepage headline change from earned-value-first to
   desk-first?** *(Blocks item 3; without it, item 2 should not ship.)*
3. **URL form:** keep `.html` (recommended) or add a guarded rewrite for
   extensionless URLs?
4. **Google Search Console:** who holds DNS or hosting-panel access to verify
   the Domain property?
5. **Market:** US as primary with Saudi as a secondary signal through the
   earned-value page (recommended — same language, no `hreflang`), plus a
   Saudi/GCC outreach track in phase two?
6. **HSTS `includeSubDomains`:** are there any subdomains other than `www`?
7. **Wave one size:** the earned-value pilot alone (recommended), or earned
   value plus three-point/PERT if the owner can write the PERT prose now?
8. **Phase two content:** is a PMP formula-sheet page something the owner
   wants to write and stand behind? It is the strongest candidate and the
   most work.
9. **Verdict text as data:** approve the product change that makes the
   plain-English readings part of the static and rendered page?

## Assumptions and open uncertainties

- Whether Google has indexed the homepage at all is **unknown** until GSC is
  verified. Semrush's zero could mean "not indexed" or "indexed, below 100."
- Whether Hostinger's CDN passes `Header` directives from `.htaccess` to the
  edge is **unverified**; the plan says to check with `curl -I` after deploy.
- Semrush keyword difficulty is calibrated for an average domain; for one
  with Authority Score 0 every KD understates the effort.
- The top-ten SERPs are single-day snapshots (US, 1 September 2026). The
  "eac calculator" and "pert calculator" SERPs were not checked.
- The qualitative backlink reading (`.shop`/`.site`, fabricated anchors) is
  carried from the original plan and was not re-pulled.
- Indexing and ranking lag for new domains is real and unpredictable; the
  day-90 lagging indicators are ranges; the absolute impression and click
  floors are proposals.
- No Traffic Analytics data was available (plan limitation; unchanged).
- Whether any of the outreach targets accept suggestions is unknown.

## Appendix — execution note

The plan's four lanes (technical, homepage, landing pages, editorial QA)
remain a sensible division of file ownership and match the one-owner-per-file
rule in `AGENTS.md`. They are not an SEO recommendation and carry no
priority of their own. Two adjustments: this document supersedes the lane
map in `docs/parallel-plan.md` where the two differ; and the generated
`*.html` pages are not owned by any lane — whoever merges last regenerates
them (`node tools/calcpage.js --all`, `node tools/prerender.js`) as the final
integration step, and `AGENTS.md` edits are in that agent's scope. With a
one-page pilot, only two lanes are live in phase one: one for `.htaccess`,
`sitemap.xml` and GSC; one for `index.html`, `PM_DATA` and the pilot page.

## What changed from the original plan, and why

- **Structural premise corrected.** "33 JavaScript-rendered calculators in an
  empty div" became "34 calculators, about 7,900 words of static HTML, a live
  static mirror." The plan's fallback was already implemented; the decision
  it framed no longer exists in that form.
- **`AGENTS.md` premise corrected.** No one-page rule exists; the wording
  came from two earlier planning documents. The approval question was
  narrowed to the generator pattern.
- **Keyword strategy re-based on who ranks.** Eight live top-ten results
  were added. Critical path dropped (no solver), "project management
  formulas" reframed (exam-sheet intent), risk matrix deferred (HSE intent),
  the earned-value cluster collapsed to one page (competitors rank one URL
  for CPI and SPI), PERT identified as the next exact match, the Saudi signal
  located in earned value.
- **Central recommendation replaced.** Seven pages became a one-page pilot
  measured through Search Console, then a data-gated wave of two or three,
  never more than five in six months, each behind a ≥1,000-word prose gate.
- **Dependencies made explicit.** Homepage retitle before the subpage ships;
  links in both the card template and the mirror; GSC verified before any
  clock starts; the six pre-merge fixes on the draft.
- **A finding the plan could not have made added.** The verdict sentences are
  invisible to Google and to AI answer engines; making them data is the
  widest-effect content change available and is a phase-two product item.
- **Technical recommendations corrected against Google's documentation.**
  HSTS ramped and labelled as hygiene with the `mod_headers` guard and CDN
  caveat; `SoftwareApplication` needs a rating; `FAQPage` and `HowTo` rich
  results are unavailable; breadcrumb defect on the draft; fragment-id
  mismatch; 404 font paths.
- **Measurement re-ordered.** GSC first; Site Health dropped as a KPI; a
  definition of "relevant referring domain"; day 0 defined; leading before
  lagging indicators with labelled confidence; absolute floors as proposals.
- **Authority plan made concrete.** LinkedIn counted as zero; the Excel
  export named as the hook; SERP sites as the prospect list; a Saudi/GCC
  track added; the formula guide merged with the formula-sheet page.
- **Everything the plan got right kept.** The Semrush figures (all
  confirmed on refresh), the acronym analysis, the no-disavow stance, the
  Position Tracking set-up, the page content specification (as a bar rather
  than a checklist), the `llms.txt` and text-ratio non-priorities, the lane
  discipline.
