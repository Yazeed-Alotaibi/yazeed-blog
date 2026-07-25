# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

## ⚠ PROJECT OVERRIDES — "Drafting Sheet" direction (authoritative)

The generated defaults below were reviewed and deliberately revised for this project
(a personal PM tools site: landing + a 33-calculator reference desk). Where this section
conflicts with the generated sections, **this section wins.**

**Concept.** An engineer's drawing sheet: cool vellum paper, hairline rules,
dimension-line callouts, milestone diamonds, a title-block footer. Swiss Modernism 2.0
grid discipline retained from the generated style. No serif faces, no warm cream
(both were rejected as AI-template defaults per the frontend-design skill).

**Color — light mode ("day drafting")**

| Role | Hex | Why |
|------|-----|-----|
| Background (vellum) | `#F6F7F9` | Cool near-white, replaces warm cream |
| Card (sheet) | `#FFFFFF` | Drawing sheet on vellum |
| Ink | `#171A1F` | Cool near-black |
| Muted | `#5B6472` | AA on vellum & sheet |
| Hairline | `#E2E5EA` / strong `#C7CCD4` | Drafting rules |
| **Accent** | **`#2B49C9`** | Engineering blue. Replaces generated pink `#EC4899` — pink is off-subject for a PM/engineering audience; blue keeps continuity with the existing brand. |
| Blueprint strip | `#151C2E` bg / `#B7C6F0` text | Formula blocks read as blueprint callouts |
| Good / Warn / Bad | `#157A4D` / `#8A6100` / `#B93838` | Verdict semantics, AA on white |

**Color — dark mode ("night shift")** — checked independently, not inverted:
bg `#0F1216`, card `#161B22`, ink `#E7EAEF`, muted `#9AA4B2`, lines `#272E39`,
accent lightened `#8FA3F5`, verdicts desaturated-lightened. Toggle + `prefers-color-scheme`,
no-flash inline script, `localStorage` key `yz-theme`.

**Typography roles** (correcting the generated heading/body assignment):
- Display & body: **IBM Plex Sans** (600 display tight-tracked; 400/500 body/labels)
- Annotation & data: **JetBrains Mono** (formulas, dimension callouts, nav numerals,
  stats, input values; `font-variant-numeric: tabular-nums` for all data)
- Micro-labels: mono, uppercase, letter-spaced — drawing-callout register.

**Signature elements** (the things this site is remembered by):
1. Title-block footer on every page — bordered grid like a real drawing title block
   (PROJECT / SHEET / AUTHOR / REV / DATE).
2. Dimension-line section headers — hairline with end ticks + mono micro-label.
3. Milestone-diamond markers (rotated squares) for nav/list items.
4. Live inline-SVG figures in the calculator desk (S-curve, PERT curve, P×I matrix,
   AON network, Cp/Cpk bell, NPV cash-flow) — values always visible as text, never
   color-only, `aria-label`ed.
5. Faint grid-paper texture in hero panels only (not page-wide).

**Pattern correction:** the generated "FAQ/Documentation Landing" applies to the desk
(prominent search — already exists). The landing page instead uses: hero → ONE featured
tool card → compact "On the drawing board" roadmap list (replaces dead placeholder
cards) → title-block footer.

**Anti-pattern note:** the generated "❌ Text-heavy pages" line is inherited from a
style row and does not apply to a reference site; the actionable reading is "break up
text with structure and figures", which the figures + grid deliver.

---

**Project:** yazeed-blog
**Generated:** 2026-07-25 11:35:32
**Category:** Wiki / Encyclopedia
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 2/10 (Subtle) | Density 6/10 (Standard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#18181B` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3F3F46` | `--color-secondary` |
| Accent/CTA | `#EC4899` | `--color-accent` |
| Background | `#FAFAFA` | `--color-background` |
| Foreground | `#09090B` | `--color-foreground` |
| Muted | `#E8ECF0` | `--color-muted` |
| Border | `#E4E4E7` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#18181B` | `--color-ring` |

**Color Notes:** Editorial black + accent pink

### Typography

- **Heading Font:** JetBrains Mono
- **Body Font:** IBM Plex Sans
- **Mood:** code, developer, technical, precise, functional, hacker
- **Google Fonts:** [JetBrains Mono + IBM Plex Sans](https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 6/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EC4899;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #18181B;
  border: 2px solid #18181B;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FAFAFA;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #18181B;
  outline: none;
  box-shadow: 0 0 0 3px #18181B20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Swiss Modernism 2.0

**Keywords:** Grid system, Helvetica, modular, asymmetric, international style, rational, clean, mathematical spacing

**Best For:** Corporate sites, architecture, editorial, SaaS, museums, professional services, documentation

**Key Effects:** display: grid, grid-template-columns: repeat(12 1fr), gap: 1rem, mathematical ratios, clear hierarchy

### Page Pattern

**Pattern Name:** FAQ/Documentation Landing

- **Conversion Strategy:** Reduce support tickets. Track search analytics. Show related articles. Contact escalation path.
- **CTA Placement:** Search bar prominent + Contact CTA for unresolved questions
- **Section Order:** 1. Hero with search bar, 2. Popular categories, 3. FAQ accordion, 4. Contact/support CTA

---

## Motion

**Stagger List** (Subtle) — Trigger: load or scroll | Duration: 250-350ms | Easing: `power1.out`

```js
gsap.from('.list-item', { opacity: 0, y: 8, duration: 0.3, stagger: 0.03 });
```

**Framework notes:** Select items with a stable class/data-attribute (not array index) so re-renders in React don't break targeting

- ✅ Keep per-item stagger delay small (0.02-0.04s) for lists longer than 10 items
- ❌ Don't stagger by more than 0.1s per item on long lists; total reveal time becomes sluggish
- ⚡ For virtualized lists, only animate items currently mounted in the DOM

---

## Anti-Patterns (Do NOT Use)

- ❌ Flat design without depth
- ❌ Text-heavy pages

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
