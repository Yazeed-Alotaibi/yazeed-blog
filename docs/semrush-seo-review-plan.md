# yazeed.blog Semrush SEO Review and Implementation Plan

**Prepared:** 1 September 2026  
**Purpose:** Independent critique by other models before implementation  
**Scope:** Semrush evidence, current source structure, and live HTTP behavior  
**Status:** Recommendation only; no SEO implementation has been performed

## Executive conclusion

The primary SEO problem is not the homepage title or meta description. It is the combination of:

1. No measurable organic rankings in Semrush.
2. One indexable URL serving 33 JavaScript-rendered calculators.
3. Almost no useful backlink authority despite 31 reported referring domains.
4. No Position Tracking campaign, making progress difficult to measure.

The highest-impact recommendation is to publish a small set of crawlable, keyword-specific calculator pages while retaining the homepage as the central calculation desk. This would require explicit approval to change the project's documented one-file architecture.

If the one-page constraint must remain, the fallback is to place the calculator headings, descriptions, formulas, examples, and navigation in static HTML and progressively enhance them with JavaScript. That should improve crawlability but will still limit the site's ability to rank one URL for many distinct calculator intents.

## Evidence reviewed

### Semrush coverage completed

The review checked the available Semrush surfaces for:

- Domain overview and ranking history
- Organic keywords
- Site Audit summary, snapshot, issue definitions, and affected URLs
- Backlink overview, history, anchors, referring domains, Authority Score distribution, TLDs, countries, categories, and linked pages
- Keyword volume, difficulty, intent, related phrases, questions, and current SERPs
- Organic competitors
- Semrush projects and Position Tracking campaigns

Traffic Analytics was unavailable because the current Semrush plan does not include MCP access for that feature.

### Organic visibility

Semrush reported:

- **0 organic keywords** in the US database.
- **0 estimated organic traffic** in the US database.
- **0 organic keywords** in the Saudi database.
- **0 estimated organic traffic** in the Saudi database.
- No measurable ranking history through 15 August 2026 in either database.
- No domain-level organic competitors because the site has no measurable ranking-keyword overlap.

This does not prove that Google has indexed nothing. It means Semrush has not detected the domain in the top 100 results for keywords in those databases. Google Search Console should be treated as the source of truth for indexing, impressions, and clicks.

### Site Audit

The only available audit snapshot finished on 31 July 2026 at 22:08 UTC. It reported:

- Site Health: **75**
- Pages crawled: **7**
- Errors: **14**
- Warnings: **11**
- Notices: **6**

Reported issues included:

| Issue | Count | Audit interpretation |
|---|---:|---|
| 4xx responses | 2 | `robots.txt` and `sitemap.xml` |
| Duplicate titles | 4 | Apex/`www` and retired calculator variants |
| Duplicate content | 4 | Apex/`www` and retired calculator variants |
| Duplicate descriptions | 4 | Apex/`www` and retired calculator variants |
| H1 duplicates title | 2 | Retired calculator variants |
| Low text-to-HTML ratio | 4 | Homepage and retired variants |
| Low word count | 4 | Homepage and retired variants |
| Sitemap not found | 1 | `sitemap.xml` |
| Robots file not found | 1 | `robots.txt` |
| HSTS missing | 2 | Apex and `www` |
| Only one internal link | 2 | Retired calculator variants |
| `llms.txt` missing | 1 | Informational only; not an SEO requirement |

#### Stale audit findings

Live validation on 1 September 2026 found:

- `https://yazeed.blog/robots.txt` returns 200.
- `https://yazeed.blog/sitemap.xml` returns 200.
- `https://www.yazeed.blog/` redirects to the apex with 301.
- Both retired calculator URLs redirect with 301 to the calculator section.
- The homepage returns 200 to normal, Googlebot, and SemrushBot user agents.
- No `X-Robots-Tag` blocking header was observed.

Therefore, the missing robots/sitemap findings and the duplicate-host/retired-page findings should not be treated as current defects until a fresh audit reproduces them.

