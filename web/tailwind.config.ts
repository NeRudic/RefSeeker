import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "rgb(var(--obsidian-950) / <alpha-value>)",
          900: "rgb(var(--obsidian-900) / <alpha-value>)",
          850: "rgb(var(--obsidian-850) / <alpha-value>)",
          800: "rgb(var(--obsidian-800) / <alpha-value>)",
          750: "rgb(var(--obsidian-750) / <alpha-value>)",
          700: "rgb(var(--obsidian-700) / <alpha-value>)",
          600: "rgb(var(--obsidian-600) / <alpha-value>)",
        },
        zinc: {
          100: "rgb(var(--zinc-100) / <alpha-value>)",
          200: "rgb(var(--zinc-200) / <alpha-value>)",
          300: "rgb(var(--zinc-300) / <alpha-value>)",
          400: "rgb(var(--zinc-400) / <alpha-value>)",
          500: "rgb(var(--zinc-500) / <alpha-value>)",
          600: "rgb(var(--zinc-600) / <alpha-value>)",
        },
        accent: {
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        "accent-gradient-h": "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        "mesh-pattern": "radial-gradient(ellipse at top, rgba(99,102,241,var(--mesh-opacity,0.08)) 0%, transparent 60%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
