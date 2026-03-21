/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Exact token set from the Stitch design
        "primary":                    "#f2ca50",
        "primary-container":          "#d4af37",
        "primary-fixed":              "#ffe088",
        "primary-fixed-dim":          "#e9c349",
        "on-primary":                 "#3c2f00",
        "on-primary-container":       "#554300",
        "on-primary-fixed":           "#241a00",
        "on-primary-fixed-variant":   "#574500",
        "inverse-primary":            "#735c00",
        "surface-tint":               "#e9c349",

        "secondary":                  "#cec6af",
        "secondary-container":        "#4b4735",
        "secondary-fixed":            "#eae2ca",
        "secondary-fixed-dim":        "#cec6af",
        "on-secondary":               "#343020",
        "on-secondary-container":     "#bcb59e",
        "on-secondary-fixed":         "#1f1c0d",
        "on-secondary-fixed-variant": "#4b4735",

        "tertiary":                   "#b6d5cb",
        "tertiary-container":         "#9bb9b0",
        "tertiary-fixed":             "#cae9e0",
        "tertiary-fixed-dim":         "#afcdc4",
        "on-tertiary":                "#1a352f",
        "on-tertiary-container":      "#2f4a43",
        "on-tertiary-fixed":          "#03201a",
        "on-tertiary-fixed-variant":  "#314c45",

        "error":                      "#ffb4ab",
        "error-container":            "#93000a",
        "on-error":                   "#690005",
        "on-error-container":         "#ffdad6",

        "background":                 "#131313",
        "on-background":              "#e5e2e1",

        "surface":                    "#131313",
        "surface-dim":                "#131313",
        "surface-bright":             "#393939",
        "surface-variant":            "#353534",
        "surface-container-lowest":   "#0e0e0e",
        "surface-container-low":      "#1c1b1b",
        "surface-container":          "#201f1f",
        "surface-container-high":     "#2a2a2a",
        "surface-container-highest":  "#353534",

        "on-surface":                 "#e5e2e1",
        "on-surface-variant":         "#d0c5af",
        "inverse-surface":            "#e5e2e1",
        "inverse-on-surface":         "#313030",

        "outline":                    "#99907c",
        "outline-variant":            "#4d4635",
      },
      fontFamily: {
        "headline": ["Newsreader", "serif"],
        "body":     ["Inter", "sans-serif"],
        "label":    ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0rem",
        sm:      "0rem",
        md:      "0rem",
        lg:      "0rem",
        xl:      "0rem",
        "2xl":   "0rem",
        "3xl":   "0rem",
        full:    "9999px",
      },
    },
  },
  plugins: [],
}
