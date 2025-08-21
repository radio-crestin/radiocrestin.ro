/** @type {import('tailwindcss').Config} */
const themer = require('tailwindcss-themer');

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/common/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'sm': {'max': '640px'},
      'md': {'max': '768px'},
      'lg': {'max': '1160px'},
      'xl': {'max': '1378px'},
      '2xl': {'min': '1536px'},
      'desktop': {'min': '1379px'},
      'tablet': {'min': '769px'},
      'pointer-coarse': {'raw': '(pointer: coarse)'},
    },
  },
  plugins: [
    themer({
      defaultTheme: {
        extend: {
          colors: {
            primary: '#ff6b6b',
            secondary: '#4ecdc4',
            background: {
              DEFAULT: '#ffffff',
              header: '#FFFBEF',
              favorite: '#FFFBEF',
              search: '#ffffff',
              card: '#ffffff',
              active: '#f3f2f2',
              player: '#232321',
              banner: '#c6eaff',
            },
            foreground: {
              DEFAULT: '#000000',
              muted: '#656565',
              player: '#ffffff',
            },
            border: {
              DEFAULT: '#e5e7eb',
              player: 'transparent',
            }
          },
          fontFamily: {
            sans: ['DMSans Regular', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
            'DMSans': ['DMSans Regular', 'sans-serif'],
            'DMSans_Bold': ['DMSans Bold', 'sans-serif'],
            'DMSans_Thin': ['DMSans Thin', 'sans-serif'],
          },
        }
      },
      themes: [
        {
          name: 'dark-theme',
          selectors: ['.dark'],
          extend: {
            colors: {
              primary: '#ff6b6b',
              secondary: '#4ecdc4',
              background: {
                DEFAULT: '#121212',
                header: '#1E1E1E',
                favorite: '#1A1A1A',
                search: '#121212',
                card: '#2A2A2A',
                active: '#333333',
                player: '#121212',
                banner: '#1E1E1E',
              },
              foreground: {
                DEFAULT: '#E0E0E0',
                muted: '#A8A8A8',
                player: '#FFFFFF',
              },
              border: {
                DEFAULT: '#374151',
                player: '#4D4D4D',
              }
            }
          }
        }
      ]
    })
  ],
}