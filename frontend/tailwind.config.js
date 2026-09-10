/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        // CampusVoiceBox brand palette
        navy: {
          50: '#eff5fc',
          100: '#d9e7f7',
          200: '#b6cdec',
          500: '#1a5fae',
          600: '#0f4c92',
          700: '#0d3f7a',
          800: '#0b3260',
          900: '#0a2647',
        },
        cream: '#f7f4e3',
        mustard: '#d9c04f',
      },
      keyframes: {
        // Used by the post/voice-out modal (already in use before this update)
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // NEW: gentle fade-in with no movement, for the hero text
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // NEW: fade-in combined with an upward rise, for staggered sections
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .2s ease-out',
        'fade-in': 'fade-in .6s ease-out both',
        'fade-in-up': 'fade-in-up .6s ease-out both',
      },
    },
  },
  plugins: [],
};
