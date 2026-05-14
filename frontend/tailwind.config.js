/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bamboo: {
          DEFAULT: "#2D4A22",
          hover: "#223819",
          light: "#3A5D2D",
        },
        terracotta: {
          DEFAULT: "#D95D39",
          hover: "#C05232",
        },
        cream: {
          DEFAULT: "#F4F1EA",
          dark: "#EAE5D9",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          secondary: "#52525B",
          muted: "#71717A",
        },
        border: {
          DEFAULT: "#E4E4E7",
        },
        status: {
          preparing: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
          delivering: { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
          delivered: { bg: "#D1FAE5", text: "#047857", border: "#A7F3D0" },
          cancelled: { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
          lowstock: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
        },
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(4px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.35s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
