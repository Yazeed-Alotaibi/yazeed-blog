# Lane B report — test crush and integrity coverage

## Scope shipped

Lane B changed only `tests/` plus this required report. It did not edit
`index.html`, deployment files, shared agent instructions, or another lane's
content.

- `tests/run.js` loads `index.html` once and passes the same page object to all
  seven suites. Every suite remains directly runnable with plain Node.
- `tests/harness.js` keeps the assertion and page-iteration API small while
  delegating all page loading and invocation to the private VM boundary.
- `tests/vm-boundary.js` owns real-path containment, VM setup, script loading,
  and an unforgeable page-identity registry. It clones callback data inside the
  VM, rejects proxy/accessor argument containers before their traps can run,
  and preserves browser callback receivers only when their full own-property
  and prototype graph still originates in that page VM.
- `tests/vm-contract-smoke.js` permanently probes private state, forged page
  identities, proxy/accessor argument lists, browser receiver semantics, and
  host-tainted receivers.
- `tests/security-boundaries.js` keeps every callback surface and real-path
  containment scenario independently named in the integrity pressure gate.
- `tests/edge-cases.js` replaces 24 rotating sweeps with named input classes:
  all-zero, huge, tiny, each empty, each malformed, each numeric input
  negative, and explicit divisor guards.
- `tests/charts.js` compares all 30 current worked-example specs to
  `tests/charts-baseline.json`, checks point boundaries, renders at 360px and
  900px, and exercises five edge classes plus the empty state. Human summary
  sentences are not snapshotted; summaries must be non-empty and may not emit
  `NaN` or `Infinity`.
- `tests/stylesheet.js` covers brace balance, custom-property integrity,
  dark-mode parity, palette boundaries, and static anchors.
- `tests/redirects.js` enforces the `mod_rewrite` guard and agreement between
  both fallback stubs and their 301 destinations. It intentionally ignores
  non-`Rewrite*` directives such as Lane C's core Apache `ErrorDocument`.
- `tests/counts.js` derives domains, calculators, and metrics from `PM_DATA`
  and checks title, metadata, JSON-LD, hero figures, and every metric count in
  the hero.
- `tests/earned-schedule.js` visibly skips while the card is absent and reads
  Lane D's fenced JSON vectors automatically once Lane A adds the card.
- `tests/mutation-smoke.js` runs the shared runner against three exact,
  script-generated temporary mutants. The public `node tests/run.js` command
  always tests the repository page; unsupported arguments exit 2 and a hostile
  external-page attempt is covered by a security regression check.
- `tests/integrity-smoke.js` durably pressure-tests every static assertion, the
  mask-stencil allowlist boundary, Lane D vector activation, future-chart
  integration, and non-finite chart summaries.

## Coverage manifest

The comparison baseline is the branch's current `origin/main` merge-base after
the required rebase; the before counts are the pre-Lane-B totals recorded in
`docs/parallel-plan.md`. The after counts below are from the rebased Lane B
suite with Lane D present and Lane A's Earned Schedule card not yet present.

| Behavior class | Before | After | Coverage guarantee |
| --- | ---: | ---: | --- |
| Worked-example formula outputs | 132 | 132 + 2 infrastructure checks | Every existing output remains compared to `baseline.json`; a new card is detected. |
| General edge safety | 7,820 | 1,300 | Every output sees all-zero, huge, tiny, each-input-empty, each-input-malformed, and each numeric input negative exactly once; one assertion combines no-throw, finite result, and verdict shape. |
| Division guards | 14 | 146 | 32 deliberate denominator scenarios cover every current variable divisor and zero-denominator expression; three Earned Schedule scenarios are already reserved for BAC, AT, and EV/SPI(t). |
| Empty calculator state | 99 | 99 | Every output must still return its empty marker when all inputs are blank. |
| Worked-example charts | 210 | 180 | Each current chart gets an exact machine-data spec comparison, explicit point boundaries, metadata/renderer resolution, two render widths, and continued-existence coverage. |
| Chart edge safety | 2,194 | 150 | All 30 charts run once for each of five distinct edge classes; builders/renderers may not throw or emit non-finite SVG/summary data. |
| Empty chart state | 60 | 30 | One consolidated assertion per chart combines no-throw and null-spec behavior. |
| Stylesheet integrity | 0 | 5 | Balanced braces, no dangling token, no dark-only token, palette rules with print/mask allowlists, and resolved static anchors. |
| Redirect integrity | 0 | 3 | Every `Rewrite*` is guarded; both stubs match their rewrite destinations. |
| Published count drift | 0 | 9 | Counts are derived from `PM_DATA` and enforced across metadata and visible hero surfaces. |
| Earned Schedule vectors | 0 | 0 skipped / 9 active | The current skip is explicit; a synthetic card proves Lane D's seven vectors plus contract checks pass 9/9. |
| **Total** | **10,529** | **2,056** | **80.5% fewer assertions, with new page-integrity and integration coverage added.** |

