---
name: Warm Editorial Minimalism
colors:
  surface: '#f9f9f8'
  surface-dim: '#dadad9'
  surface-bright: '#f9f9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f3'
  surface-container: '#eeeeed'
  surface-container-high: '#e8e8e7'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#47464b'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1f0'
  outline: '#77767b'
  outline-variant: '#c8c5cb'
  surface-tint: '#5f5e61'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1e'
  on-primary-container: '#858387'
  inverse-primary: '#c8c5ca'
  secondary: '#9d4225'
  on-secondary: '#ffffff'
  secondary-container: '#fd8c68'
  on-secondary-container: '#742508'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1c1b'
  on-tertiary-container: '#848483'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4e1e6'
  primary-fixed-dim: '#c8c5ca'
  on-primary-fixed: '#1b1b1e'
  on-primary-fixed-variant: '#47464a'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59e'
  on-secondary-fixed: '#3a0b00'
  on-secondary-fixed-variant: '#7e2c10'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#f9f9f8'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2.5rem
  margin: 1.5rem
  margin-sm: 1rem
  margin-lg: 4rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 2rem
  space-xl: 3.5rem
---

## Brand & Style

This design system expresses quiet luxury, tactile craftsmanship, and curatorial intentionality. Designed for a high-end lifestyle and design commerce platform, the aesthetic balances modern editorial publishing with contemporary digital architecture. 

The emotional tone is calm, composed, and sensory. By utilizing ample warm whitespace, deliberate typographic hierarchy, and museum-grade negative space, the interface steps back to let product photography and physical objects command focus. Visual rhythm blends the disciplined structure of European architectural monographs with high-conversion e-commerce precision.

## Colors

The palette relies on a tonal foundation inspired by raw ceramics, unbleached linen, and mineral pigments:

- **Canvas & Backgrounds:** Alabaster White (`#FAFAF9`) acts as the warm primary surface, paired with Stone Light (`#F5F5F4`) and Stone Muted (`#E7E5E4`) for recessed fields, product pedestals, and hairline divider lines.
- **Typography & Structural Accents:** Deep Onyx (`#18181B`) provides high legibility and resolute anchor points across headlines, navigation, and primary button fills. Slate Muted (`#71717A`) is used for secondary metadata and attribution text.
- **Brand Accent:** Warm Terracotta (`#C25E3E`) serves as a surgical focus color for editorial callouts, inventory status indicators, badge accents, and active interaction feedback without disrupting the serene neutral canvas.

## Typography

The type system juxtaposes the literary grace of **Playfair Display** with the architectural legibility of **Plus Jakarta Sans**. 

- **Headlines & Narrative:** Playfair Display is reserved for editorial hero statements, collection titles, and prominent story headers. Use normal (`400`) and medium (`500`) weights; avoid heavy faux-bolds to preserve the delicate stroke modulation and high contrast of the serifs.
- **Body & Microcopy:** Plus Jakarta Sans governs catalog listings, specification tables, transactional flows, and UI controls. Its balanced proportions and open counters maintain razor-sharp legibility at small scale.
- **Uppercase Labels:** Category indicators, badges, and metadata tags should be rendered in `label-md` or `label-sm`, set in all-caps with generous letter-spacing (`0.08em`) to mimic publication footers.

## Layout & Spacing

The layout is built on an expansive 12-column grid system (4 columns on mobile, 8 on tablet, 12 on desktop) centered within a maximum container width of `1440px`.

- **Editorial Pacing:** Embrace deliberate vertical rhythm. Hero showcases and thematic collections use `margin-lg` (`4rem` / `64px`) or `space-xl` gaps to prevent visual clutter and emulate the cadence of printed art books.
- **Breakpoints:**
  - **Mobile (< 768px):** 4 columns, `margin-sm` (`16px`), single-column product narrative, horizontal touch-scrolling carousels for related objects.
  - **Tablet (768px – 1024px):** 8 columns, `gutter` (`24px`), 2-column catalog grids with persistent category chips.
  - **Desktop (> 1024px):** 12 columns, `gutter-lg` (`40px`), alternating editorial spreads, multi-column product showcases, sticky detail panels alongside expansive imagery.

