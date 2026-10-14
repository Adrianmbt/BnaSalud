/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Identidad visual dinámica (variables CSS aplicadas por ThemeProvider)
        brand: {
          primary: 'var(--color-primary, #3B98D4)',
          primaryDark: 'color-mix(in srgb, var(--color-primary, #3B98D4) 80%, black)',
          deep: 'var(--color-primary, #1A4B7C)',
          success: 'var(--color-accent, #38B000)',
          danger: 'var(--color-danger, #D90429)',
          dangerDark: 'color-mix(in srgb, var(--color-danger, #D90429) 80%, black)',
          surface: 'var(--color-surface, #F8FAFC)',
        },
        // Compatibilidad
        asistencial: {
          50: 'color-mix(in srgb, var(--color-primary, #0284c7) 10%, white)',
          100: 'color-mix(in srgb, var(--color-primary, #0284c7) 20%, white)',
          500: 'var(--color-secondary, #0284c7)',
          600: 'color-mix(in srgb, var(--color-primary, #0369a1) 90%, black)',
          700: 'color-mix(in srgb, var(--color-primary, #075985) 85%, black)',
          800: 'var(--color-primary, #1A4B7C)',
        }
      },
      fontFamily: {
        sans: ['"var(--font-body, Manrope)"', '"Manrope"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"var(--font-heading, Sora)"', '"Sora"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 20px 45px -18px var(--color-primary, rgba(26, 75, 124, 0.55))',
        'glow-green': '0 18px 40px -18px var(--color-accent, rgba(56, 176, 0, 0.55))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.6s ease both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'float': 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
