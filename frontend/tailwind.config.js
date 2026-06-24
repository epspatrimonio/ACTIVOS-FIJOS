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
          50: '#f0f6fe',
          100: '#d3e5fd',
          200: '#a5cbfa',
          300: '#6daaf3',
          400: '#3b8eed',
          500: '#0e6fdc', // Azul zafiro real
          600: '#0d5bb0', // Azul medio
          700: '#0e4984', // Azul oscuro elegante
          800: '#0d396a', // Azul profundo
          900: '#0b2a52', // Azul marino (tono de la imagen)
          950: '#051934', // Azul marino oscuro (degradado de la imagen)
        }
      }
    },
  },
  plugins: [],
}
