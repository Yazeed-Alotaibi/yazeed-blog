# Repository index

Every tracked file in this repository, one line each, grouped by what it is for.
91 files are tracked; 47 of those entries are vendored agent skills, summarised as a group
at the end rather than listed individually.

`AGENTS.md` remains the source of truth for *rules* — what may and may not be
done. This file only answers "what is this file?".

---

## Deployed — what Hostinger serves at yazeed.blog

Everything in this table sits at the repository root and goes live on a push to
`main`. Nothing else in the repository is served.

| File | What it is |
|---|---|
| `index.html` | The whole site, 268 KB, self-contained. Sidebar shell, hero with a live earned-value gauge, About/Record section, and 14 domains · 33 calculators · 99 metrics rendered from a `PM_DATA` object. CSS and JS inline; no build step |
| `404.html` | The not-found page — "Reading not found", styled as a resting instrument with the same tokens and font stack copied from `index.html`. Links back to `/` and `/#calc-sections` |
| `og.png` | The 1200×630 link-preview card. A rendered artifact, not hand-drawn — see `design/og-card.source.html`. Re-render it whenever the figures on it (14 · 33 · 99) stop being true |
| `.htaccess` | The one piece of host config. Apache 301s for three non-canonical addresses: `www.yazeed.blog`, and the two retired tool pages. Every directive must sit inside `<IfModule mod_rewrite.c>` — see AGENTS.md for the check |
| `robots.txt` | Allows everything, points crawlers at the sitemap |
| `sitemap.xml` | One URL: `https://yazeed.blog/`. `lastmod` is hand-maintained |
| `pm-calculation-desk.html` | Redirect stub for the retired Calculation Desk page → `/#calc-sections`. The `.htaccess` 301 means nothing normally reaches it; it is the fallback if mod_rewrite disappears |
| `wbs-estimation-toolkit.html` | Redirect stub for the retired WBS toolkit → `/#calc-sections`. Same fallback role. The full page is recoverable from git history |

## Instructions for agents

| File | What it is |
|---|---|
| `AGENTS.md` | Source of truth for both Claude Code and Codex — what the project is, hard constraints, design language, testing, concurrency rules, publishing |
| `CLAUDE.md` | Three lines: a pointer that imports `AGENTS.md`. Edit `AGENTS.md`, never this |

## Tests

Plain `node`, no dependencies. They read the shipped `index.html` and extract its
script blocks, so they test what visitors actually run rather than a copy of it.
**They render nothing** — a green run is not evidence that a chart draws.

| File | What it is |
|---|---|
| `tests/run.js` | The runner. Executes the seven suites below in order |
| `tests/harness.js` | Shared plumbing — loads the page, extracts `<script>` blocks into a sandbox, exposes `PM_DATA` and the card walkers every suite uses |
| `tests/baseline.js` | Snapshots every calculator's output for its own worked example, so a refactor has to prove it changed nothing. `--write` regenerates deliberately |
| `tests/baseline.json` | The committed snapshot `baseline.js` checks against |
| `tests/edge-cases.js` | One pass per deliberate input class. The bar for every output: no throw, no NaN/Infinity, well-formed verdict |
| `tests/charts.js` | Chart *builders* compared against exact characterized specs, plus point-series boundaries and a no-throw/no-NaN edge pass |
| `tests/charts-baseline.json` | The characterized chart specs — 27 KB, the largest test fixture |
| `tests/stylesheet.js` | Integrity of the inline CSS (this is the suite that would catch an unclosed `@media`) |
| `tests/redirects.js` | Checks the two stub pages still carry a `<meta http-equiv="refresh">` to the right target |
| `tests/counts.js` | Verifies the published counts — the 14 · 33 · 99 figures in the meta tags and copy match the actual `PM_DATA` |
| `tests/earned-schedule.js` | Vectors for the proposed `earned-schedule` card. Currently self-skips — the card is not in `index.html`, so this suite reports "card not present, vectors skipped" and passes |
| `tests/mutation-smoke.js` | Mutates `index.html` in a temp copy (e.g. breaks the CPI division guard) and asserts the suite goes red. A test of the tests |

