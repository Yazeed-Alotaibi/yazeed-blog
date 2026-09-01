# Operation: four lanes — parallel work plan for yazeed.blog

**Audience:** four Codex agents working simultaneously, plus Yazeed (merges) and
Claude Code (review + AGENTS.md upkeep).
**Supersedes:** `docs/codex-handoff.md` §2 (ownership) and §3 (the static-test
assignment, which moves into Lane B below — note its "expected failure on main"
is stale: the unclosed `@media` is fixed on main as of commit `d118909`, so that
assertion must now PASS on main).
**Still binding:** `AGENTS.md` — hard constraints, design language, publishing
flow. Nothing here overrides it.

---

## 0. Why the plan is shaped like this

The site is **one file**. `index.html` (~5,300 lines) holds the markup, the
stylesheet, and all the JavaScript. Two agents editing it concurrently would
produce a merged file neither verified — in a project whose only rendering test
is a human looking at the page. So:

> **Exactly one lane (Lane A) may edit `index.html`. The other three lanes touch
> zero files that Lane A touches.** Parallelism comes from file isolation, not
> from being careful.

Every lane works in its own worktree on its own branch, pushes its branch, and
**never merges to main** — main is the live site; merging is deploying; Yazeed
deploys.

---

## 1. Lane map

| Lane | Branch | Worktree | Owns (writes) | Mission |
|---|---|---|---|---|
| **A** | `codex/desk-state` | `../yazeed-blog-codex-a` | `index.html`, `og.png`, `design/og-card.source.html` | URL-shareable readings, session restore, Example buttons, `/` shortcut, Earned Schedule card, citations |
| **B** | `codex/test-crush` | `../yazeed-blog-codex-b` | everything in `tests/` | Crush suite runtime and assertion count with zero coverage loss; add the static-integrity tests |
| **C** | `codex/deploy-surface` | `../yazeed-blog-codex-c` | `404.html` (new), `robots.txt` (new), `sitemap.xml` (new), `.htaccess` | Branded 404, crawler files, ErrorDocument wiring |
| **D** | `codex/content-pack` | `../yazeed-blog-codex-d` | `docs/content/` (new dir) | Author the data Lane A wires in: 33 worked examples, the Earned Schedule spec + test vectors, citation lines |

**Files nobody edits:** `AGENTS.md`, `CLAUDE.md`, `pm-calculation-desk.html`,
`wbs-estimation-toolkit.html`, `skills-lock.json`, `.claude/`, `.agents/`,
`docs/` outside `docs/content/` and `docs/lane-reports/`. If your work seems to
require one of these, **stop and write it in your report instead of editing.**
Each lane appends needed `AGENTS.md` wording to its report; Claude Code applies
them in one commit after the final merge (single writer, no doc conflicts).

Setup per lane (from the main checkout):

```bash
git worktree add ../yazeed-blog-codex-<lane> -b codex/<branch> origin/main
```

Ground rules, restated from AGENTS.md because they are the crash barriers:
never `git add -A` (stage your files by name); one agent per file; rebase on
main before publishing (`git pull --rebase origin main`); push your branch only.

---

## 2. Lane A — `index.html`: state, examples, Earned Schedule

The only lane allowed inside `index.html`. Work in this order — each step is a
separate commit, verified before the next. Match the house style exactly:
ES5 (`var`, IIFEs, `'use strict'`), CSS colours only via custom properties,
depth only via `--lip`/`--sunk`, mono numerals, 44px touch targets,
`prefers-reduced-motion` respected, meaning never by colour alone.

### A1. Copy a link to this reading (URL state)

- Each `.calc-card` gets a **"Copy link"** control in its header. Clicking it
  builds `https://yazeed.blog/#<cardId>?key=value&key=value` from that card's
  currently filled inputs only, and copies it (`navigator.clipboard` with a
  hidden-textarea `execCommand('copy')` fallback — ES5). Confirm inline by
  swapping the control's label to "Copied" for ~1.5s; never with colour alone.
- On page load, if `location.hash` matches `#calc-…?…`: parse the query, set
  only keys that card's `inputs` declare (values through `parseFloat`, discard
  non-finite), dispatch `input` events so compute/charts/status run, then
  scroll the card into view. Unknown card id or empty query → behave exactly
  as today.
- Privacy line holds: nothing leaves the browser; a URL is the user choosing
  to share. Do not touch `history` while typing — the hash is built only when
  the button is pressed.

### A2. Session restore (localStorage)

- Debounced (~500ms) autosave of all filled inputs to one versioned key
  (`desk.readings.v1`) as `{cardId: {inputKey: value}}`.
