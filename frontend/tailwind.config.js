/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:    { DEFAULT: '#1565C0', light: '#1976D2', dark: '#0D47A1' },
        secondary:  { DEFAULT: '#42A5F5', light: '#64B5F6', dark: '#1E88E5' },
        accent:     { DEFAULT: '#00BCD4', light: '#26C6DA', dark: '#00838F' },
        success:    { DEFAULT: '#43A047', light: '#66BB6A', dark: '#2E7D32' },
        warning:    { DEFAULT: '#FB8C00', light: '#FFA726', dark: '#E65100' },
        danger:     { DEFAULT: '#E53935', light: '#EF5350', dark: '#B71C1C' },
        surface:    '#FFFFFF',
        background: '#F0F7FF',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 2px 12px rgba(21,101,192,0.08)',
        modal: '0 8px 40px rgba(21,101,192,0.16)',
        btn:   '0 4px 14px rgba(21,101,192,0.35)',
      },
      borderRadius: {
        xl:  '14px',
        '2xl': '18px',
      },
    },
  },
  plugins: [],
}
