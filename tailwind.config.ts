import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-card-bg)",
        card: {
          DEFAULT: "var(--color-card-bg)",
          foreground: "var(--color-primary-text)",
        },
        input: {
          DEFAULT: "var(--color-input-bg)",
          border: "var(--color-border)",
          focus: "var(--color-primary)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "#FFFFFF",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          subtle: "var(--color-primary-subtle)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary-accent)",
          foreground: "#FFFFFF",
          hover: "var(--color-secondary-hover)",
          active: "var(--color-secondary-active)",
          subtle: "var(--color-secondary-subtle)",
        },
        accent: {
          DEFAULT: "var(--color-secondary-accent)",
          foreground: "#FFFFFF",
          hover: "var(--color-secondary-hover)",
          subtle: "var(--color-secondary-subtle)",
        },
        text: {
          primary: "var(--color-primary-text)",
          secondary: "var(--color-secondary-text)",
          muted: "var(--color-text-muted)",
          disabled: "var(--color-text-disabled)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        ring: "var(--color-primary-ring)",
        status: {
          success: "var(--color-success)",
          "success-subtle": "var(--color-success-subtle)",
          info: "var(--color-info)",
          "info-subtle": "var(--color-info-subtle)",
          warning: "var(--color-warning)",
          "warning-subtle": "var(--color-warning-subtle)",
          danger: "var(--color-danger)",
          "danger-subtle": "var(--color-danger-subtle)",
        },
      },
      backgroundImage: {
        "primary-gradient": "var(--gradient-primary)",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
