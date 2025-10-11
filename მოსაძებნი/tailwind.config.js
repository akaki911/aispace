const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Noto Sans Georgian"',
          '"Inter"',
          '"Manrope"',
          ...defaultTheme.fontFamily.sans,
        ],
        georgian: ['"Noto Sans Georgian"', '"Inter"', '"Manrope"', 'sans-serif'],
      },
      letterSpacing: {
        georgian: '0.015em',
      },
      colors: {
        gray: {
          850: '#1f2937',
        }
      }
    },
  },
  plugins: [],
}