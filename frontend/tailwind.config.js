/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette Sentinel — dark mode orienté graphe
        sentinel: {
          bg:       '#0a0e1a',
          surface:  '#111827',
          card:     '#1a2235',
          border:   '#1e2d45',
          accent:   '#3b82f6',
          'accent-hover': '#2563eb',
          success:  '#10b981',
          warning:  '#f59e0b',
          danger:   '#ef4444',
          muted:    '#64748b',
          text:     '#e2e8f0',
          'text-dim': '#94a3b8',
        },
        // Couleurs par type de nœud
        node: {
          idee:      '#8b5cf6',
          tache:     '#3b82f6',
          projet:    '#f59e0b',
          composant: '#10b981',
        },
        // Couleurs par statut
        statut: {
          backlog:   '#64748b',
          a_faire:   '#3b82f6',
          en_cours:  '#f59e0b',
          termine:   '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in':   'slideIn 0.25s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
