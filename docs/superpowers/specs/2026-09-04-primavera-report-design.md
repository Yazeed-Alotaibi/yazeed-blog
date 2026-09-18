# Primavera schedule import and project report — design

Date: 2026-09-04
Status: approved for planning

## What this is

A new page, `primavera-report.html`, that reads a Primavera P6 schedule export
and turns it into a project report: the calculators the schedule can fill are
filled from it, the rest are there to fill by hand, and the whole thing prints
to PDF or downloads as a single-sheet `.xlsx`.

It is not a calculator. It is a page that drives the calculators the desk
already ships, from a file instead of from a keyboard.

Everything runs in the visitor's browser. The schedule file is never uploaded
anywhere — there is no backend to upload it to, and the footer says so.

## Scope

This spec covers the **XER** format end to end. P6 XML (PMXML) and CSV become
adapters onto the same internal model in a follow-up spec: same normalised
schedule, same mapping, same report. Shipping XER first means the page, its
storage, its exports and every collision with the repository's invariants are
settled before a second parser exists to complicate them.

## Build order

The repository's hard edges are all in the page shell, not in the parser. The
parser is the well-understood part. So:

**Phase 1 — the shell, with no upload.** The page exists, mounts all
thirty-four calculators in the agreed layout, holds typed values in its own
storage envelope, and produces a working PDF and `.xlsx` of whatever has been
filled in. Green under `node tools/check.js` before phase 2 starts.

**Phase 2 — the file.** `PM_XER` to `PM_SCHEDULE` to `PM_MAP`, the provenance
badges, and the skipped-calculator reporting. Phase 2 lands on ground already
proven.

## What a P6 schedule can and cannot supply

Of the thirty-four calculators, a schedule export cleanly feeds five, partly
feeds four given a resource-loaded schedule, and holds nothing at all for the
other twenty-five. The report states all three outcomes; nothing is silently
dropped.

| Calculator | Outcome | Source |
|---|---|---|
| `earned-value` | fed | `TASKRSRC.target_cost` gives BAC; `act_reg_cost + act_ot_cost` gives AC; `target_cost × phys_complete_pct` gives EV; PV time-phased to the data date |
| `earned-schedule` | fed | the same figures plus `PROJECT.last_recalc_date` |
| `time-forecast` | fed | planned duration from `PROJECT.plan_start_date` / `scd_end_date` |
| `burn-rate` | fed | BAC, AC, elapsed and remaining duration |
| `float` | fed | `TASK.early_start_date` / `late_end_date` / `total_float_hr_cnt` |
| `labor-cost` | partial | labour quantities and `cost_per_qty` from `TASKRSRC`; overhead is not in the file |
| `fte` | partial | labour hours; period length from `CALENDAR` |
| `utilization` | partial | assigned hours against calendar capacity |
| `channels` | partial | team size from distinct `RSRC` rows |
| the other 25 | not derivable | risk registers, quality data, financial models, contract terms and agile metrics are not in a schedule file |

Two honesty constraints, both surfaced in the report itself:

- **PV is an approximation.** P6 does not export a time-phased baseline curve
  in the XER. Baseline cost is spread linearly across each activity's baseline
  duration and accumulated to the data date. The report says this in words
  wherever PV appears.
- **No data date, no earned-value block.** If `PROJECT.last_recalc_date` is
  absent the EV, ES, forecast and burn calculators are reported as skipped for
  that reason rather than computed against a guessed date.

### Float, which is per-activity

The float calculator takes one activity. A schedule has thousands. The report
runs the calculator on the single driving activity with the lowest total float,
and prints a plain table of the ten tightest beneath it, so the reading is a
real calculation and the context is still visible.

## The reader fills the gaps

A calculator the file cannot fill is not hidden. Its inputs are shown empty and
the reader may type them; the results, verdicts and charts then compute exactly
as they do on the desk, and the exports include them.

Every input therefore carries one of three provenance states, and the exports
carry it too:

- **from file** — with the XER field it came from, shown on the badge
- **entered by you** — typed by the reader
- **not provided** — still empty

