# yazeed.blog — agent guide

Project management tools and resources by Yazeed Alotaibi (PMI-RMP · PRINCE2),
published at yazeed.blog. This file is the source of truth for both Claude Code
and Codex. `CLAUDE.md` imports it, so edit this file — never duplicate rules
into a second one.

## What this project is

A static site. Three self-contained HTML files at the repository root, served
directly with no build step:

| File | What it is |
|---|---|
| `index.html` | Landing page — hero, a live earned-value calculator, and the tools grid |
| `pm-calculation-desk.html` | 14 domains · 33 calculators · 99 metrics, rendered from a `PM_DATA` object |
| `wbs-estimation-toolkit.html` | Work breakdown structure with three-point PERT estimation |

Two further tools are announced on the landing page as `Building` cards and have
no file yet: **Project Status Dashboard** and **AI Scope Statement Generator**.
They appear twice on `index.html` — in the hero's "On the bench" list and in the
tools grid. Both listings must agree; they have drifted apart before.

## Hard constraints

These are not preferences. Breaking one breaks the site's premise.

- **No build step.** No bundler, no transpiler, no framework. A file you open
  in a browser is the shipped artifact.
- **No dependencies.** No npm packages, no CDN scripts. The only external
  request any page makes is the Google Fonts stylesheet.
- **Self-contained pages.** CSS in a `<style>` block, JavaScript in a `<script>`
  block, both inline in the page that uses them. Pages do not share files.
- **Client-side only.** Every calculation runs in the visitor's browser. No
  backend, no analytics, no telemetry. The footers promise "nothing is sent
  anywhere" — that promise is load-bearing.
- **Plain ES5-compatible JavaScript.** Existing code uses `var`, IIFEs, and
  `'use strict'`. Match it.

## Design language

The site is styled as a bench of calibrated instruments. Light mode is the
instrument under daylight — putty enamel body, off-white dial faces, engraved
near-black lettering; dark mode is the same instrument lit from within.
Structure comes from panel conventions: milled recesses, engraved label plates,
graduated scales, tabular figures.

- **Typefaces.** Big Shoulders Display (headings only — it is condensed and set
  uppercase, so it is wrong for names, small labels, and text fields),
  Libre Franklin (body), IBM Plex Mono (labels, all numbers).
- **Colour.** Defined once as custom properties in `:root`, overridden under
  `@media (prefers-color-scheme: dark)`. Never hardcode a hex value in a rule —
  add a property.
- **Indigo `--accent` is the brand mark only.** It is never a verdict, so it can
  never be confused with the good/warn/bad scale.
- **Numbers** are always mono with `font-variant-numeric: tabular-nums`.
- **Meaning never depends on colour alone.** The hero gauge on `index.html`
  plots a verdict by needle position and states it as a word; the status track
  on the desk fills one of three graduated positions. Both survive greyscale and
  colour blindness. Any new status indicator must do the same.
- **Depth is `--lip` and `--sunk`**, never an ad-hoc shadow. A lip catches the
  light on a raised panel; a recess swallows it on a sunken one.
- **Minimum 44px touch targets** on anything interactive.
- **Respect `prefers-reduced-motion`.** All three pages already do.

Copy the custom properties and font stack from `index.html` when adding a page —
consistency across the bench is the point.

## Tests

`node tests/baseline.js`, `tests/edge-cases.js`, `tests/charts.js`. They run on
plain node with no dependencies, and they cover the arithmetic: formula results
against known values, division and overflow guards, and the chart builders.

**They do not render anything.** The builders are pure functions returning spec
objects, and that is where the coverage stops — nothing mounts a chart in a
document. A chart can be broken by CSS or by layout measurement while every one
of those checks still passes, which has happened: a rule that hid an empty
plot zeroed its width, and the width guard in `draw()` then refused to redraw
it, stranding all thirty charts on their empty state permanently. The suite was
green throughout.

