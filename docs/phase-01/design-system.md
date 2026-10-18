# Visual Design System & Component Styling Specification — UrPlaced V1.0

**Product:** UrPlaced — Multi-College Placement Preparation & Management SaaS  
**Phase:** 01 — Product Blueprint & Architecture  
**Status:** Approved Specification (Fixed Visual Identity — Invariant Across All Phases)

---

## 1. Single Source of Truth — Fixed Brand Tokens

UrPlaced enforces a strict visual identity. The brand colors, typography, and primary gradients specified below are **fixed platform decisions**. No additional brand colors or unrelated hues may be introduced.

### Base Color Palette

| Token Name | Hex Code | Role & Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#5052C9` | Primary action buttons, active navigation indicators, active toggle states, primary focus accents |
| `--color-secondary-accent`| `#2E8F86` | Badges, success callouts, secondary action accents, verification tags |
| `--color-background` | `#EDECE7` | Main viewport canvas, root layout background, off-card canvas areas |
| `--color-card-bg` | `#F8F7F3` | Surface containers, card backgrounds, sidebar navigation panels, modal dialog bodies |
| `--color-input-bg` | `#FBFAF7` | Form inputs, select dropdowns, search boxes, textareas |
| `--color-primary-text` | `#24283A` | Page titles, display headings, high-emphasis text, primary table headers |
| `--color-secondary-text` | `#292D40` | Body copy, subtitles, field labels, metadata descriptions, secondary captions |
| `--gradient-primary` | `linear-gradient(135deg, #7779D8 0%, #5052C9 100%)` | Hero callouts, primary action buttons, key performance highlights |

---

## 2. Derived State Tokens

All interactive, utility, and semantic states are strictly mathematically derived from the base palette:

### 1. Interactive States
- **Primary Hover:** `#4345B0` (10% darker shade of `#5052C9`)
- **Primary Active / Pressed:** `#383A99` (20% darker shade of `#5052C9`)
- **Primary Subtle / Light Tint:** `rgba(80, 82, 201, 0.08)` (For selected list items, hover highlights)
- **Primary Focus Ring:** `0 0 0 3px rgba(80, 82, 201, 0.25)`
- **Secondary Hover:** `#267870` (10% darker shade of `#2E8F86`)
- **Secondary Active:** `#1F615B` (20% darker shade of `#2E8F86`)
- **Secondary Subtle:** `rgba(46, 143, 134, 0.10)` (For verified badges, status chips)

### 2. Borders & Dividers
- **Standard Card / Container Border:** `#DDDCD5` (Subtle boundary between `#F8F7F3` and `#EDECE7`)
- **Divider Lines:** `rgba(36, 40, 58, 0.08)`
- **Input Border (Resting):** `#DDDCD5`
- **Input Border (Hover):** `rgba(80, 82, 201, 0.45)`
- **Input Border (Focused):** `#5052C9`

### 3. Muted & Disabled Tokens
- **Muted Text / Placeholder:** `rgba(41, 45, 64, 0.65)` (`#747683`)
- **Disabled Text:** `rgba(41, 45, 64, 0.38)`
- **Disabled Background:** `rgba(36, 40, 58, 0.06)`
- **Disabled Border:** `rgba(36, 40, 58, 0.10)`

### 4. Elevation Shadows (Derived from Base Text Hue `#24283A`)
- **Elevation SM (Cards/Tiles):** `0 1px 3px rgba(36, 40, 58, 0.06), 0 1px 2px rgba(36, 40, 58, 0.04)`
- **Elevation MD (Dropdowns/Flyouts):** `0 4px 6px -1px rgba(36, 40, 58, 0.07), 0 2px 4px -2px rgba(36, 40, 58, 0.05)`
- **Elevation LG (Modals/Dialogs):** `0 10px 15px -3px rgba(36, 40, 58, 0.08), 0 4px 6px -4px rgba(36, 40, 58, 0.04)`

