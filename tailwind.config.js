/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#073a70', // Classic Blue
          light: '#2a5b94',   // Lighter shade for interactions
          dark: '#042242',    // Darker shade
        },
        secondary: {
          DEFAULT: '#062141', // Deep Navy
          light: '#0f3560',
        },
        accent: {
          DEFAULT: '#D4AF37', // Gold/Bronze
          light: '#e6c75e',
          dark: '#b08e26',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