When a reader overwrites a value that came from the file, the badge changes to
*entered by you* and a **reset to file value** control appears beside it.
Without that, provenance becomes a lie the first time somebody types over a
parsed number.

## Page layout

After an upload, the calculators the file filled appear open at the top with
their results and charts. The remaining twenty-five sit below, collapsed under
their domain headings, one click from being filled by hand. Before an upload the
page is the same, with nothing filled.

**Print rule: a card prints if it holds at least one value, whatever its
collapse state.** Empty calculators are omitted from the PDF rather than printed
as blank cards.

## Storage

The page gets **its own envelope, `desk.primavera.v1`** — readings, provenance,
source file name and data date.

It must not write through the satellite `desk.readings.v1` path. AGENTS.md
records that this path "merges only the visible card so opening a satellite page
cannot erase readings for the rest of the desk"; this page has thirty-four
visible cards, which is precisely the contamination that guard exists to
prevent.

The parsed schedule itself is **not** stored. A resource-loaded XER can exceed
the `localStorage` quota. Re-uploading re-parses, which is fast and local.

A **Clear** control empties the envelope, and the footer states that values are
held in this browser.

## Modules

Four DOM-free modules and one page runtime, following the existing pattern
where the pure layout function is separate from anything that touches
`document`:

| Module | What it does |
|---|---|
| `PM_XER` | Tokenises the XER's `%T` / `%F` / `%R` tab-delimited records into tables. Decodes as **windows-1252** via `TextDecoder`, which is what P6 writes; decoding as UTF-8 turns every accented activity name into mojibake, silently |
| `PM_SCHEDULE` | Normalises those tables into one plain model — project, data date, activities, assignments, resources, calendar. This is the seam the PMXML and CSV adapters attach to later |
| `PM_MAP` | Model to `{ card_id, input_key, value }` rows in the shape `projects.js` already validates, each with a provenance record naming its source field, plus a skip record per calculator it could not fill and why |
| `PM_REPORT` | Pure layout function for the workbook, mirroring how `PM_EXPORT` works today |

`PM_EXPORT.sheetFor(card, values, results, charts, now)` is already factored per
card. `PM_REPORT` reuses its per-card block rather than reimplementing the
layout; `PM_XLSX` writes a single worksheet, so the report concatenates blocks
down one sheet rather than writing a sheet each.

### Extracting the card runtime

`src/site/scripts/desk.js` is 1,532 lines and reaches for `#calc-sections`,
`#cat-nav`, `#search`, `#desk-stats` and `#project-bay` at startup, then drives
the Project Register, its dialogs and the Web Locks writer lease. The report
page has none of that furniture.

Card rendering and live computation are **extracted into their own module** that
both pages load. `desk.js` keeps the homepage's Register, hero, search and
sidebar wiring and calls into the extracted runtime for cards.

This is a refactor of the site's busiest module, so it is the riskiest work in
the spec, and it is bounded by the existing suite: `tests/baseline.json` records
every calculator's output for a fixed set of inputs, so the extraction has to
prove it changed nothing. Do it as its own step, with the suite green before and
after, and before any of the report page is built on top of it.

## Generator and registry

The page is a generated, committed artifact like every other root `*.html`, and
it is registered so that the sitemap, the homepage link and the prose gate all
apply to it. Four existing pieces need to admit a page that is not one
calculator:

- **`content/pages.json`** gains an entry carrying a `kind` of
  `schedule-import` instead of a `card` id.
- **`tools/calcpage.js`** skips `narrowData` / `checkNarrowed` for a
  non-calculator kind and embeds the full assembled `PM_DATA`, the way
  `index.html` does. All thirty-four definitions are genuinely needed here,
  because the reader may fill any of them.
- **`tests/pages.js`** exempts a non-calculator kind from the *ships one
  calculator, not the whole desk* suite (`tests/pages.js:226`). Every other gate
  it applies — byte-comparison of the generated file, at least 1000 words of
  prose, breadcrumb URLs, the homepage link, the footer count, sitemap
  agreement — still applies.
- **`tools/feature-manifest.js`** gains `schedule-import` in its `KINDS`
  whitelist, and `src/features/manifest.json` gains the entry. The kind matters:
  registering this as a `calculator` would make it the thirty-fifth, which
  breaks `tests/counts.js` and falsifies the `14 · 34 · 103` figures on the
  hero, the title, the meta description, the JSON-LD and the committed
  `og.png`.

