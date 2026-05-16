/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./index.jsx"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#644ff0',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#644ff0',
          600: '#5b47d6',
          700: '#4c3ab8',
          800: '#3d2e94',
          900: '#2e2270',
        },
      },
    },
  },
  plugins: [],
}