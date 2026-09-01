# Lane D report — content pack

## Shipped

- `docs/content/examples.json`: one worked example for each of the 33 current
  `PM_DATA` card IDs. Values are deliberately mixed across healthy, warning,
  and adverse readings; every note is plain English and at most 90 characters.
- `docs/content/earned-schedule-spec.md`: complete `earned-schedule` card
  contract, rationale, explicit **LINEAR-PV ASSUMPTION**, inputs, exact
  formulas and guards, output meanings, verdict tiers, three-step usage,
  existing `bars` and `meter` chart specs, and seven JSON test vectors.
- `docs/content/citations.md`: one paste-ready source line for each of the 14
  domains. The Agile and Flow lines include free canonical links.

## Verification

The read-only validation script loaded the real page through
`tests/harness.js`, invoked every example output and chart builder, and checked
the content pack shape:

```text
cards=33, examples=33, citations=14, failures=0
```

The final execution check is preserved at
`docs/content/verify-examples.js`. It loads the shipped page through
`tests/harness.js` `loadPage`, reads `examples.json`, and invokes every real
card `compute()` function. Final transcript:

```text
OK earned-value (14 outputs)
OK time-forecast (3 outputs)
OK burn-rate (4 outputs)
OK three-point (7 outputs)
OK path-sigma (2 outputs)
OK learning-curve (2 outputs)
OK float (3 outputs)
OK crash (3 outputs)
OK fte (2 outputs)
OK utilization (2 outputs)
OK labor-cost (3 outputs)
OK channels (3 outputs)
OK emv (2 outputs)
OK risk-score (1 outputs)
OK contingency (2 outputs)
OK decision-tree (3 outputs)
OK dpmo (3 outputs)
OK control (3 outputs)
OK cpk (2 outputs)
OK coq (4 outputs)
OK roi (2 outputs)
OK npv (4 outputs)
OK tvm (3 outputs)
OK breakeven (3 outputs)
OK depreciation (2 outputs)
OK scoring (2 outputs)
OK pta (2 outputs)
OK fpif (2 outputs)
OK cpif (2 outputs)
OK velocity (3 outputs)
OK capacity (2 outputs)
OK say-do (2 outputs)
OK littles-law (2 outputs)
Checked 33 example sets; no null, NaN, or Infinity outputs.
```

It also confirmed every example output is finite or a non-null text result,
every chart with a builder returns a plot spec, all input keys are present,
all notes are ≤90 characters, the examples have no extra IDs, and the spec
contains seven vectors with all three guard cases.

The existing dependency-free suites remain green:

```text
Formula baseline: 132/132 passed
Edge cases + empty state + division guards: 7933/7933 passed
Chart builders: 2464/2464 passed
```

No browser pass was needed for this lane: no shipped HTML, CSS, JavaScript, or
image was changed. The examples were nevertheless passed through each real
card's chart builder, which is the relevant rendering-contract check for this
data-only deliverable.

## Integration note for Lane A

Wire `examples.json` into the self-contained `EXAMPLES` object using the exact
PM_DATA IDs. Add the proposed `earned-schedule` card exactly as specified.
The card changes the totals from 33 calculators / 99 metrics to 34 calculators
/ 103 metrics; the 14-domain count is unchanged. Update all count-bearing copy,
metadata, JSON-LD, and `og.png` as required by the Lane A checklist.

## AGENTS.md delta

None requested from Lane D. The content files are documentation inputs for
Lane A and do not change the project’s operating rules.

## Outside-lane observations

`index.html` remains untouched. The checkout was obtained from the public
`main` archive because Git smart-HTTP negotiation hung in this environment;
the local branch is `codex/content-pack` with the supplied GitHub URL as its
`origin`. No merge or push was attempted.
