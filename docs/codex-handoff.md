# Codex work order — parallel session with Claude Code

Hand this file to Codex. It describes what Codex may touch while Claude Code is
working the same repository, and the one task assigned to it.

`AGENTS.md` remains the source of truth for the project. This file only adds the
*current* division of labour, which AGENTS.md cannot know because it changes per
session.

---

## 1. The structural fact that governs everything here

This site is **one file**: `index.html`, ~5,300 lines, containing the markup, the
whole stylesheet, and all the JavaScript. There is no module boundary to split
along.

So the usual "two agents, one repo" advice does not apply. Two agents cannot both
edit `index.html` — not in different sections, not carefully. Git would merge the
hunks and produce a file neither agent verified, in a project whose only test of
rendering is a human opening the page.

**Therefore: parallel work here means Codex does not touch `index.html` at all.**
Everything below follows from that.

---

## 2. File ownership, this session

| Path | Owner | Notes |
|---|---|---|
| `index.html` | **Claude Code** | Held for the whole session. Read freely; do not edit, stage, or commit. |
| `AGENTS.md`, `CLAUDE.md` | **Claude Code** | May need updating as deployed artifacts change. |
| `tests/harness.js` | **Claude Code** (settled) | Just changed; the change is committed. Import it, do not edit it. |
| `tests/stylesheet.js` | **Codex** — to create | Your assignment. |
| `tests/redirects.js` | **Codex** — to create | Your assignment. |
| `.htaccess`, stub HTML files | unassigned | Do not edit without saying so first. |
| `design/`, `docs/` (other) | unassigned | Do not edit without saying so first. |

If you need a file that is not yours, **stop and say so** rather than editing it.
That is rule 3 in AGENTS.md and it is the rule that actually prevents damage here.

Claude Code currently has [PR #4](https://github.com/Yazeed-Alotaibi/yazeed-blog/pull/4)
open from branch `claude/yazeed-blog-ui-ux-xvcwjj`, containing UI/UX fixes to
`index.html`. Read it if you want context; do not build on it.

---

## 3. Your assignment: static integrity tests

The existing suite (`baseline.js`, `edge-cases.js`, `charts.js`) covers the
*arithmetic* thoroughly — 10,500-odd assertions — and covers the *page* not at
all. Every bug found in this repository over the last two sessions was a
presentation bug that the green suite could not see:

- Seven CSS custom properties left dangling by a page merge. Every rule using
  them resolved to nothing; panels went transparent. Suite stayed green.
- A rule that hid an empty plot zeroed its width, and the width guard then
  refused to redraw it — all thirty charts stranded permanently. Suite green.
- An unclosed `@media (min-width: 46em) {` swallowed every rule after it, so
  below 736px the entire About section rendered unstyled. Suite green. (Fixed in
  PR #4.)

A browser-based test would need a dependency, which the hard constraints forbid.
But **most of that class of bug is detectable by parsing the file** — no DOM, no
dependency, plain `node`. That is your job.

Follow the existing style: plain `node`, no packages, `var`/`'use strict'`, and
reuse `tests/harness.js` for the assertion counters and the pass/fail summary
line so output matches the other three suites.

### 3a. `tests/stylesheet.js`

Extract the `<style>` block from `index.html` and assert:

1. **Balanced braces / no unclosed at-rule.** Strip comments and quoted strings
   first, then walk the block tracking depth. Depth must return to exactly 0, and
   must never go negative. *This is the regression test for the bug above — write
   it first.*

2. **No dangling custom property.** Collect every `--token:` *definition*
   (anywhere, not only `:root` — some are set on classes, e.g. `.ch-t-good`
   defines `--ch`) and every `var(--token)` *use*. Every use must have a
   definition. Report the offenders by name.

3. **No dark-only token.** Every `--token` defined inside the
   `@media (prefers-color-scheme: dark)` block must also be defined in `:root`.
   A token that exists only in dark mode is invisible in light mode.

4. **No hardcoded colour outside the palette.** AGENTS.md: "Never hardcode a hex
   value in a rule — add a property." Assert no `#rrggbb`/`#rgb` literal appears
   in a declaration outside `:root` and the dark-mode block.

   ⚠️ **Two deliberate exceptions you must allowlist, or this test fails on
   correct code:**
   - The `@media print` block. It intentionally uses bare `#fff` / `#000` /
     `#999`: print is not the screen palette, and paper has no dark mode.
   - `mask-image` gradients on `#cat-nav`, which use `#000` as an *alpha
     stencil*, not as a colour — the value is never painted.

   Prefer allowlisting by enclosing block (skip anything inside `@media print`)
   over pattern-matching the specific hex values.

5. **Static anchors resolve.** Every `href="#…"` in the static markup must match
   an `id` in the static markup. Note that most `id`s are generated at runtime by
   JS (`cat-…`, `calc-…`) — restrict this check to hrefs whose target is written
   literally in the file (`#content`, `#main-hero`, `#about`, `#calc-sections`),
   or the test will report false failures.

### 3b. `tests/redirects.js`

1. **Every rewrite directive is guarded.** Assert that no `RewriteRule`,
   `RewriteCond`, or `RewriteEngine` line in `.htaccess` sits outside
   `<IfModule mod_rewrite.c>`. AGENTS.md gives the `awk` equivalent and explains
   why: an unguarded directive returns **500 for every page on the site** on a
   host without the module. This turns that check into something that runs.

2. **Stubs and rewrites agree.** `pm-calculation-desk.html` and
   `wbs-estimation-toolkit.html` each carry a `<meta http-equiv="refresh">`
   fallback. Assert each stub's refresh target matches the destination the
   corresponding `RewriteRule` sends that path to, so the two redirect paths can
   never drift apart.

### Done when

- Both files run clean on plain `node` with no packages installed.
- Each prints a one-line summary in the same shape as the existing suites.
- You have deliberately broken the file to confirm each assertion actually
  fires — a test that cannot fail is worse than no test. Revert after.
- `AGENTS.md`'s test list is **not** updated by you (Claude Code owns that file);
  say in your report that it needs the two new files added, and Claude will do it.

### Expected failure — do not "fix" it

If you branch from `main`, assertion 1 of `stylesheet.js` **will fail**: the
unclosed `@media` is still on `main`. That failure is the proof your test works.
PR #4 fixes it. Report it; do not touch `index.html` to make it pass.

---

## 4. Workflow

```bash
# from the main checkout
git worktree add ../yazeed-blog-codex -b codex/static-integrity-tests origin/main
cd ../yazeed-blog-codex
```

Then:

1. Work only inside `../yazeed-blog-codex`.
2. **Never `git add -A`.** Stage only `tests/stylesheet.js` and
   `tests/redirects.js` by name.
3. `git pull --rebase origin main` before publishing.
4. Push to `codex/static-integrity-tests`. **Do not merge to `main`** — `main` is
   the live site, merging is deploying, and Yazeed makes that call.

Git refuses to check out one branch in two worktrees. That refusal is the
guardrail: it makes it structurally impossible for you to end up standing on
Claude Code's branch.

---

## 5. If you finish early

Do not go looking for work in `index.html`. Report back instead, with:

- the two files, and what each assertion caught when you deliberately broke it;
- the `AGENTS.md` line you need added (see above);
- anything you noticed in `index.html` that looks wrong — **as a written note,
  not an edit**. Claude Code holds that file and will act on your report.
