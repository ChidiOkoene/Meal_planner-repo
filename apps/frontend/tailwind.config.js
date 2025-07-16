module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nigeria: { primary: "#008751", secondary: "#FFFFFF" },
        ghana: { primary: "#CE1126", secondary: "#FCD116" },
        kenya: { primary: "#006600", secondary: "#000000" },
        southafrica: { primary: "#007A4D", secondary: "#001489" },
        cameroon: { primary: "#007A5E", secondary: "#CE1126" },
        usa: { primary: "#B22234", secondary: "#3C3B6E" }
      }
    },
  },
  plugins: [],
}