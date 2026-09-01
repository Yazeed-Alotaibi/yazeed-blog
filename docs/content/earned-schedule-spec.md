# Earned Schedule card specification

Proposed card id: `earned-schedule`  
Domain: Earned Value Management  
New outputs: 4

## Why this card exists

Schedule Performance Index (SPI) is useful while planned value is still
climbing, but it becomes misleading near project completion. Planned value
approaches the budget ceiling, so EV ÷ PV drifts toward 1.00 even when the
work finished later than the baseline said it would. Earned Schedule (ES)
translates the earned value back into the planned time axis. It lets the
reader compare the time the completed work was worth with the actual time
spent.

**LINEAR-PV ASSUMPTION:** this four-input version assumes planned value accrues
linearly across the planned duration. That is the honest limit of the card:
real baselines are often front-loaded, back-loaded, or shaped by milestones.
Use the result as a trend signal, and use a time-phased PV curve for a
production forecast when the baseline is not approximately linear.

Suggested card copy:

> SPI can look healthy late in a project because PV is running out. Earned
> Schedule puts EV back on the time axis. This card assumes **LINEAR PV** — the
> useful, explicit approximation for a four-input reading. Treat IEAC(t) as a
> trend, not a committed finish date.

## Inputs

| Key | Label | Helper text | Unit and boundary |
| --- | --- | --- | --- |
| `bac` | BAC — Budget at Completion | Total approved budget for the complete scope. | Currency; must be greater than 0. |
| `pd` | PD — Planned duration | Baseline duration from start to planned finish. | Periods; use a positive value. |
| `at` | AT — Actual time | Time elapsed at the status date. | Periods; must be greater than 0 for SPI(t). |
| `ev` | EV — Earned Value | Budgeted value of the work actually complete. | Same currency as BAC; zero is valid. |

Keep “periods” unit-agnostic: the reader may use weeks, months, or accounting
periods, but all three time inputs and the returned time outputs must use the
same period.

## Outputs and formulas

| Key | Label | Formula | Meaning |
| --- | --- | --- | --- |
| `es` | Earned Schedule (ES) | `ES = PD × (EV ÷ BAC)` | Planned time represented by the earned value. |
| `svt` | Schedule Variance (SV(t)) | `SV(t) = ES − AT` | Time ahead of or behind the status date; positive is ahead. |
| `spit` | Schedule Performance Index (SPI(t)) | `SPI(t) = ES ÷ AT` | Earned time per period of actual time; 1.00 is on plan. |
| `ieac` | Independent Estimate at Completion (IEAC(t)) | `IEAC(t) = PD ÷ SPI(t)` | Forecast total duration if the current time efficiency holds. |

### Guards and propagation

- All four inputs must be finite numbers at the input boundary. `PD` must be
  positive for a meaningful duration forecast.
- Calculate ES only when `BAC > 0`. If ES is unavailable, SV(t) is unavailable
  too because it depends on ES.
- Calculate SPI(t) only when `AT > 0`.
- Calculate IEAC(t) only when `SPI(t) > 0`. This prevents division by zero
  when EV is zero and avoids a negative or meaningless duration forecast.
- A guarded output is `null`, not zero and not a text placeholder. The card's
  renderer should leave the result unavailable and let the other valid outputs
  remain visible.

## Verdict tiers and meanings

Use the existing SPI convention: values above 1 are good, exactly 1 is
informational, and values below 1 are bad. The wording is fresh so the card
explains earned time rather than repeating the old value-axis copy.

| Condition | Tone | Verdict | Meaning |
| --- | --- | --- | --- |
| `SPI(t) > 1.00` | `good` | Ahead of the time baseline. | The completed work represents more planned time than the project has consumed. |
| `SPI(t) = 1.00` | `info` | On the time baseline. | Earned schedule and actual time match. |
| `SPI(t) < 1.00` | `bad` | Behind the time baseline. | The completed work represents fewer planned periods than have elapsed. |

Output meanings should remain visible even when the verdict is negative:

- **ES:** the baseline time equivalent of the EV entered.
- **SV(t):** the time difference at the status date. Negative means late.
- **SPI(t):** time efficiency, with 1.00 as the plan line.
- **IEAC(t):** a duration forecast under the same efficiency and linear-PV
  assumption; it is not a promise and it is not a calendar finish date.

