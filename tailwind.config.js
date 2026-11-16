/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        scanline: {
          '0%': { top: '4%' },
          '50%': { top: '92%' },
          '100%': { top: '4%' }
        }
      },
      animation: {
        scanline: 'scanline 2.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
