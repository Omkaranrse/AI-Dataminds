import type { Config } from "tailwindcss";
export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#090b14", violet: "#8057ff", cyan: "#4de2dd" } } },
  plugins: [],
} satisfies Config;