### 5. Semantic Status Indicators
- **Success / Verified:** `#2E8F86` (Background: `rgba(46, 143, 134, 0.10)`)
- **Info / Needs Review:** `#5052C9` (Background: `rgba(80, 82, 201, 0.08)`)
- **Warning / Pending:** `#8F6E2E` (Derived warm tone adhering to primary contrast ratio; Background: `rgba(143, 110, 46, 0.10)`)
- **Error / Disqualified:** `#B33A3A` (Contrast-compliant alert tone; Background: `rgba(179, 58, 58, 0.08)`)

---

## 3. Fixed Typography & Font Stacks

Fonts are loaded via Google Fonts with strict family assignments:

```css
/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap');
```

| Type Category | Font Family | Weight Scale | Purpose |
| :--- | :--- | :--- | :--- |
| **Headings & Display** | `Outfit`, sans-serif | 500, 600, 700, 800 | Page titles, modal headers, KPI summary numbers, hero banners |
| **Body & UI Controls** | `Inter`, sans-serif | 400, 500, 600 | Body paragraphs, form labels, button text, table cell contents, tooltips |
| **Code & Monospace** | `JetBrains Mono`, monospace | 400, 500, 600 | Programming questions, code editors, roll numbers, checksums, logs |

---

## 4. Component Design Patterns & Standards

### 1. Form Inputs & Controls
- **Background:** Always `#FBFAF7` (`var(--color-input-bg)`).
- **Height & Padding:** Standard height `40px` (`h-10`), padding `px-3 py-2`, font `Inter` 14px (`text-sm`).
- **Focus Ring:** Visible 3px outer ring in `var(--color-primary-ring)` with border transitioning to `#5052C9`.

### 2. Cards & Containers
- **Background:** Always `#F8F7F3` (`var(--color-card-bg)`).
- **Border:** 1px solid `#DDDCD5`.
- **Corner Radius:** `rounded-xl` (`12px` border radius) for modern clean aesthetics.
- **Shadow:** Elevation SM for static cards, transitioning to Elevation MD on hover for clickable cards.

### 3. Data Tables (TanStack Table Integration)
- **Header Row:** Background `#F8F7F3`, border bottom 2px solid `#DDDCD5`, text `font-semibold text-xs tracking-wider uppercase text-secondary-text`.
- **Data Rows:** Background alternating between `#F8F7F3` and `#FBFAF7` (subtle zebra striping), border bottom 1px solid `rgba(36, 40, 58, 0.06)`.
- **Row Hover:** Background `rgba(80, 82, 201, 0.04)`.

### 4. Charts & Visualizations (Recharts Integration)
- Charts must strictly use the design system palette:
  - Series 1 (Primary): `#5052C9`
  - Series 2 (Secondary): `#2E8F86`
  - Series 3 (Tertiary Accent): `#7779D8`
  - Grid Lines: `#DDDCD5`
  - Tooltip Container: Background `#F8F7F3`, Border `#DDDCD5`, Text `#24283A`.

---

## 5. Accessibility (WCAG 2.1 AA) & Responsive Breakpoints

1. **Contrast Ratio Compliance:**
   - `#24283A` (Primary Text) on `#EDECE7` (Background) = **11.2:1** (Exceeds WCAG AAA requirement of 7:1).
   - `#24283A` (Primary Text) on `#F8F7F3` (Card) = **13.5:1** (Exceeds WCAG AAA).
   - `#5052C9` (Primary Brand) on `#FFFFFF` = **5.4:1** (Exceeds WCAG AA requirement of 4.5:1).
   - `#FFFFFF` on `#5052C9` (Button Text) = **5.4:1** (Exceeds WCAG AA).
2. **Keyboard Navigation & Focus:** All interactive elements (`<button>`, `<a>`, `<input>`, tabs) must render visible `:focus-visible` rings.
3. **Responsive Viewport Breakpoints:**
   - **Mobile (`< 640px`):** Single-column stacked layouts, collapsable bottom navigation sheet, horizontally scrolling tables.
   - **Tablet (`640px - 1024px`):** 2-column grid cards, condensed sidebar icons.
   - **Desktop (`> 1024px`):** Full 240px persistent sidebar, multi-column dashboard widgets, split-pane code editor views.
