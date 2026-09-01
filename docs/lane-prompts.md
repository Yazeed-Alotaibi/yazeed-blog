# Lane prompts — paste one into each Codex CLI

Setup first (run once, in your main checkout), then paste the matching block
into each of the four CLIs. Each prompt is self-contained: it names the lane's
worktree, its files, its guardrails, and where the detail lives.

---

## Setup — run this once, on your machine

```bash
cd <your main checkout>
git checkout main && git pull origin main      # must include 04d996a

git worktree add ../yazeed-blog-codex-a -b codex/desk-state      origin/main
git worktree add ../yazeed-blog-codex-b -b codex/test-crush      origin/main
git worktree add ../yazeed-blog-codex-c -b codex/deploy-surface  origin/main
git worktree add ../yazeed-blog-codex-d -b codex/content-pack    origin/main
```

Then start each CLI **inside its own worktree directory** — that is the
guardrail. Git refuses to check out one branch in two worktrees, so no agent
can end up standing on another's work.

```bash
cd ../yazeed-blog-codex-a && codex     # and so on for b, c, d
```

**Start B, C and D immediately. Start A too** — its first three steps (A1, A2,
A4) need nothing from anyone. A pauses before A3/A5/A6 until D's pack is merged.

---

## Lane A — paste into CLI 1

```
You are Lane A of a four-agent parallel operation on yazeed.blog. You are in
the worktree ../yazeed-blog-codex-a on branch codex/desk-state.

Read docs/parallel-plan.md in full, then work section §2 (Lane A). Also read
AGENTS.md — its hard constraints and design language are binding and this
prompt does not override them.

You are the ONLY agent permitted to edit index.html. You own exactly:
index.html, og.png, design/og-card.source.html. Touch nothing else. Never
`git add -A` — stage your files by name.

Do A1 (copy-link URL state), A2 (localStorage session restore) and A4 (`/`
focuses search) NOW, in that order, each as its own commit, each verified
before starting the next.

Then STOP and report. A3 (worked examples), A5 (Earned Schedule card) and A6
(citations) depend on Lane D's content pack landing on main first. Do not
invent that content yourself.

House style is not optional: ES5 only (var, IIFEs, 'use strict' — no let,
const or arrow functions), colours only via CSS custom properties (never a
hex literal in a rule), depth only via --lip and --sunk, numbers mono with
tabular-nums, 44px minimum touch targets, prefers-reduced-motion respected,
and meaning never carried by colour alone. No new dependencies, no build
step, no external requests beyond the existing Google Fonts stylesheet.

Gate before every push (all of it, every time):
1. node tests/baseline.js && node tests/edge-cases.js && node tests/charts.js
2. Open the page in a FOREGROUND browser tab at 1440px, 768px and 390px, in
   both light and dark. Charts do not draw in a background or hidden tab —
   document.visibilityState must be 'visible' or your check is noise, and
   AGENTS.md records a false alarm this exact mistake already caused once.
3. Fill a card, copy its link, open that link in a fresh tab, confirm the
   readings come back identical.
4. Keyboard-only pass over every control you added: reachable, operable,
   visible focus.
5. Confirm no new network requests and no ES6 syntax in your diff.

Push codex/desk-state only. Never merge to main — main is the live site.
Write docs/lane-reports/lane-a.md before your final push.
```

---

## Lane B — paste into CLI 2

```
You are Lane B of a four-agent parallel operation on yazeed.blog. You are in
the worktree ../yazeed-blog-codex-b on branch codex/test-crush.

Read docs/parallel-plan.md in full, then work section §3 (Lane B). Also read
AGENTS.md.

You own everything under tests/ and nothing else. index.html is held by
another agent — read it freely, never edit it. Never `git add -A`.

Your mission is to make the suite dramatically faster and smaller while
proving it lost no power. Measured baseline on main: 10,529 assertions in
~685ms across three files. The waste is structural — each file re-parses the
same 245KB page via H.loadPage, and edge-cases.js runs SWEEPS = 24 blind
rotations of the same edge tables per card and output.

Targets: one command `node tests/run.js`, the page parsed ONCE, total wall
time under 400ms, at most 2,500 assertions total. Individual suite files must
still run standalone for debugging. Keep the existing one-line-summary output
style.

Then spend the reclaimed budget on the coverage that does not exist yet:
tests/stylesheet.js, tests/redirects.js, a counts-drift test, and guarded
earned-schedule vectors. §3 B4 specifies all four precisely — including two
allowlist exceptions you MUST honour or you will fail correct code: the
@media print block deliberately uses bare #fff/#000/#999 (paper is not the
screen palette), and #cat-nav's mask-image gradients use #000 as an alpha
stencil that is never painted. Allowlist by enclosing block, not by value.

Two proofs are required in your report, and the work is not done without
them:
1. A coverage manifest — every behaviour class, assertions before and after,
   showing nothing was dropped, only deduplicated.
2. A mutation smoke test — copy index.html to a temp dir, flip one operator
   in three different formulas, point your runner at the copy, and show the
   crushed suite failing all three. Include the transcript.

A note before you start: assertion 1 of tests/stylesheet.js (brace balance)
must PASS on main. An older document said to expect it to fail; that is stale,
the unclosed @media was fixed in commit d118909. If it fails now, you have
found a real regression — report it, do not edit index.html.

Push codex/test-crush only. Never merge to main.
Write docs/lane-reports/lane-b.md before your final push.
```

