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
        border: '#eaeaea',
        bg: '#ffffff',
        'bg-subtle': '#f5f5f5',
        text: '#171717',
        'text-secondary': '#737373',
        'text-muted': '#a1a1a1',
        prompt: '#6366f1',
        diff: '#f59e0b',
        'test-pass': '#22c55e',
        'test-fail': '#ef4444',
        retry: '#8b5cf6',
        tool: '#06b6d4',
      },
      fontFamily: {
        sans: ['-apple-system', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
