import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0E0E0F",
          surface: "#161617",
          hover: "#1D1D1F",
          input: "#1A1A1C",
        },
        primary: {
          DEFAULT: "#B23A32",
          hover: "#C0392B",
          light: "#FF8A8A",
        },
        border: {
          DEFAULT: "#2A2A2D",
          active: "rgba(229, 72, 77, 0.45)",
        },
        ink: {
          DEFAULT: "#F2F0EB",
          soft: "#D8D2C7",
        },
        muted: "#B4B0A9",
        dim: "#8A867F",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
