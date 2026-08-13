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
| `wbs-estimation-toolkit.html` | *(in progress)* Work breakdown structure with three-point PERT estimation |

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
   Verify in a browser first.

### Publishing a finished unit

```bash
git pull --rebase origin main
git checkout main && git merge --ff-only <your-branch>
git push origin main
```
