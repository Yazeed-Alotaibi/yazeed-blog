---
description: Scaffold a new per-calculator page from a calculator on the desk
argument-hint: "<slug> --card <card-id>"
allowed-tools: Bash(node tools/newpage.js:*), Bash(node tools/check.js:*)
---

Scaffold a new per-calculator page:

```bash
node tools/newpage.js $ARGUMENTS
```

If I gave no arguments, or a card id you cannot confirm exists, run
`node tools/newpage.js --help` and list the known card ids rather than
guessing at one.

The tool writes the prose stub, the manifest entry, the sitemap entry and the
desk link. What it leaves is the part that needed a person, so once it
succeeds:

1. Draft `content/<slug>.html` — **at least 1000 words** of plain text with
   tags stripped. Write it as practitioner prose that works the same numbers
   the calculator opens with, so a reader can follow along in the instrument
   above. Not a keyword page.
2. Replace the placeholder `title`, `description` and `lede` in
   `content/pages.json`. The title must fit 62 characters; the description
   must be 110 to 175.
3. Run `node tools/check.js` and fix anything it reports.

Show me the draft prose before running the check, so I can redirect the angle
of the page while it is still cheap to change.
