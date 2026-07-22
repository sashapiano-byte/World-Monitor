import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark "situation room" palette.
        panel: '#0d1117',
        'panel-2': '#161b22',
        edge: '#30363d',
        'accent-red': '#f85149',
        'accent-amber': '#d29922',
        'accent-blue': '#58a6ff',
        'accent-green': '#3fb950',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
