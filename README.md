# yazeed.blog

Project management tools by **Yazeed Alotaibi** (PMI-RMP · PRINCE2), published
at **[yazeed.blog](https://yazeed.blog)**.

A calculation desk of **14 domains, 34 calculators and 103 metrics** — earned
value, risk, estimation, schedule and quality — each with its formula, a live
chart, and a one-click export to a real Excel workbook with a native editable
chart in it. Everything computes in the visitor's browser.

## The unusual thing about this repository

**There is no build step.** The HTML files at the root are not compiled from
anything — they are the exact bytes a visitor receives. No bundler, no
framework, no npm packages, no CDN. You can open `index.html` from your
filesystem and the whole site works.

That is a deliberate constraint, and it is the reason the repository looks the
way it does. Read `AGENTS.md` before changing how anything works.

There *are* two generators, but they run **before you commit**, not when a
visitor loads a page. They copy calculator definitions out of `index.html` into
the standalone pages and into a static text mirror for search engines. Their
output is committed. Keeping that output in step with its source is the single
thing this project's tooling exists to enforce.

## The loop

You need `node` on your PATH. Nothing else — no install step, because there is
nothing to install.

```bash
node tools/check.js
```

Run that after any change. It regenerates the pages, rewrites the static
mirror, and runs all 2,326 tests, in that order because each step reads the one
before it. One command instead of three in a particular sequence.

```bash
node tools/check.js --verify    # change nothing; fail if committed output is stale
```

Then look at the site, because the tests never do:

```bash
python -m http.server 4173      # http://localhost:4173
```

## A green test run does not mean it works

Two gaps are known and deliberate. Closing either would mean adding a
dependency, which the no-dependencies rule rules out. The manual check is the
trade.

- **No chart is ever drawn.** The chart builders are pure functions returning
  spec objects, and coverage stops there. A CSS rule once zeroed a plot's width
  and stranded all thirty charts on their empty state permanently, with the
  suite green throughout.
- **No workbook is ever opened.** The export tests check the ZIP, its parts and
  its CRCs, but nothing opens the file. Excel rejects out-of-order XML that
  every one of those assertions accepts.

So open the page and look at it — **in a foreground tab**. Charts build from an
`IntersectionObserver`, and Chrome defers those callbacks in a hidden or
backgrounded window. Checked headlessly, every chart appears dead. That false
alarm has been raised here once already.

## Adding a calculator page

```bash
node tools/newpage.js <slug> --card <calculator-id>
```

That handles the four mechanical edits — prose stub, manifest entry, sitemap
entry, and the link from the desk. You then write the prose (1,000 words
minimum, enforced) and replace the placeholder title and description, then run
`node tools/check.js`.

## What lives where

| Path | What it is |
|---|---|
| `index.html` | The whole site: the desk, every calculator, and the Excel writer |
| `*.html` (root) | Generated standalone calculator pages, committed and served as-is |
| `404.html`, `og.png`, `robots.txt`, `sitemap.xml`, `fonts/`, `.htaccess` | The rest of the deployed surface |
| `content/` | Long-form prose and the page manifest |
| `tools/` | The commit-time generators, plus `check.js` and `newpage.js` |
| `tests/` | The dependency-free suite |
| `docs/`, `design/` | Reference material and design sources |
| `AGENTS.md` | **The source of truth** for how this project works |

Everything below the root HTML files is repository furniture. `.htaccess`
answers 404 for those paths, so none of it is reachable on the live site.

## Deploying

`main` is the published site — **merging is deploying**. Hostinger redeploys on
a push to `main`, and takes a couple of minutes, so checking the live URL
immediately shows you the *previous* commit and looks exactly like a broken
deploy.

## Working with Claude Code or Codex

Both read `AGENTS.md`; `CLAUDE.md` just imports it, so there is one copy of the
rules and never two that disagree.

A shared `site-workflow` skill describes this loop to both agents, and Claude
Code additionally has `/check`, `/new-page` and `/publish` as slash commands.
`.claude/settings.json` pre-approves the project's own scripts and read-only
git, so routine work stops asking permission, and denies `git add -A` and
pushing to `main` — the two mistakes that are expensive here rather than merely
annoying.

## Licence

Fonts under `fonts/` ship under the SIL Open Font License; see
`fonts/OFL.txt`. The site content and code have no licence declared yet.
