import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // Obsidian Dark Pro palette
        obsidian: {
          canvas: "#09090B",
          surface: "#111113",
          elevated: "#18181B",
          border: "#222226",
          strong: "#323238",
        },
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "4px",
        sm: "2px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.4)",
        card: "0 0 0 1px rgba(255, 255, 255, 0.07), 0 2px 4px rgba(0, 0, 0, 0.4)",
        "card-hover": "0 0 0 1px rgba(255, 255, 255, 0.14), 0 4px 12px rgba(0, 0, 0, 0.6)",
        hairline: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        glow: "0 0 20px -3px rgba(59, 130, 246, 0.35)",
        "glow-amber": "0 0 20px -3px rgba(245, 158, 11, 0.35)",
        "glow-emerald": "0 0 20px -3px rgba(16, 185, 129, 0.35)",
      },
      animation: {
        "pulse-subtle": "pulseSubtle 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "beacon-live": "beacon-pulse 2s infinite ease-in-out",
      },
      keyframes: {
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
