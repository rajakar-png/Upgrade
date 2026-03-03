export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          950: "#0a0e1a",
          900: "#0f1420",
          800: "#151b2b",
          700: "#1e2538",
          600: "#2a3247"
        },
        primary: {
          600: "#4f46e5",
          500: "#6366f1",
          400: "#818cf8",
          300: "#a5b4fc"
        },
        accent: {
          600: "#7c3aed",
          500: "#8b5cf6",
          400: "#a78bfa",
          300: "#c4b5fd"
        },
        // Neon cyan/teal – used for action buttons & highlights
        neon: {
          900: "#042f2e",
          800: "#134e4a",
          700: "#115e59",
          600: "#0d9488",
          500: "#14b8a6",
          400: "#2dd4bf",
          300: "#5eead4",
          200: "#99f6e4"
        },
        // Ink – ultra-dark surface palette (backgrounds, modals)
        ink: {
          950: "#0a0e1a",
          900: "#0f1420",
          800: "#151b2b",
          700: "#1e2538"
        },
        // Aurora – green/emerald tones for success & admin
        aurora: {
          900: "#052e16",
          800: "#14532d",
          700: "#166534",
          600: "#16a34a",
          500: "#22c55e",
          400: "#4ade80",
          300: "#86efac",
          200: "#bbf7d0"
        },
        // Ember – warm orange for alert/action accents
        ember: {
          900: "#431407",
          800: "#7c2d12",
          700: "#9a3412",
          600: "#ea580c",
          500: "#f97316",
          400: "#fb923c",
          300: "#fdba74",
          200: "#fed7aa"
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        'elegant': '0 10px 40px -10px rgba(99, 102, 241, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 30px rgba(99, 102, 241, 0.25)',
        'glow-primary': '0 0 20px rgba(99, 102, 241, 0.35)',
        'glow-accent': '0 0 20px rgba(139, 92, 246, 0.35)',
        'glow-neon': '0 0 20px rgba(20, 184, 166, 0.35)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.35)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.35)',
        '3d': '0 4px 0 rgba(0, 0, 0, 0.25), 0 8px 20px rgba(0, 0, 0, 0.15)',
        '3d-sm': '0 2px 0 rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1)'
      },
      backdropBlur: {
        'xs': '2px'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' }
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-up': 'slide-up 0.6s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'bounce-slow': 'bounce-slow 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'shimmer': 'shimmer 2s linear infinite'
      }
    }
  },
  plugins: []
}
