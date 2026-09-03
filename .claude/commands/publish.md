---
description: Pre-flight the current branch and walk the merge to the live site
allowed-tools: Bash(node tools/check.js:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*)
---

Merging to `main` deploys the live site. Before anything is merged, establish
that the branch is actually ready:

1. `node tools/check.js --verify` — nothing stale, suite green.
2. `git status --short` — show me exactly what would go out, and flag any
   file that is not part of the change I asked for.
3. `git log --oneline origin/main..HEAD` — the commits this would publish.

Then report what you found and **stop**. Do not merge or push.

Tell me plainly whether the branch is ready, and specifically whether I still
need to open the site in a foreground tab and confirm a chart draws — the
suite never renders one, so that check is mine to make and it is the failure
mode this project has actually hit.

The deploy push is denied to you in `.claude/settings.json`, deliberately: the
one pre-flight that matters cannot be automated, so the push stays mine. Give
me the sequence to paste into my own terminal rather than offering to run it:

```bash
git pull --rebase origin main
git checkout main && git merge --ff-only <branch>
git push origin main
```

Afterwards, remind me the deploy is not instant. Checking the live URL within
seconds returns the previous commit's files, which reads exactly like a broken
deploy. Give it a couple of minutes before concluding anything is wrong.