## How to use it

1. Enter BAC and PD from the approved baseline, then enter EV and AT from the
   same status date.
2. Read SV(t) for the time gap and SPI(t) for the direction and efficiency of
   travel. Check that the linear-PV assumption is reasonable for this project.
3. Use IEAC(t) as a trend to test recovery options; reconcile it to the
   time-phased schedule before committing to a finish date.

## Chart specification

Use only the existing `bars` and `meter` builders in the page. Do not add a
renderer or a new chart kind.

### Earned time position (`bars`)

- `title`: `Earned time position`
- `purpose`: `The time the completed work earned against actual time and plan.`
- Return a bars spec only when `r.es` and `v.at` are finite.
- `series`: `ES` (`r.es`, sub `earned`, tone `good` when `r.svt >= 0`, else
  `bad`) and `AT` (`v.at`, sub `actual`, tone `accent`).
- `refValue`: `v.pd`; `refLabel`: `PD`; `catHead`: `Time (periods)`.
- The summary should state ES, AT, and whether the reading is ahead or behind.

This uses the existing bars contract: `series`, optional `refValue` and
`refLabel`, `catHead`, and `summary`.

### Time efficiency (`meter`)

- `title`: `SPI(t) time efficiency`
- `purpose`: `Earned schedule per period of actual time, crossed at 1.00.`
- Return a meter spec only when `r.spit` is finite.
- `value`: `r.spit`; `min`: `0`; `max`: `1.5`; `target`: `1`;
  `targetLabel`: `on plan`; `label`: `SPI(t)`.
- Zones: `0–0.9` tone `bad`, label `behind`; `0.9–1` tone `warn`, label
  `watch`; `1–1.5` tone `good`, label `ahead`.
- The summary should name the SPI(t) value and repeat the linear-PV caveat.

This uses the existing meter contract: `value`, `min`, `max`, `target`,
`targetLabel`, `zones`, `label`, and `summary`. The meter's position carries
the verdict even in greyscale.

## Test vectors

The outputs below are rounded to two decimal places for comparison. `null`
means the formula's guard fired.

```json
[
  {
    "name": "behind schedule",
    "inputs": { "bac": 200000, "pd": 12, "at": 8, "ev": 120000 },
    "outputs": { "es": 7.2, "svt": -0.8, "spit": 0.9, "ieac": 13.33 }
  },
  {
    "name": "ahead of schedule",
    "inputs": { "bac": 200000, "pd": 12, "at": 6, "ev": 140000 },
    "outputs": { "es": 8.4, "svt": 2.4, "spit": 1.4, "ieac": 8.57 }
  },
  {
    "name": "exactly on plan",
    "inputs": { "bac": 200000, "pd": 12, "at": 6, "ev": 100000 },
    "outputs": { "es": 6, "svt": 0, "spit": 1, "ieac": 12 }
  },
  {
    "name": "BAC guard",
    "inputs": { "bac": 0, "pd": 12, "at": 6, "ev": 100000 },
    "outputs": { "es": null, "svt": null, "spit": null, "ieac": null }
  },
  {
    "name": "AT guard",
    "inputs": { "bac": 200000, "pd": 12, "at": 0, "ev": 100000 },
    "outputs": { "es": 6, "svt": 6, "spit": null, "ieac": null }
  },
  {
    "name": "SPI(t) positive guard",
    "inputs": { "bac": 200000, "pd": 12, "at": 6, "ev": 0 },
    "outputs": { "es": 0, "svt": -6, "spit": 0, "ieac": null }
  },
  {
    "name": "late mid-project trend",
    "inputs": { "bac": 300000, "pd": 20, "at": 15, "ev": 180000 },
    "outputs": { "es": 12, "svt": -3, "spit": 0.8, "ieac": 25 }
  }
]
```

Adding this card changes the site totals from **33 calculators / 99 metrics**
to **34 calculators / 103 metrics**. The 14-domain count does not change.
Lane A must update every count-bearing copy and re-render `og.png` from
`design/og-card.source.html` before integration.