## PDF

A print stylesheet and a **Download PDF** button calling `window.print()`. There
is no PDF library and the hard constraints forbid adding one; a print stylesheet
also yields selectable text and real fonts, which a hand-rolled writer would not
without embedding faces.

The print CSS drops the sidebar, the upload area and every control, sets page
breaks between calculators, and prints the source filename and data date in a
running header.

**Charts must be forced to draw before printing.** They mount from an
`IntersectionObserver`, and AGENTS.md documents the incident this causes: a
zero-width plot makes `draw()`'s width guard refuse to redraw, and the chart
strands on its empty state while the whole suite stays green. So `beforeprint`
expands every card holding at least one value and draws its charts; `afterprint`
restores the previous collapse state. The charts are SVG strings, so once drawn
they scale cleanly to the page.

## Excel

One sheet, written by the existing `PM_XLSX` with no changes to it: a project
header block, then one block per calculator holding values — its inputs with
their provenance, its results with their verdict sentences — then the skipped
list with the reason each was skipped.

No native Excel charts in this version. That would mean extending `PM_XLSX` to
multiple worksheets, which is its own project with its own test surface.

## Report header

The report opens with a project summary block: project name, data date, activity
count, percent complete, baseline finish against current finish, and a one-line
schedule and cost health verdict drawn from CPI and SPI where they could be
computed. This is the first page of the printed PDF.

## Errors

The reader sees what was wrong with the file, in their terms, and the page stays
usable:

- Not an XER at all — named as such, with the formats that are supported.
- XER that parses but holds no `PROJECT` row — rejected with that reason.
- Missing optional tables (`TASKRSRC`, `RSRC`, `CALENDAR`) — not an error. The
  calculators depending on them are reported as skipped, naming the table.
- File over a size ceiling, or over an activity-count ceiling — refused before
  parsing, consistent with how the existing import caps rows and bytes.

A failed upload never clears values already typed.

## Testing

`tests/primavera.js`, wired into `tests/run.js`, re-parsing the generated report
page the way `tests/pages.js` re-parses its own. It covers:

- XER tokenising against a synthetic fixture committed beside it
- the windows-1252 decode, asserted on a fixture holding a non-ASCII activity name
- the mapping matrix: for a given fixture, every one of the thirty-four
  calculators lands in exactly one of fed / partial / skipped, with a reason
  attached to each skip
- the PV linear-spread arithmetic against hand-computed values
- provenance: a fed value overwritten by a reader flips state, and reset restores
- the workbook parts and CRCs, as `tests/export.js` does

`tests/baseline.js` covers the card-runtime extraction: the recorded outputs must
not move.

And the manual check the repository requires and cannot automate: open the page
in a **foreground** tab, upload a file, and look at the charts — then print it
and look at the PDF. A green suite is not evidence that a chart drew, and it is
not evidence that it printed.

Since there is no real P6 export to build against, the fixture is written from
the documented XER schema. **The first real export uploaded should be expected
to need mapping corrections.** That is the accepted cost of this route; it is a
correction to `PM_MAP`, not a redesign.

## Deliverables

- `content/primavera-report.html` — at least 1000 words of practitioner prose; the suite gates it
- `content/pages.json` entry with `kind: "schedule-import"`, and `home.updated` bumped
- `src/features/manifest.json` entry; `schedule-import` added to `KINDS`
- extracted card-runtime module; `desk.js` reduced to homepage wiring
- `PM_XER`, `PM_SCHEDULE`, `PM_MAP`, `PM_REPORT` under `src/site/scripts/`
- `tools/calcpage.js` non-calculator page mode
- `tests/primavera.js` and its fixture; `tests/pages.js` and `tests/run.js` updated
- a static homepage link to the page
- `node tools/check.js` run and its regenerated output committed with the change

## Out of scope

P6 XML and CSV parsing; multi-sheet workbooks; native Excel charts in the report;
mounting the Project Register on this page; any change to how the homepage desk
stores its own readings.