So a green run is not evidence that a chart draws. Open the page and look at it.
Adding a browser to the test suite would mean adding a dependency, which the
hard constraints above rule out — the manual check is the deliberate trade.

### Look at it in a foreground tab

A chart draws from an `IntersectionObserver` — the plot is built only once the
reader can plausibly see it. Chrome defers observer callbacks in a hidden or
backgrounded tab, so `inst.visible` never flips and `update()` never reaches
`inst.draw()`. A check run headlessly, or driven by automation in a tab sitting
behind another window, therefore finds every chart stranded on its empty state
and reports the whole desk broken — with measurements that look conclusive.

That has already produced one false alarm: thirty charts declared dead, when the
only thing wrong was that nobody was looking at the tab.

Before trusting any rendering result, confirm the page was actually visible:

```js
document.visibilityState === 'visible'   // must be true, or the result is noise
```

A blank plot is evidence of a fault only when that holds *and* the calculator
above it has values in its fields. An untouched calculator has no spec to plot,
so its empty state is correct — on a desk where you have filled in one
calculator, twenty-nine blank charts are the expected result, not a symptom.

## Skills

Vendored into the repository so both agents get the same guidance:

- `.claude/skills/` — read by Claude Code
- `.agents/skills/` — read by Codex

Both contain `frontend-design` and `ui-ux-pro-max`, pinned in `skills-lock.json`.
Install more with `npx skills add <source>`, which writes to both paths and
updates the lock file. Commit all three.

## Working concurrently

Claude Code and Codex both work this repository at the same time. Isolation is
structural, not a matter of remembering to be careful.

### Layout

| Directory | Agent | Branch prefix |
|---|---|---|
| `projects/yazeed-blog` | Claude Code | `claude/` |
| `projects/yazeed-blog-codex` | Codex | `codex/` |

The second is a git worktree, not a clone — it shares one object store. Create
or recreate it with:

```bash
git worktree add ../yazeed-blog-codex -b codex/<task>
```

Git refuses to check out the same branch in two worktrees. That refusal is the
guardrail: neither agent can end up standing on the other's work.

### Rules

1. **Stay in your own worktree.** Never edit, stage, or commit a file outside it.
2. **Never `git add -A`.** Stage the specific files you were assigned. A blanket
   add is how one agent commits the other's half-written work.
3. **One agent per file.** Tasks are assigned so that two agents never hold the
   same file open. If you need to change a file outside your assignment, stop
   and say so rather than editing it.
4. **Rebase before you publish.** `git pull --rebase origin main` before merging,
   so main stays linear and conflicts surface in your worktree, not on the remote.
5. **Publishing goes live.** main is the published site — merging is deploying.
   Verify in a browser first. Deployment lags the push by a minute or two.

### Publishing a finished unit

```bash
git pull --rebase origin main
git checkout main && git merge --ff-only <your-branch>
git push origin main
```

Hostinger serves yazeed.blog (`server: hcdn`, not GitHub Pages — the
`github.io` URL returns "Site not found") and is connected to this repository,
so it redeploys itself on a push to main. The three root HTML files are the
deployed artifact. There is deliberately no CI here: no workflow, no `CNAME`,
no host config to keep in sync.

**The deploy is not instant.** Checking the live URL seconds after a push
returns the *previous* commit's files, which reads exactly like a broken
deploy. Give it a couple of minutes before concluding anything went wrong.

When you do need to know what is deployed, compare it to a commit rather than
eyeballing the page:

```bash
curl -sSL -o /tmp/live.html https://yazeed.blog
git show <commit>:index.html > /tmp/want.html
cmp /tmp/live.html /tmp/want.html && echo "live matches <commit>"
```

If it still lags well past a few minutes, `x-hcdn-cache-status` in the
response headers separates the two causes: `DYNAMIC` means Hostinger's origin
itself served those bytes, so the deploy has not landed. A cache status means
you are looking at a CDN copy and the origin may already be current.
