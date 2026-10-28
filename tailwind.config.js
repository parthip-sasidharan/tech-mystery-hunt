/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        surface: {
          50: "#131b2e",
          100: "#101828",
          200: "#0d1320",
          300: "#090d16",
          border: "#1e293b",
          highlight: "#334155"
        },
        cipher: {
          cyan: "#00f0ff",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#a855f7"
        }
      },
      fontFamily: {
        mono: ["Consolas", "Monaco", "Courier New", "monospace"],
      },
      boxShadow: {
        "glow-cyan": "0 0 20px -3px rgba(0, 240, 255, 0.25)",
        "glow-emerald": "0 0 20px -3px rgba(16, 185, 129, 0.25)",
        "glow-amber": "0 0 20px -3px rgba(245, 158, 11, 0.25)",
      }
    },
  },
  plugins: [],
};
