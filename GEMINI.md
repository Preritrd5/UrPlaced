# UrPlaced — Strict Design System & Development Rules

This document defines the strict, non-negotiable visual design system and engineering rules for **UrPlaced**. All code, components, layouts, styles, and assets in this repository must strictly adhere to these specifications.

---

## 1. Fixed Color Palette (Single Source of Truth)

No additional brand colors may be introduced, chosen, or replaced.

| Role | Hex / Value | Usage |
| :--- | :--- | :--- |
| **Primary** | `#5052C9` | Key action buttons, active states, active tab highlights, primary indicators |
| **Secondary Accent** | `#2E8F86` | Badges, secondary callouts, success indicators, subtle accents |
| **Background** | `#EDECE7` | Main page background, root app container background |
| **Card Background** | `#F8F7F3` | Surface background for cards, tiles, sidebars, containers |
| **Input Background** | `#FBFAF7` | Form inputs, select dropdowns, textareas, search boxes |
| **Primary Text** | `#24283A` | Headings, titles, high-emphasis text, body copy |
| **Secondary Text** | `#292D40` | Subtitles, labels, secondary metadata, captions |
| **Primary Gradient** | `linear-gradient(135deg, #7779D8 0%, #5052C9 100%)` | Hero highlights, key CTA buttons, special gradient cards |

---

## 2. Derived States & Tokens

All interactive and utility states are strictly derived from the base palette:

- **Borders & Dividers:**
  - Card / Input / Container Border: `#B8B6AC` or `rgba(36, 40, 58, 0.26)`
  - Subtle Border / Divider: `rgba(36, 40, 58, 0.16)` or `#DDDCD5`
  - Strong Border: `rgba(36, 40, 58, 0.38)` or `#8E8D86`
  - Active / Focus Border: `#5052C9`
- **Hover & Active States:**
  - Primary Hover: `#4345B0`
  - Primary Active: `#383A99`
  - Secondary Hover: `#267870`
  - Secondary Active: `#1F615B`
- **Muted & Disabled Elements:**
  - Muted Text: `rgba(41, 45, 64, 0.65)` (`#747683`)
  - Disabled Background: `rgba(36, 40, 58, 0.08)`
  - Disabled Text: `rgba(41, 45, 64, 0.38)`
- **Focus Rings:**
  - Focus Ring: `0 0 0 3px rgba(80, 82, 201, 0.25)`
- **Shadows:**
  - Subtle Elevation: `0 1px 3px rgba(36, 40, 58, 0.06), 0 1px 2px rgba(36, 40, 58, 0.04)`
  - Card Shadow: `0 4px 6px -1px rgba(36, 40, 58, 0.07), 0 2px 4px -2px rgba(36, 40, 58, 0.05)`
  - Dropdown / Modal Shadow: `0 10px 15px -3px rgba(36, 40, 58, 0.08), 0 4px 6px -4px rgba(36, 40, 58, 0.04)`

---

## 3. Fixed Typography

- **Headings & Display:** `Outfit`, sans-serif
- **Body Text & UI Controls:** `Inter`, sans-serif
- **Code, Data & Monospace:** `JetBrains Mono`, monospace

Font imports:
- Google Fonts: Outfit (wght: 400, 500, 600, 700), Inter (wght: 400, 500, 600), JetBrains Mono (wght: 400, 500)

---

## 4. Mandatory Rules & Invariants

1. **No Invented Colors:** Use the exact palette above. Never add arbitrary blues, purples, greens, or grays outside these tokens.
2. **Derived States Only:** All hover, focus, border, shadow, and muted states must strictly derive from the base colors.
3. **Consistency:** All pages, components, dashboards, modals, forms, and charts must maintain identical visual identity.
4. **Reusable Tokens:** Colors, font stacks, and gradients must be defined as CSS variables / Tailwind tokens and referenced by name. Never hardcode random hex values in inline styles or components.
5. **Layout Independence:** Do not blindly copy layouts from third-party templates; design layouts tailored specifically to UrPlaced's user stories and functional requirements while strictly honoring the visual tokens.
6. **Feature Integrity:** Styling constraints must never compromise functional features, data flow, or technical requirements.
