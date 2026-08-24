/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bna: {
          primary: "#0f2537",
          primaryLight: "#1a3a52",
          secondary: "#00677d",
          secondaryDark: "#004e5f",
          accent: "#059669",
          paper: "#f2ecdf",
          card: "#ffffff",
          blood: "#a52b1f",
          amber: "#a8631b",
          mint: "#0e7a5a",
        }
      },
      fontFamily: {
        mono: ["Courier New", "monospace"],
      }
    },
  },
  plugins: [],
};
