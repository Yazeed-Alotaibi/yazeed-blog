# Session handoff — yazeed.blog redesign

> Written 2026-08-03 to let a new Claude session continue without re-deriving context.
> Branch: `claude/hello-8zjbmc` (all redesign work lives here; `main` still has the
> original site).

## What this repo is

Static personal site for **Yazeed Alotaibi, RMP · PRINCE2** (Saudi project manager).
Two self-contained HTML pages, no build step, no dependencies beyond Google Fonts:

- `index.html` — landing page: featured tool + roadmap.
- `pm-calculation-desk.html` — 14 domains · 33 interactive calculators · 99 metrics,
  all client-side. The calculator definitions live in one `<script>` block
  (`var PM_DATA = …`), the renderer in a second block. **Never edit the PM_DATA
  block casually — a test suite guards it (see Verification).**

## What was done this session

1. **Merged the two design skills** from branch `claude/ui-ux-pro-max-skill-nhpdfb`
   into this branch: `.agents/skills/ui-ux-pro-max` (searchable design DB + CLI) and
   `.agents/skills/frontend-design` (design-taste guidance), plus `skills-lock.json`.
2. **Generated + recorded the design system** at
   `design-system/yazeed-blog/MASTER.md`. The top "PROJECT OVERRIDES — Drafting
   Sheet" section is **authoritative** and documents every deviation from the
   generated defaults (accent = engineering blue `#2B49C9`, not the DB's pink;
   IBM Plex Sans + JetBrains Mono; light "day drafting" + dark "night shift"
   palettes; signature elements). Read it before styling anything new.
3. **Rebuilt `index.html`** in the drafting-sheet system: mono callout kicker,
   "Tools that show their work." H1, live S-curve hero figure, RMP/PRINCE2 pills,
   one featured tool sheet (14/33/99 stats), "On the drawing board" roadmap list
   (replaced the three dead "coming soon" cards), title-block footer
   (PROJECT/AUTHOR/CONTACT/REV/DATE), favicon + OG + JSON-LD + theme-color,
   theme toggle (`localStorage` key `yz-theme`, no-flash inline script).
4. **Rebuilt the Calculation Desk presentation layer** with the same tokens.
   PM_DATA block byte-identical. Added: back-home link (was one-way before),
   theme toggle, dimension-line category headers, blueprint formula strips, and
   **six live SVG figures** keyed by card id in the renderer's `FIGS` object:
   `earned-value` (S-curve + EAC projection), `three-point` (PERT distribution),
   `float` (early/late windows), `risk-score` (5×5 P–I matrix), `cpk`
   (process vs spec bell), `npv` (cash flows + cumulative NPV + break-even).
   Figures show placeholder-derived "Specimen data" until the card's inputs are
   valid, then switch to "Live data"; values always appear as text (never
   color-only); every SVG uses CSS variables so both themes work.

## How to verify changes (do this after any edit)

- **Formula safety net** — a test suite exists on branch
  `claude/project-review-5yg93n` (`tests/`, `package.json`). Extract it next to the
  two HTML files and run `node --test tests/formulas.test.js` (60 tests) and
  `node --test tests/structure.test.js` (16 tests; needs `index.html` beside the
  desk file — it cross-checks the homepage's 14/33/99 stats against the data).
  All 76 passed at handoff.
- **Contrast** — every token pair was checked ≥ 4.5:1 in both modes (27 pairs, all
  pass). If you change a color, re-check against the palette in MASTER.md.
- **Screenshots** — Playwright with `executablePath:
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` (playwright-core), pages
  at 375/768/1440 in light and dark. No horizontal scroll, no console page errors
  (Google Fonts may fail in sandboxes — that's environmental).

## Design rules being followed (short version)

From the two skills: no emoji as icons (inline SVG only, one 1.5px-stroke family);
150–300ms transitions; visible focus states; `prefers-reduced-motion` respected;
44px touch targets; breakpoints 375/768/1024/1440; semantic tokens, never raw hex
in components; dark mode contrast checked independently; mono + tabular-nums for
all data. Uniqueness axis: the "drafting sheet" concept (dimension-line rules,
milestone diamonds, title-block footers, figure captions "Fig. A — …" with
SPECIMEN/LIVE state). Avoid: warm-cream + serif (the old look), purple gradients,
generic card grids.

## Open items / ideas not yet done

- Roadmap tools (sheets 03–05) are placeholders: Project Status Dashboard,
  AI Scope Statement Generator, WBS Estimation Toolkit.
- More figures could be added to other calculators via the `FIGS` pattern
  (e.g. `crash`, `control`, `velocity`, `littles-law`).
- The 14/33/99 stats are hardcoded in `index.html` (computed live on the desk);
  the structure test catches drift.
- Consider committing the test suite from `claude/project-review-5yg93n` into
  this branch so CI can run it (that branch also has a GitHub Actions workflow).
- User asked to make the repo public — repository visibility can't be changed
  from this environment's tooling; it's a GitHub Settings → Danger Zone action.