## Elevation & Depth

Visual hierarchy avoids heavy drop shadows, relying instead on tonal layering and low-contrast boundaries:

- **Surface Tiers:** Baseline canvas sits at `#FAFAF9`. Secondary interactive panels, drawer flyouts, and filter bars live on pure `#FFFFFF` or elevated `#F5F5F4` containers.
- **Hairline Outlines:** Structure is reinforced with 1px borders colored in Stone Muted (`#E7E5E4`), providing structural definition without visual weight.
- **Warm Ambient Shadowing:** Floating elements (e.g., sticky cart docks, modal sheets, elevated quick-view sheets) utilize an ultra-diffused, tinted shadow:
  - `box-shadow: 0 16px 40px -12px rgba(24, 24, 27, 0.06), 0 2px 6px -1px rgba(24, 24, 27, 0.02);`
  The charcoal-tinted undertone grounds components naturally against warm alabaster backgrounds.

## Shapes

The design language favors architectural discipline with subtle softening:

- **Cards & Surfaces:** Governed by level `1` roundedness (`rounded-sm`: `4px`, `rounded`: `6px`, `rounded-lg`: `8px`). This creates crisp frames that honor rectangular photography grids without appearing sharp or brutalist.
- **Pills & Circular Accents:** As a conscious counterpoint to the structured grid, badges, filter chips, and circular button variants utilize full pill styling (`rounded-full` / `9999px`) to create organic, inviting touch points.

## Components

### Buttons
- **Primary:** Deep Onyx (`#18181B`) background, `#FAFAF9` text, `4px` radius, `14px` medium weight, `48px` default height. Hover shifts to an opulent warm dark tone (`#27272A`) with a subtle `translate-y(-1px)` lift.
- **Secondary / Ghost:** Transparent background with a `1px` border in `#E7E5E4`. Hover transitions border to `#18181B` with an ivory tint (`#F5F5F4`).
- **Terracotta Accent:** `#C25E3E` fill with white text; reserved exclusively for key conversion steps like "Complete Order" or limited drops.

### Chips & Badges
- **Status Badges:** Compact pill shapes (`rounded-full`) with `label-sm` tracking. Available/New styles use `#F5F5F4` background with `#18181B` text. "Archive" or "Sold Out" states utilize terracotta tinting (`#C25E3E` at 10% opacity with `#C25E3E` text).
- **Filter Chips:** Pill-shaped outline buttons. Selected state swaps to `#18181B` fill with `#FAFAF9` typography.

### Cards
- **Product Card:** Placed on transparent or `#FFFFFF` canvases with a `1px` `#E7E5E4` frame. Images retain a strict `4:5` aspect ratio. Metadata layout features Playfair Display title, right-aligned price in `Plus Jakarta Sans`, and a secondary material label underneath.
- **Editorial Banner Card:** Full-bleed image containers with a subtle warm alabaster overlay gradient for seamless text legibility.

### Form Inputs
- **Text Fields:** Minimalist containers with a `#FFFFFF` fill and a clean `1px` `#E7E5E4` border. On focus, the border shifts cleanly to `#18181B` with zero ring glow. Floating labels use `label-sm` in `#71717A`.

### Lists & Tables
- **Specification Tables:** Frameless entries separated strictly by `1px` solid `#E7E5E4` horizontal dividing lines. Left column displays attributes in `label-md` uppercase muted stone; right column displays object details in regular body weight.

### Cart Drawer & Quick View
- **Slide-out Flyout:** Sits on `#FFFFFF` with the ambient shadow token. Header showcases collection count in Playfair Display, while checkout footers remain anchored to the base with calculated summary rows.