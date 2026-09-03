---
name: site-workflow
description: The commit workflow for yazeed.blog — regenerating the committed output, adding a per-calculator page, and publishing to the live site. Use when editing calculator data in index.html, adding or editing anything under content/, adding a new calculator page, running the tests, or merging to main.
---

# yazeed.blog — the working loop

This site has **no build step at serve time**, but it does have generators
that run **at commit time**. Their output is committed and is what visitors
receive. That is the whole reason this skill exists: the generated files can
fall out of step with their source, and a page that describes a calculator
which no longer works that way is the failure this workflow prevents.

`AGENTS.md` at the repository root is the source of truth for everything
else — the hard constraints, the design language, the export internals. Read
it before changing how anything works. This file is only the loop.

## The one command

```bash
node tools/check.js
```

It runs three things in the order they depend on each other:

1. `tools/calcpage.js --all` — regenerates every per-calculator page, because
   those pages embed the calculator definitions lifted out of `index.html`.
2. `tools/prerender.js` — rewrites the static mirror inside `index.html`,
   including the desk's link to each generated page.
3. `tests/run.js` — the full suite, which reads both results.

Run it after **any** change to calculator data in `index.html` or to anything
under `content/`. Running the steps out of order fails the suite on work you
have already done; skipping one fails it on work you have not.

```bash
node tools/check.js --verify
```

The read-only form. It changes nothing and fails if committed output is
stale. Use it on a tree you did not just edit — a fresh clone, someone
else's branch, or your own work immediately before publishing.

## What the tests cannot see

A green suite is **not** evidence that the site works. Two gaps are known and
deliberate, because closing either would mean adding a dependency:

- **No chart is ever drawn.** The chart builders are pure functions returning
  spec objects, and that is where coverage stops. CSS or a layout measurement
  can break every chart on the desk with the suite still green — this has
  happened. Open the page and look at it.
- **No workbook is ever opened.** The export tests check the ZIP, the parts,
  the CRCs and the series references, but nothing opens the result. OOXML
  child-element order is a sequence, and Excel answers an out-of-order child
  with "we found a problem with some content" rather than with the chart. If
  you changed the export XML, export a card and open the file.

### Look at the chart in a foreground tab

Charts build from an `IntersectionObserver`, and Chrome defers those
callbacks in a hidden or backgrounded tab. A page checked headlessly, or by
automation behind another window, shows **every chart stranded on its empty
state** — which looks exactly like the whole desk being broken, with
measurements that look conclusive. That false alarm has already been raised
once here.

Before trusting any rendering result, confirm the page was actually visible:

```js
document.visibilityState === 'visible'   // must be true, or the result is noise
```

And note that a blank plot is a fault only if the calculator above it has
values in its fields. An untouched calculator has no spec to plot, so on a
desk where you filled in one calculator, the other blank charts are correct.

To serve the site locally:

```bash
python -m http.server 4173     # then open http://localhost:4173
```

## Adding a per-calculator page

A new page is five edits across four files, and `tests/pages.js` gates every
one. Scaffold the mechanical four:

```bash
node tools/newpage.js <slug> --card <card-id>
```

That writes the prose stub in `content/`, the manifest entry in
`content/pages.json`, the `sitemap.xml` entry, and the `page:` field on the
calculator in `index.html` that makes the desk link to it. It refuses to
overwrite anything that already exists, and it re-parses `index.html` after
editing to confirm the edit was sound, restoring the original bytes if not.

Then do the part that needed a person:

1. Write `content/<slug>.html`. **At least 1000 words** of plain text, counted
   with tags stripped. That minimum is not bureaucracy: a shorter page is the
   shape Google filters as built for rankings rather than for readers.
2. Replace the placeholder `title`, `description` and `lede` in
   `content/pages.json`. The title must fit **62 characters** and the
   description must be **110 to 175**. Both are checked.
3. `node tools/check.js`

Adding a `page:` field ripples further than it looks: every generated page
embeds the whole of `PM_DATA`, so a new page changes related-links inside
pages that already shipped. That is why step 1 of `check.js` regenerates
*all* pages, not only the new one.

URLs keep the `.html` extension. Do not add extensionless rewrites unless
asked.

## Publishing

`main` is the published site. **Merging is deploying.** Verify in a browser
before you merge, not after.

```bash
node tools/check.js --verify        # nothing stale
git pull --rebase origin main
git checkout main && git merge --ff-only <your-branch>
git push origin main
```

Hostinger redeploys on a push to `main`. **The deploy is not instant** —
checking the live URL seconds later returns the previous commit's files,
which reads exactly like a broken deploy. Give it a couple of minutes.

To compare what is live against a commit rather than eyeballing it:

```bash
curl -sSL -o /tmp/live.html https://yazeed.blog
git show <commit>:index.html > /tmp/want.html
cmp /tmp/live.html /tmp/want.html && echo "live matches <commit>"
```

If it lags well past a few minutes, `x-hcdn-cache-status` in the response
headers separates the two causes: `DYNAMIC` means Hostinger's origin served
those bytes, so the deploy has not landed. Any cache status means you are
looking at a CDN copy and the origin may already be current.

## Staging rules

Claude Code and Codex work this repository at the same time, in separate
worktrees.

- **Never `git add -A`.** Stage the specific files you were assigned. A
  blanket add is how one agent commits the other's half-written work.
- **Stay in your own worktree**, and never edit a file outside your
  assignment. If you need one, stop and say so.
- Generated output is committed *with* the change that caused it. A commit
  that edits a calculator but not its regenerated page is a broken commit,
  even though the suite passes on the tree you are standing in.

## What you may not do

These are constraints, not preferences. Breaking one breaks the site's
premise. `AGENTS.md` carries the full list; these are the ones this loop
touches most:

- No build step at serve time, no bundler, no framework.
- No npm dependencies. These tools run on a bare `node`.
- No third-party request other than the named Google Analytics tag. No CDN,
  no hosted font, no embed.
- Every page self-contained: its CSS in a `<style>` block and its JavaScript
  in a `<script>` block, inline, in the page that uses them.
- Plain ES5-compatible JavaScript — `var`, IIFEs, `'use strict'`. Match the
  code around you.
