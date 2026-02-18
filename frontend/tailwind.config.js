/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nm: {
          bg: 'var(--nm-bg)',
          light: 'var(--nm-shadow-light)',
          dark: 'var(--nm-shadow-dark)',
          accent: 'var(--nm-accent)',
          'accent-soft': 'var(--nm-accent-soft)',
          'text-primary': 'var(--nm-text-primary)',
          'text-secondary': 'var(--nm-text-secondary)',
        },
      },
      boxShadow: {
        'nm-raised': '6px 6px 12px var(--nm-shadow-dark), -6px -6px 12px var(--nm-shadow-light)',
        'nm-raised-lg': '8px 8px 16px var(--nm-shadow-dark), -8px -8px 16px var(--nm-shadow-light)',
        'nm-concave': 'inset 6px 6px 12px var(--nm-shadow-dark), inset -6px -6px 12px var(--nm-shadow-light)',
        'nm-flat': '3px 3px 6px var(--nm-shadow-dark), -3px -3px 6px var(--nm-shadow-light)',
        'nm-btn': '4px 4px 8px var(--nm-shadow-dark), -4px -4px 8px var(--nm-shadow-light)',
        'nm-btn-hover': '6px 6px 14px var(--nm-shadow-dark), -6px -6px 14px var(--nm-shadow-light)',
        'nm-btn-active': 'inset 4px 4px 8px var(--nm-shadow-dark), inset -4px -4px 8px var(--nm-shadow-light)',
      },
      borderRadius: {
        'nm': '16px',
        'nm-sm': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'nm-card-in': 'nmCardIn 0.5s ease-out forwards',
        'nm-press': 'nmPress 200ms ease forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        nmCardIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        nmPress: {
          '0%': { boxShadow: '4px 4px 8px var(--nm-shadow-dark), -4px -4px 8px var(--nm-shadow-light)' },
          '100%': { boxShadow: 'inset 4px 4px 8px var(--nm-shadow-dark), inset -4px -4px 8px var(--nm-shadow-light)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
