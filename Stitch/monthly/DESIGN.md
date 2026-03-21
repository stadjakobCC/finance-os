```markdown
# Design System Strategy: High-End Editorial Wealth Management

## 1. Overview & Creative North Star
**The Creative North Star: "The Sovereign Curator"**

This design system is not a utility; it is a statement of status and intentionality. Moving beyond the "SaaS-dashboard" aesthetic, it adopts a high-end editorial approach—treating financial data with the same reverence as a boutique gallery or a luxury magazine. 

We break the "template" look through **Intentional Asymmetry** and **Tonal Depth**. By utilizing wide gutters, offset typography, and a "Deep Charcoal" canvas, we create a digital experience that feels bespoke, private, and authoritative. The interface doesn't just show numbers; it narrates the story of wealth.

---

## 2. Colors & Surface Architecture

The palette is anchored in a sophisticated "Midnight" spectrum, punctuated by "Gilded" highlights.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning content. Structural boundaries must be defined solely through background color shifts or subtle tonal transitions. A `surface-container-low` section sitting on a `surface` background provides all the definition required for a premium feel.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of heavy-stock matte paper.
*   **Base (`#131313`):** The primary canvas.
*   **Surface Container Low (`#1c1b1b`):** Used for large secondary regions like the sidebar or background sections.
*   **Surface Container High (`#2a2a2a`):** Used for interactive cards and primary content modules.
*   **The "Glass & Gradient" Rule:** Floating elements (modals, dropdowns) should utilize Glassmorphism—`surface-variant` with a `20px` backdrop blur. For primary CTAs, use a subtle vertical gradient from `primary` (`#f2ca50`) to `primary-container` (`#d4af37`) to provide a "metallic" soul that flat color lacks.

---

## 3. Typography: The Editorial Voice

The typographic scale uses a deliberate contrast between "The Heritage Serif" and "The Precision Sans."

*   **Display & Headlines (Newsreader):** Use the Italic weight for titles (e.g., *Market Insights*). The serif represents the traditional value of wealth. It should be oversized and spaced with generous leading to feel like a masthead.
*   **Body & UI (Inter):** High-readability sans-serif for numbers and data. It provides the "institutional grade" precision required for a fintech product.
*   **Labels (Inter):** Always upper-case with a letter-spacing of `0.1em`. These act as navigational anchors, providing a structured, architectural feel to the layout.

---

## 4. Elevation & Depth: Tonal Layering

We convey importance through **Tonal Layering** rather than traditional structural lines.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural lift. This mimics the way light interacts with physical materials.
*   **Ambient Shadows:** When a "floating" effect is required, use extra-diffused shadows. 
    *   *Blur:* 40px - 60px.
    *   *Opacity:* 6% - 10%.
    *   *Color:* Use a tinted version of `on-surface` (`#e5e2e1`) to mimic ambient light rather than a dark grey "drop shadow."
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, it must be a "Ghost Border": use the `outline-variant` token at **15% opacity**. 100% opaque borders are strictly forbidden.

---

## 5. Components

### Navigation: The Fixed Monolith
The left sidebar is a constant. It uses `surface-container-low` and carries the brand's architectural weight. Active states use a subtle gold left-accent and `primary` text color.

### Buttons: The Gold Standard
*   **Primary:** A "Gilded" gradient background. Square corners (`0px` radius) to maintain a brutalist, high-end look.
*   **Secondary:** Ghost style. `primary` text with a `Ghost Border`.
*   **Tertiary:** Upper-case `label-md` with `0.15em` letter-spacing, no container.

### Cards & Lists: Editorial Blocks
*   **No Dividers:** Forbid the use of divider lines. Separate list items using `spacing-4` (1.4rem) of vertical whitespace or a subtle background toggle between `surface-container` tiers.
*   **Data Visualization:** Use the `tertiary` (Emerald) for gains and `error` (Deep Red) for expenses. Lines should be thin (`1.5px`) with a soft glow (0.5 opacity) to feel like a high-end terminal.

### Input Fields: Minimalist Input
*   **States:** Underline-only inputs. The label sits above in `label-sm` upper-case. When focused, the underline transitions from `outline` to `primary`.

---

## 6. Do’s and Don’ts

### Do
*   **Use Asymmetry:** Allow headlines to hang over margins. Give data room to breathe.
*   **Embrace the Dark:** Ensure `surface` colors are deep enough to let the `primary` gold pop.
*   **Prioritize Typography:** Let the Serif Italic do the heavy lifting for the brand's "luxury" feel.

### Don't
*   **No Rounded Corners:** Use a `0px` radius scale. Soft corners feel "consumer-grade"; sharp corners feel "institutional and elite."
*   **No High-Contrast Borders:** Never use a 100% opaque border to separate two dark surfaces.
*   **Don't Overcrowd:** If a screen feels busy, increase the spacing from `spacing-8` to `spacing-12`. Luxury is the luxury of space.

---

## 7. Directional Note for Designers
When designing a new view, ask yourself: *"Does this look like a bank app, or does it look like a private wealth report?"* If it looks like a bank app, add more whitespace, remove the lines, and increase the size of the serif headings. This system is about the restraint of the wealthy, not the clutter of the common.```