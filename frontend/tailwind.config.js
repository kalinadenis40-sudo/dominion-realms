/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50:  '#FDFAF4',
          100: '#F5F0E8',
          200: '#EDE6D6',
          300: '#DDD3BE',
          400: '#C8B99A',
        },
        ink: {
          DEFAULT: '#1C1712',
          light:   '#3D3428',
          muted:   '#6B5D4A',
        },
        gold: {
          DEFAULT: '#B8922A',
          light:   '#D4A940',
          pale:    '#F7EDD0',
          shine:   '#F0C96A',
        },
        crimson: {
          DEFAULT: '#8B2020',
          light:   '#F2E4E4',
        },
        teal: {
          game:    '#1A5C4A',
          light:   '#E0EDE9',
        },
        navy: {
          DEFAULT: '#1E3A5F',
          light:   '#E2E9F2',
        },
      },
      fontFamily: {
        cinzel:  ['Cinzel', 'serif'],
        crimson: ['Crimson Pro', 'Georgia', 'serif'],
      },
      borderRadius: {
        game: '3px',
      },
    },
  },
  plugins: [],
};
