const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, '../../apps/teleprompter/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base:     '#000000',
          raised:   '#0a0a0a',
          elevated: '#111111',
          overlay:  '#1a1a1a',
        },
        text: {
          primary:   '#ffffff',
          secondary: '#a3a3a3',
          muted:     '#737373',
          disabled:  '#525252',
        },
        accent: {
          DEFAULT: '#e8a838',
          hover:   '#d4952a',
          dim:     '#2a1f00',
        },
        status: {
          live:   '#34d48a',
          warn:   '#f5a623',
          danger: '#f5464a',
          info:   '#38bdf8',
        },
        border: {
          subtle:  '#1a1a1a',
          default: '#2a2a2a',
          strong:  '#3f3f3f',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
