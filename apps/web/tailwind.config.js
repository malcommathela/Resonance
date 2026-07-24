/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        resonance: {
          bg: {
            primary: 'rgb(var(--bg-primary-rgb) / <alpha-value>)',
            secondary: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
            tertiary: 'rgb(var(--bg-tertiary-rgb) / <alpha-value>)',
            elevated: 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
            hover: 'rgb(var(--bg-hover-rgb) / <alpha-value>)',
          },
          text: {
            primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
            secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
            muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
            disabled: 'rgb(var(--text-disabled-rgb) / <alpha-value>)',
            /* NEW: inverse text for accent backgrounds */
            inverse: 'rgb(var(--neutral-rgb) / <alpha-value>)',
          },
          border: 'rgb(var(--border-color-rgb) / <alpha-value>)',
          accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
          'accent-hover': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          neutral: 'rgb(var(--neutral-rgb) / <alpha-value>)',
          success: 'rgb(var(--success-rgb) / <alpha-value>)',
          warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
          error: 'rgb(var(--error-rgb) / <alpha-value>)',
          canvas: {
            bg: 'rgb(var(--canvas-bg-rgb) / <alpha-value>)',
            grid: 'rgb(var(--canvas-grid-rgb) / <alpha-value>)',
          },
          sidebar: {
            bg: 'rgb(var(--sidebar-bg-rgb) / <alpha-value>)',
          },
          panel: {
            bg: 'rgb(var(--panel-bg-rgb) / <alpha-value>)',
          },
        },
      },
    },
  },
  plugins: [],
}