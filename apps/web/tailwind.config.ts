import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6f3',
          100: '#d6e8e1',
          200: '#afd1c3',
          300: '#86b8a5',
          400: '#5e9b86',
          500: '#3e7d69',
          600: '#1d5c4f',
          700: '#143d33',
          800: '#0d2a23',
          900: '#081815',
        },
        accent: {
          400: '#7fb49f',
          500: '#5e9b86',
          600: '#3e7d69',
        },
        editorial: {
          paper: '#f6f3ee',
          ink: '#14261f',
          line: '#d9d2c8',
          soft: '#fbf8f4',
        },
      },
      fontFamily: {
        display: ['var(--font-newsreader)', 'serif'],
        body: ['var(--font-public-sans)', 'system-ui', 'sans-serif'],
        label: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-public-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        yn: '0.375rem',
        'yn-md': '0.5rem',
      },
      boxShadow: {
        yn: '0 1px 0 rgba(20, 38, 31, 0.08)',
        'yn-soft': '0 2px 12px rgba(20, 38, 31, 0.05)',
      },
      maxWidth: {
        measure: '42rem',
        'measure-wide': '48rem',
      },
    },
  },
  plugins: [typography],
};

export default config;
