# yazeed.blog Command Deck Design System

## 1. Atmosphere & Identity

The site is a calm project-controls command deck: precise enough for a risk or controls lead, but readable at a glance during a meeting. Its signature is the contrast between a dark navy navigation rail and a daylight operational canvas, joined by a thin blue reporting line that makes the page feel like one coordinated instrument. The approved Command Deck prototype at `design/workbench-concepts/references/03-command-deck.png` is the reference-fidelity contract; the live implementation adapts it to the repository's self-contained HTML/CSS/ES5 architecture and bundled fonts.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Canvas | `--ground` | `oklch(0.97 0.006 255)` | `oklch(0.16 0.018 261)` | Main workspace |
| Panel | `--sheet` | `oklch(1 0 0)` | `oklch(0.21 0.02 261)` | Cards and dialogs |
| Recess | `--sheet-sunk` | `oklch(0.95 0.009 255)` | `oklch(0.18 0.018 261)` | Inputs and nested readings |
| Text | `--ink` | `oklch(0.20 0.025 262)` | `oklch(0.94 0.012 250)` | Primary text |
| Secondary text | `--ink-2` | `oklch(0.38 0.025 260)` | `oklch(0.74 0.018 255)` | Supporting copy |
| Muted text | `--ink-3` | `oklch(0.48 0.03 260)` | `oklch(0.62 0.02 255)` | Metadata and hints |
| Border | `--rule` | `oklch(0.87 0.015 255)` | `oklch(0.31 0.025 260)` | Panel dividers |
| Strong border | `--rule-2` | `oklch(0.76 0.02 255)` | `oklch(0.42 0.03 260)` | Active outlines |
| Brand accent | `--accent` | `oklch(0.55 0.19 258)` | `oklch(0.70 0.15 253)` | Links, focus, active navigation |
| Accent wash | `--accent-soft` | `oklch(0.92 0.03 255)` | `oklch(0.28 0.055 260)` | Selected and highlighted areas |
| Positive | `--good` | `oklch(0.48 0.13 157)` | `oklch(0.70 0.13 157)` | Favourable readings |
| Positive wash | `--good-soft` | `oklch(0.94 0.035 157)` | `oklch(0.25 0.055 157)` | Positive status background |
| Warning | `--warn` | `oklch(0.54 0.14 52)` | `oklch(0.76 0.13 70)` | Watch readings |
| Warning wash | `--warn-soft` | `oklch(0.95 0.035 70)` | `oklch(0.27 0.06 70)` | Watch status background |
| Critical | `--bad` | `oklch(0.54 0.19 25)` | `oklch(0.72 0.17 25)` | Action-required readings |
| Critical wash | `--bad-soft` | `oklch(0.95 0.035 25)` | `oklch(0.27 0.065 25)` | Critical status background |
| Navigation rail | `--strip` | `oklch(0.23 0.055 261)` | `oklch(0.12 0.025 261)` | Fixed desktop sidebar |
| Rail text | `--strip-ink` | `oklch(0.94 0.012 250)` | `oklch(0.94 0.012 250)` | Sidebar text and icons |
| Rail divider | `--strip-grid` | `oklch(0.37 0.05 260 / 0.55)` | `oklch(0.37 0.05 260 / 0.55)` | Sidebar separators |

The indigo accent is a brand and interaction color only. It never communicates a verdict. Every good, watch, and action state includes written status and a positional or symbolic cue, so meaning never depends on color alone. No color literal is used in a CSS rule outside custom-property declarations.

## 3. Typography

### Scale

| Level | Size | Weight | Line height | Tracking | Usage |
|---|---|---|---|---|---|
| Display | `clamp(2.25rem, 5vw, 4.5rem)` | 700 | 0.94 | `-0.005em` | Homepage statement only |
| H1 | `clamp(1.75rem, 3vw, 2.5rem)` | 700 | 1.05 | `-0.02em` | Page title |
| H2 | `clamp(1.35rem, 2vw, 1.75rem)` | 650 | 1.2 | `-0.015em` | Dashboard and category headings |
| H3 | `1.05rem` | 600 | 1.3 | `-0.01em` | Card titles |
| Metric | `clamp(1.7rem, 3vw, 2.35rem)` | 600 | 1 | `-0.03em` | KPI values |
| Body large | `1.05rem` | 400 | 1.6 | 0 | Lead copy |
| Body | `1rem` | 400 | 1.55 | 0 | Default prose |
| Body small | `0.875rem` | 400 | 1.5 | 0 | Supporting content |
| Caption | `0.75rem` | 500 | 1.4 | `0.02em` | Metadata |
| Overline | `0.6875rem` | 600 | 1.3 | `0.12em` | Uppercase labels |

### Font stack

- Display headings: `Big Shoulders Display`, bundled locally.
- Body and UI: `Libre Franklin`, bundled locally.
- Labels and every number: `IBM Plex Mono`, bundled locally, with tabular figures.

Display type is reserved for major headings. Names, navigation, field labels, and buttons remain in the body or mono face.

## 4. Spacing & Layout