The live response did not include a `Strict-Transport-Security` header, so the HSTS notice remains current.

### Current source structure

Current strengths:

- Descriptive title and meta description
- Apex canonical URL
- Open Graph metadata and share image
- `WebApplication` structured data with author information
- HTTPS
- Valid `robots.txt`
- Valid XML sitemap
- Server-side canonical-host and retired-page redirects

Primary structural limitation:

- `sitemap.xml` lists only the homepage.
- The calculator section is an empty `<div id="calc-sections"></div>` in the initial HTML.
- Calculator headings and content are constructed from the JavaScript `PM_DATA` object.
- The 33 calculators therefore share one canonical URL and cannot each target a distinct search intent.

Google can render JavaScript, but relying on rendering increases discovery and interpretation risk. More importantly, JavaScript rendering does not solve the one-URL-to-many-intents problem.

### Backlink profile

Semrush reported:

- Total backlinks: **32**
- Referring domains: **31**
- Follow links: **10**
- Nofollow links: **22**
- Domain Authority Score: **0**

Authority distribution:

| Referring-domain Authority Score | Domains |
|---:|---:|
| 0 | 7 |
| 2 | 18 |
| 3 | 3 |
| 4 | 1 |
| 5 | 1 |
| 6 | 1 |

Additional quality signals:

- 16 referring domains use `.shop`.
- 6 use `.site`.
- Semrush categorized referring sites mainly under unrelated beauty and travel topics.
- Many anchors make fabricated claims about Fiverr, Upwork, guest posting, traffic growth, or ranking success.

Conclusion: the reported backlink count should be treated as effectively near zero useful authority.

Do not automatically create a disavow file. Search engines commonly ignore obvious spam. Disavowal should be considered only if Google Search Console shows a manual action or there is evidence that manipulative links were deliberately acquired.

## Keyword opportunity analysis

### Recommended first-wave targets

| Keyword | US monthly volume | US difficulty | Saudi monthly volume | Recommendation |
|---|---:|---:|---:|---|
| estimate at completion calculator | 40 | 2 | No reported data | Highest-priority calculator page |
| project management formulas | 70 | 8 | 10 | Highest-priority content hub |
| cost performance index calculator | 110 | 10 | No reported data | High-priority calculator page |
| schedule performance index calculator | 90 | 16 | No reported data | High-priority calculator page |
| earned value formulas | 40 | 19 | 140 | High priority, especially for Saudi visibility |
| critical path calculator | 140 | 22 | 20 for the method variant | High-priority calculator page |
| risk matrix calculator | 90 | 23 | 10 | High-priority calculator page |
| earned value management | 3,600 | 35 | 170 | Pillar article; stronger competition |
| PERT calculator | 390 | 43 | No reported data | Second-wave page |

### Ambiguous keywords to avoid as primary targets

#### CPI calculator

- US volume: 14,800
- Difficulty: 85
- Search intent is heavily associated with the Consumer Price Index.

Recommendation: target **cost performance index calculator** and use CPI as a secondary abbreviation.

#### SPI calculator

The SERP mixes Schedule Performance Index with investment SIP calculators and other meanings.

Recommendation: target **schedule performance index calculator** and use SPI secondarily.

#### EAC calculator

The SERP mixes Estimate at Completion, Equivalent Annual Cost, educational institutions, and unrelated calculators.

Recommendation: target **estimate at completion calculator** and state the project-management meaning in the title, H1, description, and introductory copy.

### Question opportunities

Useful question clusters found by Semrush include:

- What is earned value management?
- How do you calculate earned value?
- How do you calculate EAC in project management?
- How do you calculate SPI?
- How do you calculate CPI and SPI?
- How do you calculate the critical path?
- How do you calculate critical path and project duration?

These should become visible explanatory sections, not hidden keyword lists.

## Recommended implementation plan

### Phase 1: Establish a reliable baseline

