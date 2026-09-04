# Command Deck site replacement implementation plan

1. Create the root `DESIGN.md` from the approved Command Deck reference and repository constraints.
2. Build a self-contained primitive showcase for rail, command bar, KPI, panel, status, input, action, and dialog states; verify at 375, 768, and 1280.
3. Replace the homepage shell and hero presentation in `index.html` while preserving protected runtime mounts and modules.
4. Adapt the generated calculator-page shell in `tools/calcpage.js` and the standalone `404.html` to the same design system.
5. Run `node tools/check.js` once after source changes to regenerate committed output and execute the full repository gate.
6. Perform foreground-browser QA of the homepage, a generated calculator page, and 404; repair visual or interaction defects.
7. Stop with the completed replacement in this worktree. Do not merge, push, or publish.