All spacing intent derives from a 4px base.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `0.25rem` | Icon-to-label |
| `--space-2` | `0.5rem` | Compact control gaps |
| `--space-3` | `0.75rem` | Dense panel rhythm |
| `--space-4` | `1rem` | Standard card padding |
| `--space-5` | `1.25rem` | Comfortable grouping |
| `--space-6` | `1.5rem` | Default panel padding |
| `--space-8` | `2rem` | Dashboard group separation |
| `--space-10` | `2.5rem` | Category separation |
| `--space-12` | `3rem` | Major section separation |
| `--space-16` | `4rem` | Page-level rhythm |

- Desktop shell: 15.5rem fixed navigation rail plus fluid main region.
- The document owns vertical scroll; the rail and command bar use sticky positioning. Dialogs own their internal scroll.
- Main content max width is 90rem with fluid gutters.
- KPI grid: one column narrow, two columns from 40rem, four columns from 75rem.
- Analysis and decision regions stack below 75rem; above it they use asymmetric columns.
- Calculator grids use `repeat(auto-fit, minmax(min(22rem, 100%), 1fr))` so unbroken content cannot force horizontal scrolling.
- At 375px the rail becomes a modal drawer and the primary content reflows to one readable column.

## 5. Components

### Command rail

- **Structure**: brand, project trigger/actions, search, category navigation, progress/footer.
- **Variants**: fixed desktop rail; modal mobile drawer.
- **Spacing**: `--space-3`, `--space-4`, `--space-6`.
- **States**: default, hover, active category, focus, dimmed search result, writer-lock disabled.
- **Accessibility**: labelled navigation; drawer button exposes expanded state; Escape closes; focus returns to trigger.
- **Motion**: opacity/transform only; removed under reduced motion.
- **Layout**: fixed-sidenav shell; document remains the scroll owner.

### Command bar

- **Structure**: mobile menu trigger, contextual title, search shortcut, project/date context, export/action cluster.
- **Variants**: full desktop; compact mobile.
- **States**: default, hover, focus, pressed, disabled.
- **Accessibility**: 44px minimum targets and explicit labels for icon-only controls.
- **Layout**: sticky header with wrapping action cluster.

### KPI reading

- **Structure**: metric label, linked-reading marker, tabular value, status badge, plain-language description.
- **Variants**: good, watch, action, unavailable.
- **States**: default, linked hover/focus, unavailable/empty.
- **Accessibility**: status word is always visible; color is secondary; long and missing values do not collapse the card.
- **Layout**: stack primitive inside an intrinsic KPI grid.

### Data panel

- **Structure**: panel heading/actions, body, optional caption/data table.
- **Variants**: standard, active calculator, chart, empty.
- **States**: default, hover for interactive rows, focus-within, empty, error.
- **Accessibility**: semantic heading order; chart has text/table equivalent; no nested unlabeled scroll regions.
- **Layout**: stack; active calculator uses a two-column switcher when space permits.

### Status badge and status track

- **Structure**: written status plus optional marker/three-position track.
- **Variants**: Good, Watch, Action, Current.
- **States**: static; reading updates announced only in the appropriate live region.
- **Accessibility**: never color-only; high-contrast text; position or icon reinforces meaning.

### Input row

- **Structure**: label, unit/hint, numeric input, optional inline validation.
- **States**: default, hover, focus, filled, disabled, invalid.
- **Accessibility**: native label association, readable error text, 44px input, no placeholder-only labels.

### Action control

- **Structure**: text and optional inline SVG.
- **Variants**: primary, secondary, quiet, destructive.
- **States**: default, hover, active, focus, disabled, busy.
- **Accessibility**: semantic button/link, visible focus, icon-only controls have names.
- **Motion**: micro feedback uses transform/opacity only.

### Dialog sheet

- **Structure**: backdrop, labelled sheet, header/close, content, action cluster, status region.
- **States**: closed, opening, open, validation error, busy.
- **Accessibility**: native dialog semantics, Escape and close control, focus restoration, internal scroll owner.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---|---|---|
| Micro | `120ms` | `ease-out` | Press and focus feedback |
| Standard | `180ms` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Drawer and panel state |
| Instrument | `700ms` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Existing gauge needle |

Motion explains state change only. Hover and active feedback applies solely to interactive elements. `prefers-reduced-motion: reduce` disables non-essential transitions and smooth scrolling.

## 7. Depth & Surface

Strategy: mixed tonal shift plus tokenized instrument depth. White panels sit on a pale cool canvas; the navy rail is separated by tone, while active and recessed controls use the existing `--lip` and `--sunk` recipes. No ad-hoc box shadows are introduced. Outer panels use a restrained radius; controls and nested elements use tighter radii so the hierarchy does not become a stack of identical rounded boxes.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA: 4.5:1 body contrast, 3:1 large text and non-text indicators.
- Every interactive target is at least 44px in one dimension.
- Full keyboard reachability, visible focus, correct dialog focus management, and a working skip link.
- Status meaning uses words and position/symbols in addition to color.
- Charts keep accessible table equivalents and keyboard interaction.
- 375px reflow and 200% zoom must not introduce primary horizontal scrolling.
- Reduced-motion and system color-scheme preferences remain supported.

### Accepted debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| None | — | No new design or accessibility debt is accepted for this replacement. | — |
