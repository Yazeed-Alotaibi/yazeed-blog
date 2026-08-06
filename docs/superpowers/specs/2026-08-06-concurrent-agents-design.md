# Concurrent agents on yazeed.blog

**Date:** 2026-08-06
**Status:** approved

## Problem

Claude Code and Codex should both work this repository at the same time. Run
naively — two autonomous agents in one working directory — the failure is
immediate and silent: either agent running `git add -A` sweeps up the other's
half-written files, and both race to push `main`. Neither agent can detect that
it happened.

The site is also three self-contained HTML files with no build step, no tests,
and no config. Nothing in the repository currently tells an agent what the
conventions are; the constraints live only in the existing code's shape.

## Design

### One instruction file, two readers

`AGENTS.md` at the repository root holds every project convention. Codex reads
it natively. `CLAUDE.md` is a stub that imports it with `@AGENTS.md`, so Claude
Code sees identical rules with no second copy to drift out of sync.

It documents what the project is, the hard constraints (no build step, no
dependencies, self-contained pages, client-side only, ES5-compatible
JavaScript), the whiteprint drafting design language, and the concurrency
protocol below.

### Isolation through worktrees

Codex works from `projects/yazeed-blog-codex`, a git worktree sharing this
repository's object store. Not a clone: one `.git`, no duplicated history, no
separate fetch cycle.

The mechanism carries the guarantee. Git refuses to check out one branch in two
worktrees simultaneously, so the agents cannot stand on the same work — the tool
enforces it rather than a convention asking them to be careful. Branch prefixes
`claude/` and `codex/` keep ownership legible in `git branch`.

Rejected alternatives: a shared working directory with a file-ownership table
(nothing enforces it, and a single `git add -A` defeats it), and a full second
clone (same isolation as a worktree, but duplicates the object store and needs
its own fetch/push cycle for no gain).

### Task assignment

You assign work to each agent directly. No claims file, no issue queue. With two
agents and one person directing them, coordination machinery would cost more to
maintain than it saves, and a stale claims file is worse than none.

Assignments are made file-by-file so two agents never hold the same file open.
An agent that needs to touch a file outside its assignment stops and says so.

### Publishing

`main` is the published site, so merging is deploying. Each agent rebases on
main, fast-forwards, and pushes. This preserves the existing "changes go live
immediately" workflow while removing the race — conflicts surface locally in a
worktree instead of as a rejected push.

## Scope

In: `AGENTS.md`, `CLAUDE.md`, the Codex worktree, repository-local git identity.

Out: CI, tests, and a build step — all three are excluded by the site's premise,
not merely unbuilt. Also out: any change to the two existing HTML pages.

## Verification

- `git worktree list` shows both directories on different branches.
- Checking out a `claude/` branch inside the Codex worktree fails, confirming the
  guardrail is real rather than documentary.
- A commit from one worktree does not appear as pending work in the other.

## First tasks under this setup

Claude takes the WBS Estimation Toolkit — `wbs-estimation-toolkit.html` plus the
card flip in `index.html` — on a `claude/` branch. That leaves the Project Status
Dashboard and the AI Scope Statement Generator, both already advertised on the
homepage, free for Codex.
