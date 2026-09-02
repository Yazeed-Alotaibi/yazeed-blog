# Lane A report — desk state and content integration

## Scope shipped

Lane A changed only `index.html`, `design/og-card.source.html`, and `og.png`,
plus this required report. It did not edit tests, deployment files, shared
agent instructions, or Lane D's source content.

- **A1 — shareable readings:** every calculator has a `Copy link` control that
  serializes only its filled inputs into a card-scoped hash URL. Loading a
  valid state hash restores declared inputs through the normal input-event
  path and scrolls to the card. Clipboard API and hidden-textarea fallback
  paths are both present; invalid cards, keys, and numeric values are ignored.
- **A2 — session restore:** filled readings are saved after a short debounce to
  the versioned `desk.readings.v1` key. A returning visitor without a state
  hash is offered explicit Restore and Discard actions in an accessible
  region; storage access is guarded for unavailable/private storage.
- **A3 — worked examples:** Lane D's complete example pack is embedded in the
  self-contained page. Every calculator, including the new Earned Schedule
  card, has an Example/Clear control that uses the same input-event path as a
  person typing, so outputs, verdicts, and charts update normally.
- **A4 — search shortcut:** `/` focuses the calculator search only when no
  modifier is held and focus is outside an editing control. Escape clears the
  focused search and restores the full result set.
- **A5 — Earned Schedule:** the Earned Value domain now includes the exact
  Lane D linear-PV implementation of ES, SV(t), SPI(t), and IEAC(t), with its
  guards, interpretation tiers, usage guidance, and two charts. Published
  totals now read 14 domains, 34 calculators, and 103 metrics across visible
  copy, metadata, social metadata, and JSON-LD. The source social card and the
  committed `og.png` were updated together; the PNG is 1200×630.
- **A6 — citations:** all 14 domain headers carry Lane D's compact source line.
  Linked sources open safely with `rel="noopener"` and use existing tokens.

The final integration commits on `codex/desk-state` are:

```text
b01af6c Embed Lane D worked examples
d84ad1f Implement Earned Schedule card and count ripple
763908a Implement A6 domain citations
```

A1, A2, and A4 and their follow-up hardening commits were merged to `main`
before this final integration rebase.

## Automated gate

Run after rebasing onto `origin/main` at `f50d98c`:

```text
$ node tests/run.js
Formula baseline: 135/135 passed
Edge cases + empty state + division guards: 1621/1621 passed
Chart builders: 380/380 passed
Stylesheet integrity: 5/5 passed
Redirect integrity: 3/3 passed
Published counts: 9/9 passed
Earned Schedule vectors: 9/9 passed
All tests: 2162/2162 passed in 72.7ms
```

The test-crush mutation proof remains intact:

```text
$ node tests/mutation-smoke.js
earned-value CPI division: killed
velocity division: killed
depreciation division: killed
Mutation smoke: 3/3 killed
```

Static checks over Lane A's final diff found no added `let`, `const`, arrow
functions, or hexadecimal colour literals. `file og.png` reported:

```text
og.png: PNG image data, 1200 x 630, 8-bit/color RGB, non-interlaced
```

## Manual browser gate

The final page was checked in a foreground, visible browser tab at 1440px,
768px, and 390px in both light and dark colour schemes. The calculator grid,
citations, restore strip, Earned Schedule outputs, verdicts, and both charts
remained readable without clipping or overlap.

A filled card's copied URL reproduced the same readings in a fresh tab. The
restore/discard choice behaved independently of shared-link state. Example and
Clear updated fields, results, status, and charts. New controls were reachable
and operable by keyboard with visible focus; `/` and Escape behaved as scoped.
The page made no new external requests beyond the existing Google Fonts
stylesheet. The refreshed 1200×630 social card was opened and its 14 / 34 / 103
figures were visually confirmed.

## AGENTS.md delta for the final documentation pass

Lane A did not edit `AGENTS.md`, per the ownership rules. In its file inventory,
change the `index.html` description from “14 domains · 33 calculators · 99
metrics” to “14 domains · 34 calculators · 103 metrics”. In the `og.png`
re-render reminder, change the parenthetical figures from `14 · 33 · 99` to
`14 · 34 · 103`.

Lane B's report separately supplies the new consolidated test-command wording;
apply both deltas in the single post-merge documentation commit described by
the parallel plan.

## Outside-lane observations

No additional issue requiring an out-of-lane edit was found. Live-host
verification still belongs to the owner after merge: compare the deployed
text files to the merge commit, open the host-reencoded `og.png` visually, and
exercise a shared reading after the approximately two-minute deploy window.
