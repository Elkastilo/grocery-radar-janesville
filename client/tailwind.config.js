/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 16px 40px rgba(15, 23, 42, 0.08)',
        lift: '0 10px 30px rgba(4, 120, 87, 0.12)',
      },
    },
  },
  plugins: [],
}
