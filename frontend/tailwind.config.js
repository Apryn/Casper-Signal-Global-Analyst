/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Support dark mode
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0b0f19',
          card: 'rgba(17, 24, 39, 0.7)',
          border: 'rgba(255, 255, 255, 0.08)',
          text: '#f3f4f6',
          muted: '#9ca3af'
        },
        primary: {
          light: '#a5b4fc',
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
        },
        secondary: {
          light: '#67e8f9',
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
        },
        accent: {
          light: '#f472b6',
          DEFAULT: '#ec4899',
          dark: '#db2777',
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