1. Configure a new Semrush Site Audit:
   - Start URL: `https://yazeed.blog/`
   - Crawl from sitemap: enabled
   - Crawl subdomains: disabled
   - JavaScript rendering: enabled
2. Run the audit again and confirm that the stale findings disappear.
3. Configure Position Tracking for the US and Saudi Arabia.
4. Track 15–20 priority terms on mobile and desktop.
5. Connect Google Search Console to Semrush if available.
6. Record the baseline:
   - Site Health
   - Valid indexed URLs
   - Search impressions and clicks
   - Ranking keywords
   - Relevant referring domains

#### Completion criteria

- Position Tracking is active.
- The new audit sees the canonical apex host.
- `robots.txt` and `sitemap.xml` pass.
- Retired URLs are reported as permanent redirects rather than duplicate pages.

### Phase 2: Resolve current technical issues

1. Add HSTS after verifying that every required subdomain supports HTTPS.
2. Begin with `max-age=31536000`; add `includeSubDomains` only when safe.
3. Do not submit the domain to the HSTS preload list during the first implementation.
4. Preserve the existing 301 redirects.
5. Ensure every indexable URL has:
   - One canonical URL
   - One unique title
   - One unique meta description
   - One descriptive H1
   - Open Graph metadata
   - Valid structured data
6. Ensure all navigational links are ordinary `<a href>` links available without JavaScript.
7. Rerun Semrush and investigate any remaining 4xx, duplicate, canonical, or structured-data findings.

#### Explicit non-priorities

- `llms.txt` is optional and should not displace real SEO work.
- The low text-to-HTML ratio is not a direct ranking target. The site intentionally contains inline CSS and JavaScript. Improve indexable content instead of optimizing the ratio as a score.

### Phase 3: Decide the content architecture

#### Recommended option: crawlable landing pages

Create this first wave of self-contained static pages:

1. `/project-management-formulas.html`
2. `/earned-value-management.html`
3. `/cost-performance-index-calculator.html`
4. `/schedule-performance-index-calculator.html`
5. `/estimate-at-completion-calculator.html`
6. `/critical-path-calculator.html`
7. `/risk-matrix-calculator.html`

Each page can remain dependency-free, client-side, and self-contained. No framework, build step, backend, analytics, telemetry, or CDN script is required.

This option conflicts with the repository's current documented premise of one main HTML page. Implementation therefore requires explicit architectural approval and an update to the project documentation.

#### Constraint-preserving fallback: static homepage content

If no additional pages are allowed:

1. Move calculator headings, formulas, explanations, examples, and section navigation into static HTML.
2. Make the existing JavaScript enhance those elements instead of constructing all content from an empty container.
3. Give every calculator a stable fragment identifier.
4. Add a visible static calculator directory near the top of the document.
5. Strengthen the homepage around the combined target **project management formulas and calculators**.

This improves crawlability but does not create separately indexable calculator URLs. Expected ranking coverage should therefore be lower than with dedicated pages.

### Phase 4: Build each search landing page

Every first-wave page should contain:

1. A keyword-specific title of approximately 50–60 characters.
2. A concise, benefit-led meta description.
3. One descriptive H1.
4. The working calculator near the top.
5. The formula and definitions of every variable.
6. A complete worked numerical example.
7. A plain-language interpretation of the result.
8. Guidance on when to use the formula.
9. Common mistakes, assumptions, and edge cases.
10. Three to five visible question-and-answer sections.
11. Links to two or three related calculators.
12. Citations to authoritative project-management references where appropriate.
13. `WebApplication` and `BreadcrumbList` structured data.

Example title:

> Estimate at Completion Calculator — EAC Formula & Example

Avoid thin pages containing only an input form and a short paragraph.

### Phase 5: Establish internal linking

1. Keep the homepage as the primary hub.
2. Link to each landing page using descriptive anchor text.
3. Add breadcrumbs to each landing page.
4. Link related calculators together contextually.
5. Link every child page back to its topic hub.
6. Add all canonical landing pages to the XML sitemap.
7. Avoid relying on JavaScript event handlers or hash-only navigation for discoverability.

