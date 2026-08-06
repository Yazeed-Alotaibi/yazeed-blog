# WBS Estimation Toolkit

**Date:** 2026-08-06
**Status:** approved
**Owner:** Claude — branch `claude/wbs-estimation-toolkit`
**Files:** `wbs-estimation-toolkit.html` (new), `index.html` (card 04 only)

## Problem

`index.html` advertises a WBS Estimation Toolkit as coming soon: "Build a work
breakdown structure, apply three-point estimates, and roll up confidence
intervals automatically." Nothing behind it yet.

The gap it fills: a three-point estimate produces a *range*, but PMs routinely
collapse it to a single expected value and lose the uncertainty. Rolling
uncertainty up correctly across tasks is also easy to get wrong — standard
deviations add in quadrature, not linearly.

## Design

A third self-contained page under the same constraints as the other two: no
build step, no dependencies, everything client-side.

### Model

A project holds deliverables; each deliverable holds tasks. Each task carries
optimistic, most likely, and pessimistic values for both duration and cost.
Two levels — deliverable then task — matches how PMs actually decompose work
without the UI cost of arbitrary nesting.

### Mathematics

Per task, PMBOK beta-PERT:

- Expected: `E = (O + 4M + P) / 6`
- Standard deviation: `σ = (P − O) / 6`

Rolled up: `E_total = ΣE`, and `σ_total = √(Σσ²)`. Quadrature is the part
that's easy to get wrong, and it assumes tasks vary independently — the sheet
states that assumption rather than burying it.

Confidence range is `E ± zσ`, with z of 1.0, 1.645, or 1.96 for 68/90/95%,
selectable. Lower bounds clamp at zero.

### Signature: the dimension line

An estimate is a range, so the page's one bold element renders it as one — an
engineering dimension line. Ticks mark the absolute extent (`ΣO` to `ΣP`), a
filled band spans the confidence interval, and a strong marker sits at the
expected value.

Where E falls inside the envelope is the information a bare number loses: left
of centre means the estimate skews optimistic, right means pessimistic. Band
width against total extent shows how much confidence narrows the raw spread.

Restraint: dimension lines appear only at the project total and each deliverable
subtotal. Task rows stay quiet with numeric `E ± σ`.

### Estimation-error guard

When a task violates `O ≤ M ≤ P`, the row flags it inline — visible but
non-blocking. Inverting optimistic and pessimistic is the most common
three-point mistake, and it silently corrupts every roll-up above it.

### Persistence and export

Debounced autosave to `localStorage`, one key. Nothing leaves the browser, so
the site's privacy promise holds. Clearing is behind a confirm.

CSV export carries WBS ID, level, name, both O/M/P triplets, E, and σ. A print
stylesheet strips controls and input chrome so the sheet renders as a clean
schedule.

### Numbering

WBS codes (1, 1.1, 1.2) are the domain's own identifiers, not decoration — they
encode hierarchy the reader needs.

## Scope

Out: arbitrary nesting depth, critical path, resource levelling, task
dependencies, cloud sync. Each is a separate tool, not a corner of this one.

## Verification

Browser-driven, since the repository has no test framework:

- Roll-ups match hand-computed PERT for a known set of tasks.
- Quadrature is correct: two tasks with σ 3 and 4 give σ_total 5, not 7.
- Inverted O/P flags without blocking.
- Empty and partial inputs degrade to a dash rather than `NaN`.
- State survives reload; clearing empties it.
- Dark mode, keyboard focus, reduced motion, and narrow viewports all hold.