---

## Lane C — paste into CLI 3

```
You are Lane C of a four-agent parallel operation on yazeed.blog. You are in
the worktree ../yazeed-blog-codex-c on branch codex/deploy-surface.

Read docs/parallel-plan.md in full, then work section §4 (Lane C). Also read
AGENTS.md.

You own: 404.html (new), robots.txt (new), sitemap.xml (new), and .htaccess.
Nothing else — index.html belongs to another agent. Never `git add -A`.

Build a branded 404 page in the site's own language: the bench metaphor, an
instrument face with the needle at rest, "READING NOT FOUND", one line of body
copy, and two links of at least 44px back to / and to /#calc-sections. It must
be fully self-contained — inline CSS, tokens and font stack COPIED from
index.html's :root rather than shared, light and dark via
prefers-color-scheme. Under about 10KB. JavaScript is not needed; if you add
any it must be ES5.

Then robots.txt and a single-URL sitemap.xml (the two retired stub pages 301
and must not be listed).

Then append to .htaccess, AFTER and OUTSIDE the <IfModule mod_rewrite.c>
block, an `ErrorDocument 404 /404.html` line with a comment explaining why it
sits outside: ErrorDocument is core Apache, not mod_rewrite, so unlike a bare
RewriteRule it cannot return 500 on a host missing the module. Do not touch
the existing rules — a rewrite directive escaping that guard returns 500 for
every page on the site.

Gate: run the awk guard check from AGENTS.md and paste its output in your
report — every Rewrite* line must still print "inside". Open 404.html in a
foreground browser tab at desktop and 390px, light and dark, and tab through
the links. Note in your report that the live 404 status check can only happen
after merge, since there is no Apache in the worktree.

Push codex/deploy-surface only. Never merge to main.
Write docs/lane-reports/lane-c.md before your final push.
```

---

## Lane D — paste into CLI 4

```
You are Lane D of a four-agent parallel operation on yazeed.blog. You are in
the worktree ../yazeed-blog-codex-d on branch codex/content-pack.

Read docs/parallel-plan.md in full, then work section §5 (Lane D). Also read
AGENTS.md.

You write NO site code. You own exactly one new directory, docs/content/, and
produce three files there. index.html is held by another agent: read it as
much as you like, never edit it. Never `git add -A`.

You are writing for a PMI-RMP / PRINCE2 audience, so terminology must be
exactly right, and you are writing for another agent to integrate mechanically
— be precise enough that Lane A never has to make a judgement call.

1. examples.json — one realistic worked example per calculator id in PM_DATA
   (33 of them). Every value set must pass that card's guards: verify it,
   don't assume. tests/harness.js loadPage gives you the real page sandbox;
   using it read-only to check your values is encouraged. Across the 33, mix
   the verdicts deliberately — an all-green desk teaches nothing. Notes of 90
   characters or fewer, plain English.

2. earned-schedule-spec.md — a complete card specification. Earned Schedule is
   the most credible gap in the site: SPI converges to 1.0 near project end
   even on late projects, and ES/SPI(t) is the accepted fix. Specify inputs,
   formulas with guards exactly as §5 D2 lists them, the linear-PV assumption
   stated loudly in the card copy, verdict tiers, meanings, a three-step how-
   to, a chart spec using only the EXISTING chart builders, and at least six
   test vectors as a fenced JSON block including one case per guard. Lane B
   consumes those vectors mechanically, so the format matters.

3. citations.md — one line per domain, 14 lines, naming the governing source.
   Exact strings Lane A will paste verbatim, 80 characters or fewer, URLs only
   where a canonical free one exists.

Flag in your spec that this card takes the site from 33 calculators and 99
metrics to 34 and 103 — that ripple is Lane A's checklist and it triggers an
og.png re-render.

Push codex/content-pack only. Never merge to main.
Write docs/lane-reports/lane-d.md before your final push.
```

---

## Your merge order afterwards

B, then C, then D — any order, as each lane's gates pass. **A last**, after D
is on main and A has rebased onto it and re-run its full gate list. That
ordering is deliberate: by the time A merges, B's counts test and earned-
schedule vectors are judging A's work.

Publishing is the flow in AGENTS.md (`git pull --rebase origin main`,
`git merge --ff-only <branch>`, `git push origin main`). Only A and C change
what deploys.