Suggested anchors include:

- cost performance index calculator
- calculate schedule performance index
- estimate at completion calculator
- critical path method calculator
- project management formulas

### Phase 6: Build legitimate authority

1. Publish a reference-quality Project Management Formula Guide.
2. Make the guide printable and easy to cite.
3. Offer it to:
   - Project-management educators
   - Training providers
   - Universities
   - PM communities
   - Professional resource directories
4. Publish supporting LinkedIn articles that link to the most relevant page.
5. Seek inclusion in carefully selected project-management tool roundups.
6. Avoid paid link packages, automated guest-post networks, and generic directory submissions.

Initial outreach target: **5–10 genuinely relevant referring domains**, prioritizing relevance and editorial context over raw Authority Score.

### Phase 7: Measure and iterate

Review every two weeks:

- Semrush Site Health
- Position Tracking visibility
- New, improved, declining, and lost keywords
- Search Console indexed pages
- Search impressions, clicks, CTR, and average position
- Relevant referring domains
- Landing pages receiving organic impressions

Update pages based on real query data rather than publishing many speculative pages at once.

## Proposed 90-day targets

These are directional operating targets, not ranking guarantees.

### By day 30

- Fresh Semrush audit completed.
- Site Health above 90, excluding accepted low-value notices.
- Position Tracking active for 15–20 keywords.
- All intended landing pages submitted and indexable.
- No unresolved canonical-host, sitemap, robots, or retired-page duplication.

### By day 60

- At least five target keywords detected in the top 100.
- Search Console impressions increasing from baseline.
- At least two relevant editorial referring domains acquired.
- First content revisions completed from query data.

### By day 90

- At least ten target keywords detected in the top 100.
- At least three low-difficulty target terms in the top 20.
- At least five relevant referring domains acquired.
- Organic clicks and impressions increasing month over month.

## Suggested execution lanes

To avoid file conflicts, assign one owner per file.

### Lane A: Technical and measurement

- Configure Semrush audit and Position Tracking.
- Validate HTTP behavior and HSTS.
- Own `.htaccess`, `robots.txt`, and final sitemap changes.

### Lane B: Homepage and internal linking

- Own `index.html`.
- Add crawlable navigation and hub content.
- Implement homepage links after landing-page URLs are final.

### Lane C: Search landing pages

- Create the approved standalone pages.
- Assign each page file to one agent only.
- Apply the shared content and structured-data specification.

### Lane D: Editorial authority and QA

- Review content for accuracy, search intent, and duplication.
- Build the outreach list and linkable formula guide.
- Run final Semrush and browser verification after integration.

With the default DevFleet limit of three concurrent agents, the fourth lane should queue unless the concurrency limit is increased.

## Decisions required before implementation

1. May the site expand beyond one primary HTML page?
2. Should the initial market target be US English, Saudi English, or both?
3. Is the preferred first wave seven pages, or a smaller three-page pilot?
4. Is Google Search Console already configured for the apex domain?
5. Should the Project Management Formula Guide be a web page, printable HTML, or a separate downloadable artifact?

## Items for external critique

Reviewers should challenge:

1. Whether dedicated landing pages justify changing the one-page premise.
2. Whether the selected keyword set correctly balances search volume, intent, and difficulty.
3. Whether any first-wave page would create overlapping or cannibalizing intent.
4. Whether the 90-day targets are realistic for a domain with Authority Score 0.
5. Whether the backlink strategy is sufficiently specific and defensible.
6. Whether static HTML progressive enhancement could achieve enough visibility without multiple URLs.
7. Whether any recommendation adds complexity without measurable SEO value.

## Semrush coverage limitation

Traffic Analytics could not be checked because the current Semrush plan does not support MCP access for that feature. Available plans can be reviewed at <https://www.semrush.com/analytics/traffic/trends-api>.
