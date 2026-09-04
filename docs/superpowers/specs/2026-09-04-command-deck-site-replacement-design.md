# Command Deck site replacement design

## Goal

Replace the current bench-style presentation with the approved Command Deck visual system while preserving the existing static-site architecture, all 34 calculators, 103 metrics, project-local storage, chart rendering, share links, Excel export, generated analysis pages, SEO markup, and no-JavaScript prerender mirror.

The replacement remains local until the whole unit is complete and verified. This work does not merge, push, or publish.

## Architecture decision

The approved React/Tailwind/Shadcn/Recharts prototype is a visual and interaction reference, not a production runtime migration. The production repository explicitly forbids frameworks, dependencies, bundlers, and external scripts beyond Google Analytics. The new design is therefore ported into the existing self-contained HTML/CSS/ES5 implementation.

This preserves the site's direct-open behavior, static SEO output, spreadsheet export, calculator definitions, and generated-page contracts. Existing PM_DATA, PM_CHARTS, PM_EXPORT, PM_PROJECTS, and calculator runtime modules remain authoritative.

## Protected contracts

- Preserve `#calc-sections`, `#cat-nav`, `#search`, and `#desk-stats` mount points.
- Preserve project workspace control/dialog IDs used by the runtime.
- Preserve hero earned-value input/output IDs unless the second runtime IIFE changes in the same unit.
- Preserve calculator classes and data attributes consumed by `buildCard()` and `computeCard()`.
- Preserve script opening comments extracted by `tools/calcpage.js`.
- Preserve prerender marker comments and generated namespaced IDs/classes.
- Preserve local fonts, inline CSS/JS, ES5 syntax, status semantics, reduced motion, and 44px targets.

## Surface design

The desktop uses a dark navy command rail, a sticky light command bar, a pale operational canvas, four KPI readings, two analysis panels, and an active earned-value workspace with decision signals. The full calculator desk follows below in the same panel language. Mobile collapses the rail into an accessible drawer and stacks every analysis and calculator region to one column.

The current chart engine renders the data panels; Recharts is not added. Current local fonts replace prototype-only Geist. Indigo remains interaction/brand only and is never a verdict color.

## Content and data flow

The hero's EV, AC, and PV inputs remain live. CPI, SPI, CV, and SV continue to update through the existing instrument runtime. The overview adds BAC as a display-only reference where needed only if it can be derived or represented without creating a competing source of truth. Dashboard values must come from existing inputs/results, never duplicated constants after initialization.

Calculator cards continue to be generated from PM_DATA and keep their input, result, formula, chart, copy-link, export, and status contracts. Generated analysis pages copy the shared stylesheet and use generator-owned page CSS for their standalone shell.

## Responsive and accessibility behavior

- Document scroll is the primary scroll owner; sidebar and command bar remain sticky.
- Mobile drawer traps or manages focus using the existing no-dependency runtime, closes with Escape, and returns focus to its trigger.
- Search remains keyboard reachable and retains the `/` shortcut.
- Status uses Good, Watch, Action, or Current text plus positional/symbolic cues.
- Charts retain text captions and data tables.
- Layout is verified at 375, 768, and 1280 CSS pixels in a visible browser.

## Verification

1. Primitive showcase inspected at 375, 768, and 1280 before product composition.
2. `node tools/check.js` regenerates all dependent output and passes the dependency-free suite.
3. Homepage, at least one generated calculator page, and 404 are inspected in a foreground browser.
4. Earned-value inputs are changed and visibly update readings/charts.
5. Search, mobile navigation, project dialog, copy link, and one Excel export control are exercised.
6. No merge or push is performed.