- On load, when saved state exists and no state-hash is present: show a
  dismissible strip above `#calc-sections` — "Readings from your last visit
  are on the desk. **Restore** / **Discard**". Restore fills + dispatches;
  Discard clears the key. Never silently auto-fill; a returning visitor must
  choose. The strip is a `role="region"` with an `aria-label`, buttons ≥44px.
- Wrap every storage read/write in try/catch (private windows throw).

### A3. Worked examples

- Add an `EXAMPLES` object beside `PM_DATA`, populated from **Lane D's**
  `docs/content/examples.json` (see D1) — values pasted in, not fetched;
  the page stays self-contained.
- Each card header gets an **"Example"** ghost button: first press fills the
  example values (+ dispatch), press again ("Clear") empties the card's inputs
  (+ dispatch). This is the fix for the dead-desk first impression: one tap
  and a card demonstrates itself, charts included.
- Integration timing: build the mechanism immediately using the earned-value
  card's values; wire the other 32 when Lane D's pack lands. Do not invent
  values yourself — D's are guard-checked and pedagogically chosen.

### A4. `/` focuses search

`keydown` on document: `/` (no modifiers, target not an input/textarea/select)
→ focus the sidebar search, `preventDefault()`. `Escape` while the search has
focus clears it and restores results.

### A5. Earned Schedule card (from Lane D's spec, D2)

- New calculator in the Earned Value domain implementing ES, SV(t), SPI(t),
  IEAC(t) under a stated linear-PV assumption, with verdict tiers, meanings,
  a how-to, and charts using the existing builders. **Implement exactly what
  `docs/content/earned-schedule-spec.md` says** — formulas, guards, copy,
  vectors. If the spec seems wrong, report; don't improvise.
- **The counts ripple, and this checklist is the hard part.** Adding the card
  makes it 34 calculators / 103 metrics. Every place the old figures appear
  must change in the same commit:
  - hero copy (`33 calculators across 14 domains`), hero figures row
  - `<title>` and `meta description` ("… & 33 PM Calculators")
  - all OG/twitter descriptions and `og:image:alt`
  - JSON-LD
  - **`og.png`**: edit the figures in `design/og-card.source.html`, re-render
    by screenshotting it at 1200×630, commit both. The card's dial geometry
    is already copied from the hero — leave it be.
  - Lane B's counts test (B4) derives truth from `PM_DATA` and greps the
    copy — run the full suite before pushing; it will catch what you missed.

### A6. Citations

Insert Lane D's citation lines (D3) as a small mono footer line per domain
header. Tokens only, no new colours; external links get `rel="noopener"`.

### Lane A gates (all must pass before each push)

1. `node tests/baseline.js && node tests/edge-cases.js && node tests/charts.js`
   (or `node tests/run.js` once Lane B lands).
2. Open the page in a **foreground** tab (AGENTS.md: charts do not draw in
   background tabs — `document.visibilityState === 'visible'` or the check is
   noise) at 1440px, 768px, 390px; light and dark. Fill a card, copy its link,
   open the link in a fresh tab, confirm identical readings.
3. Keyboard-only pass: tab to every new control, operate it, see focus.
4. No new external requests (DevTools network: fonts only), no `let`/`const`/
   arrow functions in the added code, no hex values in new rules.

---

## 3. Lane B — tests: crush time and count, lose nothing

**Baseline, measured 2026-09-01 on main (`d118909`), Node 22:**

| File | Assertions | Wall time |
|---|---|---|
| `tests/baseline.js` | 132 | ~188ms |
| `tests/edge-cases.js` | 7,933 | ~164ms |
| `tests/charts.js` | 2,464 | ~333ms |
| **Total** | **10,529** | **~685ms** |

Two sources of bloat: each file re-parses the 245KB page separately
(`H.loadPage` ×3), and `edge-cases.js` runs **24 rotations** (`SWEEPS = 24`)
of its edge-value tables per card×output — the same guard paths hit over and
over. `charts.js` asserts per-point where per-spec deep-equals would do.

### Targets

- **One command** — `node tests/run.js` — runs everything, parses the page
  **once**, total wall time **< 400ms**.
- **≤ 2,500 assertions total**, with a written guarantee nothing was lost
  (see the manifest below). Individual suite files remain runnable standalone
  for debugging.
- Output stays in the house one-line-summary style per suite.

### B1. Shared runner

`tests/run.js`: load the page once, hand the sandbox to each suite, print each
suite's summary plus a total line with wall time. Keep `harness.js`'s public
API stable so suites stay standalone-runnable (standalone mode loads the page
itself, runner mode receives it).

### B2. Edge-case dedupe

Replace the 24 blind rotations with one deliberate pass per **distinct edge
class**: each divisor input at zero; all inputs zero; each sign-sensitive
input negative; one huge (1e15); one tiny (1e-9); each input empty; each input
malformed (`'abc'`). Same absolute bar (never throw, never NaN/Infinity,
verdicts well-formed) — hit once per class instead of ~24 times.

