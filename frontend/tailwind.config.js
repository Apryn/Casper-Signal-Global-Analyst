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
          bg: '#08090d',
          card: '#13151f',
          panel: '#1b1e2e',
          border: '#282b3d',
          text: '#e2e8f0',
          muted: '#8e96aa'
        },
        primary: {
          light: '#818cf8',
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
        },
        secondary: {
          light: '#22d3ee',
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
        },
        accent: {
          light: '#f472b6',
          DEFAULT: '#ec4899',
          dark: '#db2777',
        },
        tactile: {
          orange: '#ff6b35',
          yellow: '#ffca3a',
          teal: '#2ec4b6',
          purple: '#8338ec',
          pink: '#ff006e',
          lime: '#8ac926',
          blue: '#1982c4',
          bg: '#090a10',
          card: '#141622',
          border: '#2c314c',
          text: '#f1f5f9'
        }
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
      },
      boxShadow: {
        'tactile-sm': '2px 2px 0px 0px #000000',
        'tactile-md': '4px 4px 0px 0px #000000',
        'tactile-lg': '6px 6px 0px 0px #000000',
        'tactile-neon': '4px 4px 0px 0px var(--tw-shadow-color)',
        'tactile-pressed': '1px 1px 0px 0px #000000',
        'inset-bevel': 'inset 1.5px 1.5px 0px rgba(255, 255, 255, 0.15), inset -1.5px -1.5px 0px rgba(0, 0, 0, 0.4)',
        'inset-screen': 'inset 2px 2px 5px rgba(0, 0, 0, 0.6), inset -1px -1px 2px rgba(255, 255, 255, 0.05)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}

