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
          DEFAULT: "#090a0f",
          surface: "#11131d",
          hover: "#171926",
          input: "#151724",
        },
        primary: {
          DEFAULT: "#4f46e5",
          hover: "#6366f1",
          light: "#818cf8",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          active: "rgba(99, 102, 241, 0.5)",
        },
        muted: "#94a3b8",
        dim: "#64748b",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