### B3. Chart assertion consolidation

Assert each builder's spec structurally (one deep-equal per scenario) plus the
boundary points that matter (first, last, extremes, empty-input spec), instead
of a check per datum.

### B4. New coverage (this is where the count is *spent*)

1. **`tests/stylesheet.js`** — from the old handoff §3a, unchanged in spirit:
   brace balance (must now PASS on main), no dangling `var(--token)`, no
   dark-only token, no hex outside `:root`/dark **with two allowlisted
   exceptions**: the `@media print` block (deliberate `#fff`/`#000`/`#999` —
   paper is not the screen palette) and the `#cat-nav` `mask-image` gradients
   (`#000` as an alpha stencil, never painted). Allowlist by enclosing block,
   not by value.
2. **`tests/redirects.js`** — old handoff §3b: every `Rewrite*` directive
   inside the `<IfModule mod_rewrite.c>` guard; stub `meta refresh` targets
   agree with the `.htaccess` 301 destinations. **Coordinate:** Lane C appends
   an `ErrorDocument` line *outside* the guard — that is correct (core Apache,
   not mod_rewrite; it cannot 500 for a missing module the way a bare
   `RewriteRule` can). Your guard test checks `Rewrite*` lines only.
3. **Counts drift check** — count domains/calculators/outputs from `PM_DATA`
   and assert the hero copy, `<title>`, meta descriptions and JSON-LD state
   those numbers. This *enforces* Lane A's A5 checklist forever. (It cannot
   see `og.png`; note that in the report as a manual step.)
4. **Earned Schedule vectors, guarded** — read
   `docs/content/earned-schedule-spec.md`'s vectors (Lane D). If
   `PM_DATA` contains the card, assert them; if not (Lane A not merged yet),
   print "earned-schedule: card not present, vectors skipped" and pass. This
   lets B merge before A and cover A automatically the moment it lands.

### B5. Prove the crush lost nothing

- **Coverage manifest** in your report: behavior class × assertions before ×
  after (e.g. "division guards: 792 → 33 — every divisor still has a zero
  probe").
- **Mutation smoke test**: copy `index.html` to a temp dir, flip one operator
  in three different formulas (e.g. a `/` to `*`), point the runner at the
  copy, and show the suite failing all three. A crushed suite that still
  kills mutants is smaller, not weaker. Include the transcript in the report.

---

## 4. Lane C — deploy surface: 404, crawler files, ErrorDocument

New files only, plus a guarded append to `.htaccess`. Nothing here touches
`index.html`.

### C1. `404.html`

- Fully self-contained (inline CSS, same Google Fonts request pattern, tokens
  and font stack **copied from `index.html`'s `:root`** — pages do not share
  files). Light + dark via `prefers-color-scheme`.
- On-brand: the bench metaphor — a small instrument face reading nothing /
  needle at rest, "READING NOT FOUND" in the display face, one line of body
  copy, two links ≥44px: back to `/` and to `/#calc-sections`. No JS needed;
  if you add any, ES5 only. Keep it under ~10KB.

### C2. `robots.txt`

```
User-agent: *
Allow: /
Sitemap: https://yazeed.blog/sitemap.xml
```

### C3. `sitemap.xml`

Single-URL sitemap for `https://yazeed.blog/` with `lastmod` (the retired stub
pages 301 and must not be listed).

### C4. `.htaccess`

Append **after** (outside) the `<IfModule mod_rewrite.c>` block:

```apache
# Branded not-found page. ErrorDocument is core Apache, not mod_rewrite, so it
# sits outside the guard above on purpose: it cannot 500 for a missing module
# the way a bare RewriteRule can. It needs the same AllowOverride FileInfo the
# rewrites already rely on, so if the rules above work, this works.
ErrorDocument 404 /404.html
```

Do not touch the existing rules. Then run the guard check from AGENTS.md (the
awk one-liner) and paste its output in your report — every `Rewrite*` line
must still say `inside`.

### Lane C gates

Open `404.html` in a foreground browser tab at desktop and 390px, light and
dark; tab through the links. Run the awk guard check. Note in your report that
the live `curl -o /dev/null -w "%{http_code}" https://yazeed.blog/no-such-page`
→ `404` check happens post-merge (no Apache in the worktree).

---

## 5. Lane D — content pack: the data Lane A wires in

No site code. Three deliverables in `docs/content/`, precise enough that Lane A
can integrate without judgement calls. You are writing for a PMI-RMP/PRINCE2
audience — get the terminology exactly right.

### D1. `examples.json` — worked examples for all 33 cards

```json
{ "calc-earned-value": { "values": { "bac": 200000, "pv": 120000, "ev": 108000, "ac": 96000 },
                          "note": "Six months in: efficient spend, behind schedule." } }
```

- One entry per card id in `PM_DATA` (read ids from `index.html`; read-only).
- Every value set must pass the card's guards (no division by zero, no
  overflow) — **verify by tracing each card's `compute()` by hand or with a
  10-line node script against the real page** (`tests/harness.js` loadPage
  gives you the sandbox; using it read-only is fine).
