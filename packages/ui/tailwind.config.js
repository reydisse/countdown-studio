const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Absolute paths so Tailwind scans the right files regardless of which
  // directory Vite runs from (apps/web vs monorepo root).
  content: [
    path.join(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, '../../apps/web/src/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, '../../apps/electron/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base:     '#181614',
          raised:   '#211e1b',
          elevated: '#2c2825',
          overlay:  '#3a3530',
        },
        text: {
          primary:   '#f0ede8',
          secondary: '#b8b2a8',
          muted:     '#8a8278',
          disabled:  '#5a5550',
        },
        accent: {
          DEFAULT: '#e8a838',
          hover:   '#d4952a',
          dim:     '#4a3510',
        },
        status: {
          live:   '#34d48a',
          warn:   '#f5a623',
          danger: '#f5464a',
          info:   '#38bdf8',
        },
        border: {
          subtle:  '#2c2825',
          default: '#3a3530',
          strong:  '#4a4540',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
