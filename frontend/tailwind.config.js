/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#94b3fd',
          400: '#5c83f9',
          500: '#000080', // Navy Blue original solicitado (#000080)
          600: '#000073',
          700: '#000066',
          800: '#000052',
          900: '#00003d',
          950: '#000029',
        },
        accent: {
          50: '#f0fbff',
          100: '#e0f7ff',
          500: '#00B0F0', // Celeste institucional EPS Selva Central
          600: '#009AD4',
          700: '#007EB0'
        }
      }
    },
  },
  plugins: [],
}
