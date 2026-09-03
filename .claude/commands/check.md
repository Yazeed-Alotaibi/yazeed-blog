---
description: Regenerate the committed output and run the full test suite
argument-hint: "[--verify]"
allowed-tools: Bash(node tools/check.js:*)
---

Run the project's pre-commit gate:

```bash
node tools/check.js $ARGUMENTS
```

This regenerates the per-calculator pages, rewrites the prerendered mirror in
`index.html`, and runs the full suite — in that order, because each step reads
the one before it. With `--verify` it changes nothing and instead fails if any
committed output is stale.

If it fails, read the failure and fix the cause. Do not regenerate
`tests/baseline.json` to make a failure go away: that file is what every
refactor is measured against, so read the diff and satisfy yourself each
changed number is right before rewriting it.

When it passes, remind me of the two things the suite cannot see — that no
chart is ever drawn and no workbook is ever opened — and tell me which of the
two my change actually touched, rather than listing both by rote.
