/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#1976d2',
        'primary-blue-hover': '#1565c0',
        'primary-green': '#4caf50',
        'primary-green-hover': '#45a049',
        'primary-red': '#dc2626',
        'primary-red-hover': '#b91c1c',
        'primary-purple': '#9c27b0',
        'primary-purple-hover': '#7b1fa2',
        'secondary-gray': '#f5f5f5',
        'dark-gray': '#333333',
        'light-gray': '#e0e0e0',
        'accent-orange': '#ff9800',
        'accent-orange-hover': '#f57c00',
        'success-green': '#66BB6A',
        'warning-yellow': '#ffeb3b',
        'error-red': '#f44336',
        'info-blue': '#2196f3',
        'text-primary': '#212121',
        'text-secondary': '#757575',
        'background-main': '#fafafa',
        'background-card': '#ffffff',
        'border-light': '#e1e1e1',
        'border-dark': '#bdbdbd',
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.15)',
        'button': '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
};
