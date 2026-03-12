import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		screens: {
			'sm': '640px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1536px',
			'uw': '1920px',
			'uwl': '2200px',
			'vuw': '2560px',
		},
		container: {
			padding: {
				DEFAULT: '1rem',
				sm: '1.5rem',
				lg: '2rem',
			},
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				status: {
					new: 'hsl(var(--status-new))',
					'new-bg': 'hsl(var(--status-new-bg))',
					'new-border': 'hsl(var(--status-new-border))',
					inprogress: 'hsl(var(--status-inprogress))',
					'inprogress-bg': 'hsl(var(--status-inprogress-bg))',
					'inprogress-border': 'hsl(var(--status-inprogress-border))',
					onhold: 'hsl(var(--status-onhold))',
					'onhold-bg': 'hsl(var(--status-onhold-bg))',
					'onhold-border': 'hsl(var(--status-onhold-border))',
					completed: 'hsl(var(--status-completed))',
					'completed-bg': 'hsl(var(--status-completed-bg))',
					'completed-border': 'hsl(var(--status-completed-border))',
					cancelled: 'hsl(var(--status-cancelled))',
					'cancelled-bg': 'hsl(var(--status-cancelled-bg))',
					'cancelled-border': 'hsl(var(--status-cancelled-border))'
				},
				financial: {
					profit: 'hsl(var(--profit))',
					'profit-bg': 'hsl(var(--profit-bg))',
					'profit-text': 'hsl(var(--profit-text))',
					loss: 'hsl(var(--loss))',
					'loss-bg': 'hsl(var(--loss-bg))',
					'loss-text': 'hsl(var(--loss-text))'
				},
				orders: {
					DEFAULT: 'hsl(var(--orders))',
					bg: 'hsl(var(--orders-bg))',
					border: 'hsl(var(--orders-border))',
					text: 'hsl(var(--orders-text))'
				},
				purchases: {
					DEFAULT: 'hsl(var(--purchases))',
					bg: 'hsl(var(--purchases-bg))',
					border: 'hsl(var(--purchases-border))',
					text: 'hsl(var(--purchases-text))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					bg: 'hsl(var(--info-bg))',
					border: 'hsl(var(--info-border))',
					text: 'hsl(var(--info-text))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					bg: 'hsl(var(--success-bg))',
					border: 'hsl(var(--success-border))',
					text: 'hsl(var(--success-text))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					bg: 'hsl(var(--warning-bg))',
					border: 'hsl(var(--warning-border))',
					text: 'hsl(var(--warning-text))'
				},
				danger: {
					DEFAULT: 'hsl(var(--danger))',
					bg: 'hsl(var(--danger-bg))',
					border: 'hsl(var(--danger-border))',
					text: 'hsl(var(--danger-text))'
				},
				delivery: {
					ordered: 'hsl(var(--delivery-ordered))',
					'ordered-bg': 'hsl(var(--delivery-ordered-bg))',
					'ordered-border': 'hsl(var(--delivery-ordered-border))',
					processing: 'hsl(var(--delivery-processing))',
					'processing-bg': 'hsl(var(--delivery-processing-bg))',
					'processing-border': 'hsl(var(--delivery-processing-border))',
					shipped: 'hsl(var(--delivery-shipped))',
					'shipped-bg': 'hsl(var(--delivery-shipped-bg))',
					'shipped-border': 'hsl(var(--delivery-shipped-border))',
					intransit: 'hsl(var(--delivery-intransit))',
					'intransit-bg': 'hsl(var(--delivery-intransit-bg))',
					'intransit-border': 'hsl(var(--delivery-intransit-border))',
					delivered: 'hsl(var(--delivery-delivered))',
					'delivered-bg': 'hsl(var(--delivery-delivered-bg))',
					'delivered-border': 'hsl(var(--delivery-delivered-border))'
				},
				campaign: {
					draft: 'hsl(var(--campaign-draft))',
					'draft-bg': 'hsl(var(--campaign-draft-bg))',
					'draft-border': 'hsl(var(--campaign-draft-border))',
					active: 'hsl(var(--campaign-active))',
					'active-bg': 'hsl(var(--campaign-active-bg))',
					'active-border': 'hsl(var(--campaign-active-border))',
					paused: 'hsl(var(--campaign-paused))',
					'paused-bg': 'hsl(var(--campaign-paused-bg))',
					'paused-border': 'hsl(var(--campaign-paused-border))',
					completed: 'hsl(var(--campaign-completed))',
					'completed-bg': 'hsl(var(--campaign-completed-bg))',
					'completed-border': 'hsl(var(--campaign-completed-border))'
				},
				progress: {
					0: 'hsl(var(--progress-0))',
					25: 'hsl(var(--progress-25))',
					50: 'hsl(var(--progress-50))',
					75: 'hsl(var(--progress-75))',
					100: 'hsl(var(--progress-100))'
				}
			},
			borderRadius: {
				xl: 'var(--radius-xl)',
				lg: 'var(--radius-lg)',
				md: 'var(--radius)',
				sm: 'var(--radius-sm)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0',
						opacity: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)',
						opacity: '1'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)',
						opacity: '1'
					},
					to: {
						height: '0',
						opacity: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-out': {
					'0%': {
						opacity: '1',
						transform: 'translateY(0)'
					},
					'100%': {
						opacity: '0',
						transform: 'translateY(10px)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'scale-out': {
					from: { transform: 'scale(1)', opacity: '1' },
					to: { transform: 'scale(0.95)', opacity: '0' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-right': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'shimmer': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'glow': {
					'0%, 100%': { opacity: '1', filter: 'brightness(1)' },
					'50%': { opacity: '0.8', filter: 'brightness(1.2)' }
				},
				'update-pulse': {
					'0%': {
						backgroundColor: 'hsl(var(--primary) / 0.15)',
						transform: 'scale(1.02)'
					},
					'100%': {
						backgroundColor: 'transparent',
						transform: 'scale(1)'
					}
				},
				'number-pop': {
					'0%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(1.1)' },
					'100%': { transform: 'scale(1)' }
				},
				'highlight-fade': {
					'0%': {
						boxShadow: '0 0 0 2px hsl(var(--primary) / 0.4)',
					},
					'100%': {
						boxShadow: '0 0 0 0px hsl(var(--primary) / 0)',
					}
				}
			},
			gridAutoRows: {
				fr: 'minmax(0, 1fr)',
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'scale-out': 'scale-out 0.2s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'slide-out-right': 'slide-out-right 0.3s ease-out',
				'enter': 'fade-in 0.3s ease-out, scale-in 0.2s ease-out',
				'exit': 'fade-out 0.3s ease-out, scale-out 0.2s ease-out',
				'shimmer': 'shimmer 2s infinite',
				'float': 'float 3s ease-in-out infinite',
				'glow': 'glow 2s ease-in-out infinite alternate',
				'pulse-glow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'bounce-subtle': 'bounce 1s infinite',
				'spin-slow': 'spin 3s linear infinite',
				'update-pulse': 'update-pulse 300ms ease-out forwards',
				'number-pop': 'number-pop 200ms ease-out',
				'highlight-fade': 'highlight-fade 400ms ease-out forwards'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
