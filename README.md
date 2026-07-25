# yazeed.blog

Project management tools and resources, published at **[yazeed.blog](https://yazeed.blog)**.

A static site with no build step, no framework and no runtime dependencies —
two hand-written HTML files that can be opened straight from disk.

| File | What it is |
| --- | --- |
| `index.html` | Landing page and tool directory |
| `pm-calculation-desk.html` | The Project Manager's Calculation Desk — 14 domains, 33 calculators, 99 live-computed metrics |

## The Calculation Desk

One self-contained page holding every formula behind a project decision:
earned value, PERT, float, crashing, EMV, decision trees, Six Sigma, NPV/IRR,
FPIF/CPIF contract settlement, agile forecasting and Little's Law. Each
calculator explains what it measures, what every input means, and how to read
the result — the interpretation is the point, not just the arithmetic.

Everything computes locally in the browser. No data is sent anywhere.

### How the page is put together

Two inline `<script>` blocks, in this order:

1. **`PM_DATA`** — pure data. An array of categories, each holding calculator
   cards. Every card carries its own teaching copy (`about`, `formula`) plus
   `inputs` and `outputs`. Each output owns a `compute(v)` function and an
   `interpret(value, v)` function that returns a `{ tone, text }` verdict.
   This block touches no DOM, which is what makes it testable.
2. **The renderer** — reads `PM_DATA`, builds the sidebar nav and one card per
   calculator, and recomputes that card's outputs on every keystroke.

Styling is a single `:root` custom-property palette (warm paper, ink
typography, dark "chalk" formula strips) with semantic tones — `good`, `warn`,
`bad`, `info` — reserved for interpretation.

## Local preview

No build, no install. Either open the file directly:

```sh
open index.html          # macOS  ·  xdg-open on Linux  ·  start on Windows
```

…or serve the folder, which better matches production:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Web fonts (Fraunces, Inter) load from Google Fonts, so type falls back to
Georgia/system sans when offline. Everything else works with no network.

## Tests

The value of this site rests entirely on the math being right, so the 99
compute functions are tested. Requires Node 20+ (where `node:test` is stable);
there are no dependencies to install.

```sh
npm test        # or: node --test
```

| File | Covers |
| --- | --- |
| `tests/load-data.js` | Lifts `PM_DATA` out of the HTML with `node:vm` and exposes `compute()` / `verdict()` helpers |
| `tests/formulas.test.js` | Numeric correctness, calculator by calculator |
| `tests/structure.test.js` | Invariants across all 99 outputs at once |

Expected values in `formulas.test.js` are derived by hand from the standard
PMBOK / PMP-exam formulas rather than recorded from the page's own output — a
test that just captures current behaviour would happily lock in a wrong
formula. Where a textbook worked example exists it is used as the anchor
(3-4-5 path sigma; 6,210 DPMO ≈ 4σ; a 500 × 3 annuity on 1,000 → IRR ≈ 23.4%).

`structure.test.js` enforces the contract the renderer silently depends on:
unique card and output keys, every input and output fully labelled, an
untouched form computing `null` rather than `NaN`, no compute function
throwing on hostile input, no unguarded division by zero, and every verdict
using a tone the stylesheet defines. It also checks that the counts advertised
on the homepage still match the data — so adding a calculator without updating
that card fails the build instead of quietly making the site lie.

## Adding a calculator

1. Add a card object to the relevant category in the `PM_DATA` block of
   `pm-calculation-desk.html`. Give it a unique `id` — it becomes the
   `calc-<id>` anchor. Fill in `about`, `formula`, `inputs` and `outputs`;
   every input needs a `label`, `meaning` and `placeholder`, and every output
   needs a `label`, `meaning`, `compute` and `interpret`.
2. Guard every division: return `null` when a denominator is zero or an input
   is missing, so the field shows `—` instead of `NaN` or `Infinity`.
3. Add a case to `tests/formulas.test.js` with a hand-derived expected value.
4. Update the `stat-num` figures on the `index.html` tool card.
5. Run `npm test`. The structure suite catches 2 and 4 automatically.

## Deployment

The site is hosted on **Hostinger** and published by uploading the HTML files
to the web root. It is *not* GitHub Pages — do not add a `CNAME` file or a
Pages workflow, as that would set up a second deployment competing with the
live one.

`.github/workflows/test.yml` runs the test suite on every push. It deploys
nothing; it is the gate to run green before uploading. Only `index.html` and
`pm-calculation-desk.html` need to go to the server — `tests/`, `package.json`
and `.github/` are repo-only.

Because the upload is manual, the repo can drift from what is live. To check:

```sh
curl -s https://yazeed.blog/ | diff - index.html && echo "index.html in sync"
curl -s https://yazeed.blog/pm-calculation-desk.html | diff - pm-calculation-desk.html \
  && echo "calculation desk in sync"
```

## Known gaps

- No favicon, and no Open Graph / Twitter card tags — shared links render
  without a preview image.
- No `robots.txt` or `sitemap.xml`.
- Three tool cards on the homepage are `Coming soon` placeholders.
- The calculator page is a single 2,200-line file. Fine at this size; if it
  keeps growing, split `PM_DATA` into its own `data.js` (the block already
  ends with a CommonJS export shim for exactly this) and load it with a
  `<script src>`.

---

Made by [Yazeed Alotaibi](https://sa.linkedin.com/in/yazeed-alotaibi-rmp-prince2), RMP · PRINCE2.
