import animate from 'tailwindcss-animate'

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
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
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
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}
