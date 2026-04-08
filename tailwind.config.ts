import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(220 10% 30%)',
        input: 'hsl(220 11% 33%)',
        ring: 'hsl(199 92% 60%)',
        background: 'hsl(222 16% 14%)',
        foreground: 'hsl(210 24% 93%)',
        primary: {
          DEFAULT: 'hsl(210 100% 62%)',
          foreground: 'hsl(210 40% 98%)'
        },
        secondary: {
          DEFAULT: 'hsl(220 12% 22%)',
          foreground: 'hsl(210 20% 90%)'
        },
        muted: {
          DEFAULT: 'hsl(220 12% 20%)',
          foreground: 'hsl(215 13% 70%)'
        },
        accent: {
          DEFAULT: 'hsl(196 86% 40%)',
          foreground: 'hsl(210 40% 98%)'
        },
        destructive: {
          DEFAULT: 'hsl(0 82% 58%)',
          foreground: 'hsl(210 40% 98%)'
        },
        success: {
          DEFAULT: 'hsl(145 72% 42%)',
          foreground: 'hsl(210 40% 98%)'
        }
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.625rem',
        sm: '0.5rem'
      },
      boxShadow: {
        panel: '0 18px 40px rgba(2, 8, 23, 0.42)'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
