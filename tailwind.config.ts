import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        noline: {
          black: "#111111",
          orange: "#FF6B00",
          white: "#FFFFFF",
          graphite: "#1B1B1B",
          line: "#2A2A2A",
          muted: "#A6A6A6"
        }
      },
      boxShadow: {
        premium: "0 24px 80px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
