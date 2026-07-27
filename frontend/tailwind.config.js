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
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#c7e0ff',
          300: '#9ec7ff',
          400: '#6aa5ff',
          500: '#00509d', // Base Hex original solicitado (#00509d)
          600: '#003f7e',
          700: '#003366',
          800: '#00254c',
          900: '#001a38',
          950: '#001026',
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
