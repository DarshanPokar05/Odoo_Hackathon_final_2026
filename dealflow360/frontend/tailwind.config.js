/** @type {import('tailwindcss').Config} */
export default {
  // Enable class-based dark mode — toggled by adding 'dark' to <html>
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── Typography ─────────────────────────────────────────────────────────
      fontFamily: {
        display: ['Sora', 'sans-serif'],   // headings, KPI numbers, page titles
        body:    ['Inter', 'sans-serif'],  // body text
        mono:    ['"JetBrains Mono"', 'monospace'], // IDs, currency amounts
      },
      // ── Brand palette (light + dark handled via CSS vars in index.css) ─────
      colors: {
        // Keep existing brand for backwards compat
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Design system accent (violet → teal gradient)
        accent: {
          violet: '#6D5EF0',
          teal:   '#17C3B2',
          dark:   {
            violet: '#8A7BFF',
            teal:   '#2BE0CB',
          },
        },
        // Stage / status colours (same hue, both themes)
        stage: {
          draft:       '#64748b', // slate
          pending:     '#d97706', // amber
          approved:    '#2563eb', // blue
          negotiation: '#7c3aed', // violet
          confirmed:   '#16a34a', // green
          rejected:    '#dc2626', // red
          stalled:     '#dc2626', // red
        },
      },
      // ── Keyframes for live-pulse and entrance animations ─────────────────
      keyframes: {
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(109, 94, 240, 0.4)' },
          '70%':  { boxShadow: '0 0 0 8px rgba(109, 94, 240, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(109, 94, 240, 0)' },
        },
        'count-flash': {
          '0%':   { backgroundColor: 'rgba(109, 94, 240, 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'fade-in-up': {
          '0%':   { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'flow-fill': {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--flow-width)' },
        },
      },
      animation: {
        'pulse-ring':  'pulse-ring 0.9s ease-out',
        'count-flash': 'count-flash 0.9s ease-out',
        'fade-in-up':  'fade-in-up 0.3s ease-out both',
        'flow-fill':   'flow-fill 0.4s ease-out both',
      },
      // ── Box shadow additions ───────────────────────────────────────────────
      boxShadow: {
        'flow-glow': '0 0 10px 2px rgba(109, 94, 240, 0.25)',
      },
    },
  },
  plugins: [],
};
