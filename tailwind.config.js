/**
 * Tailwind CSS config for Chrome extension + static hosting.
 * - Scans index.html and js files
 * - Safelists dynamic classes assembled in js/app.js
 */
module.exports = {
  content: [
    './index.html',
    './js/**/*.js',
    './css/**/*.css',
  ],
  safelist: [
    // Dynamic spans and grids
    'md:col-span-1', 'md:col-span-2', 'md:col-span-3', 'md:col-span-4',
    'row-span-1', 'row-span-2',
    // Grid column variants generated dynamically in JS and statically in HTML
    'md:grid-cols-2', 'md:grid-cols-4', 'md:grid-cols-6', 'md:grid-cols-8',
    'lg:grid-cols-3', 'xl:grid-cols-4',
    // Responsive visibility used in HTML
    'hidden', 'md:flex', 'md:block',
    // Gradient color presets used by categories
    'bg-gradient-to-br',
    'from-white/10', 'to-white/5',
    'from-blue-600/20', 'to-indigo-600/20',
    'from-emerald-600/20', 'to-teal-600/20',
    'from-red-600/20', 'to-pink-600/20',
    'from-purple-600/20', 'to-fuchsia-600/20',
    'from-orange-600/20', 'to-yellow-600/20',
    // Fixed button widths used in Settings/Test buttons
    'w-16', 'w-24', 'w-28', 'w-32', 'w-36', 'w-40',
    // Small edit-mode delete button utilities
    '-top-1', '-right-1',
    'p-0.5',
    'text-[10px]',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'Noto Sans', 'sans-serif'],
      },
      colors: {
        glass: 'rgba(255, 255, 255, 0.7)',
        'glass-hover': 'rgba(255, 255, 255, 0.9)',
        'glass-dark': 'rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
