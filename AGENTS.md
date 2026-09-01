# yazeed.blog — agent guide

Project management tools and resources by Yazeed Alotaibi (PMI-RMP · PRINCE2),
published at yazeed.blog. This file is the source of truth for both Claude Code
and Codex. `CLAUDE.md` imports it, so edit this file — never duplicate rules
into a second one.

## What this project is

A static site. Self-contained HTML files at the repository root, served
directly with no build step:

| File | What it is |
|---|---|
| `index.html` | The whole site — sidebar shell, hero with a live earned-value gauge, the About/Record section, and 14 domains · 34 calculators · 103 metrics rendered from a `PM_DATA` object |
| `404.html` | The branded not-found page — bench styling copied inline (not shared), an instrument at rest reading "READING NOT FOUND," and links back to the desk. Apache serves it via `ErrorDocument 404` in `.htaccess` |
| `og.png` | The 1200×630 card shown when a link to the site is shared. The one image the site ships |

`robots.txt` and `sitemap.xml` complete the deploy surface — a crawler policy
and a single-URL sitemap for the canonical homepage. Both are edited by hand,
same as everything else here.

`og.png` is a rendered artifact, not a hand-drawn one: `design/og-card.source.html`
is the page it comes from, and that page's dial geometry is copied from the hero
instrument, so the card shows a real reading. Re-render it by screenshotting that
file at 1200×630 — and re-render it whenever the figures on it (14 · 34 · 103)
stop being true. Nothing automates this; the PNG is committed.

`tests/counts.js` is the tripwire for exactly that drift: it derives the three
figures from `PM_DATA` and checks them against the hero copy, the `<title>`,
the meta description, the JSON-LD and `og:image:alt`. It cannot see inside the
PNG, so a stale card is still the one thing you have to catch by looking.

Note it does not weaken the self-contained rule below. The *page* never requests
it — only a crawler unfurling a shared link does.

It was three files until the Calculation Desk was merged into `index.html` and
`pm-calculation-desk.html` / `wbs-estimation-toolkit.html` were deleted. Both
are recoverable from history if the WBS toolkit is ever wanted back.

The page shell is the Desk's: `body` is a two-column grid, a sticky
`aside.sidebar` (brand, search, 14-category nav) beside `main`. The landing
hero and the About section live at the top of `main`, above `#calc-sections`.

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
- **Respect `prefers-reduced-motion`.** `index.html` and `404.html` both do.

Copy the custom properties and font stack from `index.html` when adding a page —
consistency across the bench is the point.

## Tests

`node tests/run.js` is the complete dependency-free gate. It loads `index.html`
once and runs seven suites against that single parse: the formula baseline,
deliberate edge classes, chart specs, stylesheet integrity, redirect integrity,
published-count drift, and guarded Earned Schedule vectors (the last skips
until a card with `id: 'earned-schedule'` exists, then activates itself). Each
suite file (`tests/baseline.js`, `edge-cases.js`, `charts.js`, `stylesheet.js`,
`redirects.js`, `counts.js`, `earned-schedule.js`) is still directly runnable
on its own for debugging — it re-parses the page itself when run standalone.

Run `node tests/mutation-smoke.js` after changing the test harness or a
calculator formula: it copies `index.html`, flips one operator in three
different formulas, and asserts the suite fails all three. A mutation it can't
kill means the coverage regressed.

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
so it redeploys itself on a push to main. The deployed artifact is `index.html`,
`404.html`, `og.png`, `robots.txt`, `sitemap.xml`, `.htaccess` and the two
redirect stubs described below. There is deliberately no CI here: no workflow,
no build, no `CNAME`.

`.htaccess` is the one piece of host config in the repository. Apache reads it
on the origin, and it answers 301 for the three addresses that are not the
canonical one: `www.yazeed.blog`, and the two retired tool pages
`pm-calculation-desk.html` and `wbs-estimation-toolkit.html`.

Every directive in it sits inside `<IfModule mod_rewrite.c>`, and any new one
must too. That guard is the whole safety model: on a host without the module a
guarded file is silently inert, while a bare `RewriteRule` outside it is a
configuration error that returns **500 for every page on the site**. Verify
before pushing — the guard only protects what it wraps:

```bash
awk '/^[[:space:]]*#/ {next}
     /<IfModule/  {d=1}
     /<\/IfModule>/ {d=0}
     /Rewrite(Rule|Cond|Engine)/ {print (d ? "  inside  " : "OUTSIDE! ") $0}' .htaccess
```

`.htaccess` also carries one line the guard above does not cover on purpose:
`ErrorDocument 404 /404.html`, appended after and outside the `<IfModule>`
block. `ErrorDocument` is core Apache, not `mod_rewrite` — unlike a bare
`RewriteRule` it cannot 500 a host that lacks the module, so it needs no guard.
`tests/redirects.js` checks the rewrite rules; it does not check this line,
since there is no Apache in the test environment to serve a 404 against.

The two stub HTML files are kept on purpose even though the 301s mean nothing
ever reaches them. If mod_rewrite disappears, the guard switches the redirects
off and the stubs' `<meta http-equiv="refresh">` still carries visitors to the
right place — worse for search, but never a dead link. Deleting them removes
that fallback.

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
