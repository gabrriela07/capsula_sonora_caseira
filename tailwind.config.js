/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        carbon: '#171717',
        graphite: '#2D2D30',
        slime: '#A3E635',
        petal: '#D162A4',
        banana: '#FAEE66',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 0 36px rgba(163, 230, 53, 0.12)' },
      animation: { 'fade-up': 'fadeUp .35s ease-out both' },
      keyframes: { fadeUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } } },
    },
  },
  plugins: [],
};
