import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', '"Inter"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', '"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "panel-slide": "panelSlideIn 180ms ease-out",
        "kill-slide": "killSlideIn 180ms ease-out",
        "toast-slide": "toastSlideIn 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