Lane A adds four outputs and two charts. The deliberate class design keeps the
combined suite below 2,500 assertions after that integration.

## Main gate transcript

```text
$ node tests/run.js
Formula baseline: 134/134 passed
Edge cases + empty state + division guards: 1545/1545 passed
Chart builders: 360/360 passed
Stylesheet integrity: 5/5 passed
Redirect integrity: 3/3 passed
Published counts: 9/9 passed
earned-schedule: card not present, vectors skipped
Earned Schedule vectors: 0/0 passed
All tests: 2056/2056 passed in 193.9ms
```

Parse-once instrumentation wrapped `fs.readFileSync` and counted only reads of
`index.html`:

```text
All tests: 2056/2056 passed in 195.8ms
index.html reads: 1
```

All seven suite files also exited 0 when invoked individually.

## Mutation smoke transcript

```text
$ node tests/mutation-smoke.js
earned-value CPI division: killed
  Formula baseline: 133/134 passed, 1 FAILED
  Chart builders: 359/360 passed, 1 FAILED
velocity division: killed
  Formula baseline: 133/134 passed, 1 FAILED
  Chart builders: 358/360 passed, 2 FAILED
depreciation division: killed
  Formula baseline: 133/134 passed, 1 FAILED
runner external page: rejected
Mutation smoke: 3/3 killed; external page rejected
```

The temporary directories are created with `mkdtemp` and removed in `finally`
blocks, including when a runner or child-process call throws.

## Integrity pressure transcript

The durable smoke command applies temporary in-memory and temporary-directory
mutations. Every mutation produces the intended failure, while both cross-lane
integration probes pass.

```text
$ node tests/integrity-smoke.js
unbalanced brace: caught
dangling token: caught
dark-only token: caught
hardcoded colour: caught
painted colour beside mask stencil: caught
missing anchor: caught
unguarded rewrite: caught
stub drift: caught
VM host escape: caught
VM compute callback: caught
VM interpret callback: caught
VM chart build callback: caught
VM renderer nested data: caught
VM boundary state private: caught
VM forged page identity: caught
VM proxied argument list: caught
VM accessor argument list: caught
VM accessor callback data: caught
VM callback receiver: caught
VM host callback receiver: caught
VM tainted callback receiver: caught
VM function-tainted callback receiver: caught
VM prototype-tainted callback receiver: caught
VM nested host function: caught
VM overridden array method: caught
VM host callback target: caught
VM prototype-spoofed callback target: caught
VM proxied callback target: caught
VM nested proxied function: caught
VM cyclic callback data: caught
external harness page: caught
symlinked external harness page: caught
synthetic Earned Schedule vectors: caught
future chart integration: caught
non-finite chart summary: caught
Integrity smoke: 35/35 caught
```

The future-chart probe proves Lane A can add the two specified charts without
editing Lane B's fixture. Existing charts remain exact-characterized; a new
chart enters through the renderer/structure/edge contract.

## AGENTS.md delta for Claude Code

Lane B did not edit `AGENTS.md`. After all lanes merge, replace its opening
Tests paragraph with wording equivalent to:

> `node tests/run.js` is the complete dependency-free gate. It loads
> `index.html` once and runs the formula baseline, deliberate edge classes,
> chart specs, stylesheet integrity, redirect integrity, published-count
> drift, and guarded Earned Schedule vectors. Each suite remains directly
> runnable for debugging. Run `node tests/mutation-smoke.js` when changing the
> test harness or calculator formulas; all three representative operator
> mutants must be killed.

Run `node tests/integrity-smoke.js` when changing the static parsers, chart
contracts, callback boundary, or Lane A/D integration seams; all thirty-five
pressure probes must be caught.

Add `tests/charts-baseline.json` to the file inventory as the machine-data
fixture for current worked-example chart specs. Preserve the existing warning
that Node tests do not prove browser rendering.

Add `tests/vm-boundary.js`, `tests/vm-contract-smoke.js`, and
`tests/security-boundaries.js` to the file inventory as the callback-isolation
implementation and its adversarial regression matrix.

## Notes for other lanes and final merge

- The count suite cannot inspect pixels in `og.png`. Re-rendering and opening
  the 1200×630 image after the 34/103 update remains Lane A's manual gate.
- Earned Schedule vector JSON is parsed from
  `docs/content/earned-schedule-spec.md`; the merged Lane D schema is
  compatible and passed the synthetic 9/9 activation check.
- Chart summary prose is intentionally not pinned. Numeric/chart data is exact,
  while summaries are checked for presence and non-finite leakage so copy can
  improve without snapshot churn.
- `node tests/run.js` has no public alternate-page option and rejects arguments
  with exit 2. Mutation smoke creates exact repository-contained temporary
  copies, loads them through the bounded harness, and passes only the resulting
  page object to the exported runner.
- Lane B does not merge to `main`. Yazeed owns the merge and deployment.
