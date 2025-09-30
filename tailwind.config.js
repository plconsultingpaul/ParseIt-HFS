/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
          accent: 'rgb(var(--color-bg-accent) / <alpha-value>)',
          surface: 'rgb(var(--color-surface-primary) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        text: {
          theme: {
            primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
            accent: 'rgb(var(--color-text-accent) / <alpha-value>)',
            inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)',
          }
        },
        border: {
          theme: {
            primary: 'rgb(var(--color-border-primary) / <alpha-value>)',
            secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
            accent: 'rgb(var(--color-border-accent) / <alpha-value>)',
          }
        }
      },
      animation: {
        'theme-transition': 'theme-transition 0.3s ease-in-out',
      },
      keyframes: {
        'theme-transition': {
          '0%': { opacity: '0.8' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
};
