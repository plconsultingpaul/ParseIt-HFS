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
  				elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)'
  			},
  			text: {
  				theme: {
  					primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
  					secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
  					tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
  					accent: 'rgb(var(--color-text-accent) / <alpha-value>)',
  					inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)'
  				}
  			},
  			border: 'hsl(var(--border))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		animation: {
  			'theme-transition': 'theme-transition 0.3s ease-in-out'
  		},
  		keyframes: {
  			'theme-transition': {
  				'0%': {
  					opacity: '0.8'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