- Pedagogy: across the 33, mix the verdicts — some healthy, some warn, some
  bad. An all-green desk teaches nothing. Values realistic for mid-size
  projects (riyal/dollar-scale budgets, week-scale durations), and every
  `note` ≤ 90 chars, plain English.

### D2. `earned-schedule-spec.md` — the complete card spec

Must contain, in the repo's voice:
- Rationale copy for the card (why SPI lies near project end; ES fixes it).
- Inputs: `bac`, `pd` (planned duration, periods), `at` (actual time,
  periods), `ev` — labels, helper text, units ("periods" kept unit-agnostic).
- Formulas with guards, exactly:
  `ES = PD × (EV ÷ BAC)` (BAC > 0); `SV(t) = ES − AT`;
  `SPI(t) = ES ÷ AT` (AT > 0); `IEAC(t) = PD ÷ SPI(t)` (SPI(t) > 0).
  State the linear-PV assumption loudly in the card copy — it is the honest
  limit of a four-input version.
- Verdict tiers for SPI(t) mirroring the existing SPI tiers, with fresh
  wording; meanings for each output; a 3-step "How to use it".
- Chart spec using the **existing** builders only (read `charts.js`/the page
  to see what they accept).
- ≥ 6 test vectors (inputs → all four outputs to 2dp), including one guard
  case per guard. Lane B consumes these mechanically (B4.4) — format them as
  a fenced JSON block.
- The counts ripple, stated: 33 → 34 calculators, 99 → 103 metrics, domains
  unchanged — so Lane A's A5 checklist and the og.png re-render trigger.

### D3. `citations.md`

One line per domain (14 lines), naming the governing source — e.g. PMI's
*Practice Standard for Earned Value Management* for EVM, *PRINCE2* for stage
controls, the *PMBOK Guide* edition for the general formulas, Lipke's earned
schedule literature for D2. Exact strings Lane A pastes verbatim, ≤ 80 chars
each, with a URL only where a canonical free one exists.

---

## 6. Coordination

### Dependency graph

```
B ──────────────┐
C ──────────────┼──► merge anytime, any order (independent)
D ──► A3/A5/A6 ─┘    A's mechanisms (A1,A2,A4) start immediately;
                     A's content steps wait for D's pack
```

### Merge order (Yazeed executes, per AGENTS.md publishing flow)

1. **B**, then **C**, then **D** — any time their gates pass, rebase first.
2. **A last**, after D is merged and A has rebased onto everything
   (`git pull --rebase origin main`) and re-run the full gate list — B's
   counts test and ES vectors will be judging A's work by then, which is the
   design.
3. After A merges: Claude Code applies the collected `AGENTS.md` deltas from
   the four lane reports in one commit (new files table rows, test list, the
   ErrorDocument note, the og.png re-render reminder already there).

Only A and C change what deploys (`index.html`, `og.png`, `404.html`,
`robots.txt`, `sitemap.xml`, `.htaccess`). B and D are repo-only. Every merge
to main goes live in ~2 minutes; verify per AGENTS.md (`cmp` against the
commit, not eyeballing — except `og.png`, which the host re-encodes, so
compare it by opening, not by `cmp`).

### Reports

Each lane writes `docs/lane-reports/lane-<a|b|c|d>.md` before its final push:
what shipped, gate transcripts, the AGENTS.md lines to add, and anything you
noticed outside your lane **as notes, never edits**.

### Collision protocol

If you find yourself needing a file outside your "Owns" column: stop, write
the need in your report, keep working on what remains. If two lanes discover
they want the same new filename, the lane listed first in §1 keeps it.
Codex agents do not resolve merge conflicts on main — there should be none
(the ownership matrix is disjoint); if one appears anyway, stop and report,
because it means someone left their lane.

### Definition of done, whole operation

- main carries all four lanes; live site verified per AGENTS.md.
- `node tests/run.js` < 400ms, ≤ 2,500 assertions, mutation smoke kill
  transcript on file, counts test green against the 34-calculator page.
- A shared link opens someone else's reading; a returning visitor is offered
  their desk back; every card can demonstrate itself; `/` finds; Earned
  Schedule answers the criticism a senior EVM reviewer would raise; a lost
  URL lands on a branded 404; crawlers get robots + sitemap; `og.png` says 34.
