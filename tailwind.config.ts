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
        primary: {
          50:  '#eef7f0',
          100: '#d5eeda',
          200: '#a8d9b2',
          300: '#72be84',
          400: '#45a35a',
          500: '#2d8a42',
          600: '#1f6e32',
          700: '#165525',
          800: '#0e3c1a',
          900: '#07240f',
        },
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