## Docs

| File | What it is |
|---|---|
| `docs/parallel-plan.md` | The four-lane parallel work plan — the operative plan for multi-agent work. Supersedes `codex-handoff.md` §2–§3 |
| `docs/lane-prompts.md` | The four self-contained prompts pasted into each Codex CLI, one per lane |
| `docs/codex-handoff.md` | The earlier two-agent work order. **Superseded** 2026-09-01 by `parallel-plan.md`; kept for the reasoning in §1, which still governs |
| `docs/lane-reports/lane-b.md` | Lane B's report — test crush and integrity coverage |
| `docs/lane-reports/lane-c.md` | Lane C's report — deploy surface (`404.html`, `.htaccess`, `robots.txt`, `sitemap.xml`) |
| `docs/lane-reports/lane-d.md` | Lane D's report — the content pack |
| `docs/content/examples.json` | One worked example per `PM_DATA` card, mixed across healthy/warning/adverse readings. Notes are plain English, ≤90 characters |
| `docs/content/verify-examples.js` | Checks every example in `examples.json` against the live card logic. Runs on the test harness |
| `docs/content/earned-schedule-spec.md` | Specification for a proposed `earned-schedule` card and its four outputs. **Not yet built** — no such card exists in `index.html` |
| `docs/content/citations.md` | Source per domain — which PMI standard or paper each family of formulas comes from |
| `docs/superpowers/specs/2026-08-06-concurrent-agents-design.md` | Approved design for running Claude Code and Codex on this repository simultaneously |
| `docs/superpowers/specs/2026-08-06-wbs-estimation-toolkit-design.md` | Approved design for the WBS Estimation Toolkit, since retired into the redirect stub |
| `docs/INDEX.md` | This file |

## Design

Working files for the design canvas and the OG card. None of these deploy.

| File | What it is |
|---|---|
| `design/canvas.json` | The canvas manifest — artboard positions, sizes, and the annotations stating each option's trade-off |
| `design/Main.dc.html` | Artboard: "Desk-first (leading)" — no gauge, no About, calculators within one screen |
| `design/Instrument.dc.html` | Artboard: "Instrument-first (alternate)" — keeps the live gauge, so the page demonstrates itself before describing itself |
| `design/Card.dc.html` | Artboard: a single calculator card in each of its states |
| `design/og-card.source.html` | The page `og.png` is screenshotted from at 1200×630. Its dial geometry is copied from the hero instrument, so the card shows a real reading |
| `design/_polish-preview.html` | Standalone polish preview |

`design/calculation-desk.html` is deliberately **not** tracked — it is ~2.5 MB of
editor payload wrapped around the `.dc.html` sources. Regenerate it rather than
committing it (see `.gitignore`).

## Tooling and vendored skills

| Path | What it is |
|---|---|
| `.claude/launch.json` | One config: serve the repo with `python -m http.server 4173`. How you open the site locally |
| `skills-lock.json` | Pins the two vendored skills to a source repo and content hash |
| `.gitignore` | OS cruft, logs, `.env`, `node_modules/`, Python bytecode from skill scripts, and the generated design canvas |
| `.gitattributes` | One rule: LF normalisation on text files |
| `.agents/skills/frontend-design/` | Vendored skill (2 files) — aesthetic direction, typography, avoiding templated defaults |
| `.agents/skills/ui-ux-pro-max/` | Vendored skill (43 files, ~1.7 MB) — `SKILL.md`, CSV databases for styles/colors/fonts/icons/charts, per-stack reference CSVs, and Python search scripts |
| `.claude/skills/frontend-design`<br>`.claude/skills/ui-ux-pro-max` | **Symlinks** into `.agents/skills/`, not copies. Both agents read one set of files; editing either path edits the same content |

## What is deliberately absent

No `package.json`, no lockfile, no `node_modules/`, no bundler config, no CI
workflow, no `CNAME`. Their absence is the design, not an oversight — see the
hard constraints in `AGENTS.md`.
