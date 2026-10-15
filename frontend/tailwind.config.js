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
        // A quick rise into place, for things that pop open: the post and
        // voice-out form, dialogs, and the profile and admin menus.
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // A slower fade-in with a longer rise, for things arriving on the
        // page: the hero text (Header.jsx) and the board's cards (Reveal.jsx).
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // The hand in the navbar greeting (components/NavGreeting.jsx): two
        // swings that settle, then still for the last 40%, ending upright.
        wave: {
          '0%, 60%, 100%': { transform: 'rotate(0deg)' },
          '10%, 30%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .2s ease-out',
        'fade-in-up': 'fade-in-up .6s ease-out both',
        // Plays once; the short delay lets the loading screen finish fading.
        wave: 'wave 1.8s ease-in-out .2s both',
      },
    },
  },
  plugins: [],
};
