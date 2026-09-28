/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // EchoJournal dark design tokens (Phase 4). See docs/ARCHITECTURE.md.
        ink: '#0D0D0F', // app background
        card: '#17171A', // cards / sheets
        edge: '#26262B', // hairline borders
        paper: '#F5F3EE', // primary text (warm white)
        mist: '#A7A7AE', // secondary text
        faint: '#6E6E76', // tertiary text / placeholders
        gold: '#E8A33D', // active tab + primary accent
        grape: '#7C5CFF', // banner / hero accent
        ember: '#E5484D', // recording / destructive
        moss: '#3FA46F', // success
      },
      borderRadius: {
        card: '20px',
        sheet: '24px',
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '800' }],
        title: ['20px', { lineHeight: '26px', fontWeight: '700' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
        micro: ['11px', { lineHeight: '14px', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};
