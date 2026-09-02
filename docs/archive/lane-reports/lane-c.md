# Lane C report — deploy surface

## Shipped

- Added `404.html`, a self-contained bench-style page with copied light/dark
  tokens and font stack, a resting SVG instrument, `READING NOT FOUND` in the
  display, responsive layout, visible focus treatment, and three internal
  navigation targets including the two required desk links.
- Added the exact `robots.txt` crawler policy and a single-URL `sitemap.xml`
  for `https://yazeed.blog/` with `lastmod` `2026-09-01`.
- Appended the guarded-context explanation and `ErrorDocument 404 /404.html`
  outside the `mod_rewrite` guard in `.htaccess`.

## Gate evidence

```text
Formula baseline: 132/132 passed
Edge cases + empty state + division guards: 7933/7933 passed
Chart builders: 2464/2464 passed
```

Required Apache guard check:

```text
  inside    RewriteEngine On
  inside    RewriteCond %{HTTP_HOST} ^www\.yazeed\.blog$ [NC]
  inside    RewriteRule ^(.*)$ https://yazeed.blog/$1 [R=301,L]
  inside    RewriteRule ^pm-calculation-desk\.html$    /#calc-sections  [R=301,L]
  inside    RewriteRule ^wbs-estimation-toolkit\.html$ /#calc-sections  [R=301,L]
```

Additional checks passed:

- `git diff --check`
- `404.html` is 9,885 bytes, below the 10KB limit, with no JavaScript or
  ES6 syntax.
- `sitemap.xml` parses and contains only the canonical homepage.
- Headed browser QA passed at 1280×768 and 390×844 in light and dark modes.
- Keyboard focus was verified on the brand, Back to the desk, and Browse
  calculators links; computed hit boxes are at least 44px high.
- Independent visual QA passes A and B returned `PASS` with no blockers.

Fresh visual evidence is in the local temporary captures and the reviewer
reports under `.omo/evidence/`. The production `curl` 404 status check remains
post-merge work because Apache is not available in this worktree.

## AGENTS.md wording for Claude Code

- Add `404.html`, `robots.txt`, and `sitemap.xml` to the deployed artifact/file
  table.
- Document that `ErrorDocument 404 /404.html` is core Apache configuration and
  intentionally sits outside the `mod_rewrite` guard.
- Keep the existing note that the live 404 status check is performed after a
  deploy; this lane cannot verify Apache locally.

## Scope note

No commit or push was made. The worktree is `codex/deploy-surface`; the only
implementation files changed are Lane C files plus this lane report.
