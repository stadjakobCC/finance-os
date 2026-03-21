```markdown
# Design System Strategy: The Financial Atelier

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Curator."** 

Moving beyond the utility of a standard finance tracker, this system treats financial data as a high-end editorial experience. We reject the "spreadsheet" aesthetic in favor of a breathable, calm environment that mirrors the tactile quality of premium stationery and the sophisticated translucency of glass. 

We break the "template" look through **intentional white space** and **asymmetric data visualization**. By utilizing high-contrast typography scales (e.g., pairing `display-lg` numbers with `label-sm` metadata), we create an authoritative hierarchy that feels intentional and bespoke rather than computer-generated.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a "High-Value Neutral" philosophy, using the `surface` tokens to create a sanctuary for the user’s data.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define sections. We achieve containment through background shifts. For example:
- A `surface-container-low` component should sit directly on a `surface` background.
- Use `8` or `10` from the spacing scale to create "structural silence" between elements, letting the negative space act as the divider.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
- **Base Layer:** `surface` (#faf9fe)
- **Secondary Tier:** `surface-container-low` (#f4f3f8) for grouping secondary content.
- **Active/Elevated Tier:** `surface-container-lowest` (#ffffff) for primary cards and interaction points.
This nesting creates a "soft lift" that feels organic and premium.

### The "Glass & Gradient" Rule
To elevate the experience beyond flat design, use **Glassmorphism** for floating navigation bars or modal overlays. 
- **Token:** Use `surface` or `surface-container-lowest` at 70% opacity with a `backdrop-filter: blur(20px)`.
- **Gradients:** Use a subtle linear gradient on primary CTAs, transitioning from `primary` (#0058bc) to `primary-container` (#0070eb). This adds a "jewel-like" depth that solid fills lack.

---

## 3. Typography
We utilize the **Inter** family to mimic the precision of San Francisco. The hierarchy is designed to highlight the "Big Numbers" while keeping administrative text unobtrusive.

- **Display (The Statement):** Use `display-lg` for total net worth or primary balances. This should feel like a headline in a premium financial journal.
- **Headline & Title:** Use `headline-sm` for section headers and `title-md` for card titles. These provide the structural anchor for the page.
- **Body & Labels:** `body-md` is our workhorse for transactions. `label-sm` should be used for timestamps or category tags, set in `on-surface-variant` (#414755) to de-prioritize them visually.
- **Visual Contrast:** Always pair a `display` scale number with a `label-md` descriptor to create a "Signature Pair" that feels high-end and curated.

---

## 4. Elevation & Depth
In this design system, depth is a feeling, not a feature. We avoid heavy dropshadows in favor of **Tonal Layering.**

- **The Layering Principle:** Place a `surface-container-lowest` card on top of a `surface-container` background. The subtle shift from #ffffff to #eeedf3 provides enough "lift" for the eye without adding visual clutter.
- **Ambient Shadows:** For floating elements (like a "Add Transaction" FAB), use a shadow with a blur of `32px` at 6% opacity, using a tint of `on-surface` (#1a1b1f) rather than pure black.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` (#c1c6d7) at **15% opacity**. It should be barely perceptible, serving as a "suggestion" of a boundary.

---

## 5. Components

### Buttons
- **Primary:** High-contrast `primary` fill with `on-primary` text. Apply the `lg` (1rem) roundedness. 
- **Tertiary:** No fill or border. Use `primary` text weight `600` for actions like "View All."

### Input Fields
- **Design:** Use `surface-container-low` as the field background. No bottom line.
- **Interaction:** On focus, transition the background to `surface-container-lowest` and apply a 1px "Ghost Border" using the `primary` color at 20% opacity.

### Cards & Lists
- **Rule:** Forbid divider lines.
- **Structure:** Separate transaction items using `3` (0.75rem) of vertical spacing. 
- **The "Trend Indicator":** For positive trends, use `secondary` (#006e28) text on a `secondary-container` (#6ffb85) background at 20% opacity. For negative, use `tertiary` (#bc000a) on `tertiary-container`.

### Sophisticated Data Visualization (Signature Component)
- **The "Whisper" Graph:** Use thin-stroke (1.5pt) bezier curves for spending charts. The area under the curve should use a very faint gradient of `primary` to transparent, creating a "vapor" effect.

---

## 6. Do's and Don'ts

### Do
- Use `xl` (1.5rem) roundedness for large containers to emphasize the "Apple-native" feel.
- Use `spacing-16` (4rem) for top and bottom page margins to give content "room to breathe."
- Use `secondary` emerald green for all growth-related metrics to build trust.

### Don't
- **Don't** use 100% black text. Always use `on-surface` (#1a1b1f) for a softer, premium look.
- **Don't** use standard "drop shadows" on cards; stick to Tonal Layering.
- **Don't** use generic icons. Use thin-stroke (1pt or 1.5pt) icons that match the weight of the `label-md` typography.
- **Don't** crowd the screen. If a screen feels busy, increase the background spacing using the `spacing-8` or `spacing-10` tokens.