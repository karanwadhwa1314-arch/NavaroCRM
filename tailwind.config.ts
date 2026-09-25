import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navaro: {
          green: '#054742',
          turquoise: '#3ECEB9',
          yellow: '#F9DB5F',
          lavender: '#C780ED',
          heath: '#FFFAF3',
          ink: '#000000',
          surface: '#FFFFFF', // derived
          muted: '#4B7974', // derived — green at 72% on heath
          line: '#E1E5DE', // derived — green 12% on heath
          hover: '#EBECE5', // derived — green 8% on heath
          skeleton: '#F5F3EC', // derived — green 4% on heath
          turquoiseTint: '#D8F1E7', // derived
          yellowTint: '#FDEEB8', // derived
          lavenderTint: '#F4E2F2', // derived
        },
        danger: {
          DEFAULT: '#B42318', // derived — semantic red, deliberately not a brand colour
          tint: '#F8E4DD', // derived
        },
      },
      fontFamily: {
        sans: ['var(--font-brand)', 'Poppins', 'Nunito Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.0', fontWeight: '500' }],
        h1: ['28px', { lineHeight: '1.0', fontWeight: '500' }],
        h2: ['20px', { lineHeight: '1.0', fontWeight: '500' }],
        h3: ['16px', { lineHeight: '1.0', fontWeight: '500' }],
        body: ['15px', { lineHeight: '1.2', fontWeight: '300' }],
        sm: ['14px', { lineHeight: '1.2', fontWeight: '300' }],
        label: ['13px', { lineHeight: '1.2', fontWeight: '300' }],
      },
      borderRadius: {
        control: '10px',
        card: '16px',
      },
      boxShadow: {},
    },
  },
  plugins: [],
};
export default config;
