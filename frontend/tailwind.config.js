/**
 * @file frontend/tailwind.config.js
 * @description This update adds new color definitions for disabled button states.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-text': 'var(--color-primary-text)',
        secondary: 'var(--color-secondary)',
        'secondary-hover': 'var(--color-secondary-hover)',
        'secondary-text': 'var(--color-secondary-text)',
        danger: 'var(--color-danger)',
        'danger-hover': 'var(--color-danger-hover)',
        'danger-text': 'var(--color-danger-text)',
        'danger-surface': 'var(--color-danger-surface)',
        critical: 'var(--color-critical)',
        'critical-text': 'var(--color-critical-text)',
        warning: 'var(--color-warning)',
        'warning-hover': 'var(--color-warning-hover)',
        'warning-text': 'var(--color-warning-text)',
        'warning-surface': 'var(--color-warning-surface)',
        'warning-surface-hover': 'var(--color-warning-surface-hover)',
        'warning-text-on-surface': 'var(--color-warning-text-on-surface)',
        success: 'var(--color-success)',
        'success-hover': 'var(--color-success-hover)',
        'success-text': 'var(--color-success-text)',
        'success-surface': 'var(--color-success-surface)',
        'success-surface-hover': 'var(--color-success-surface-hover)',
        'success-text-on-surface': 'var(--color-success-text-on-surface)',
        info: 'var(--color-info)',
        'info-surface': 'var(--color-info-surface)',
        'info-text-on-surface': 'var(--color-info-text-on-surface)',
        
        // Disabled state
        'disabled-surface': 'var(--color-disabled-surface)',
        'disabled-text': 'var(--color-disabled-text)',

        // Main background color
        background: 'var(--color-background)',

        // Surface colors for backgrounds
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-accent': 'var(--color-surface-accent)',

        // Text colors
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-accent': 'var(--color-text-accent)',
        'text-inverted': 'var(--color-text-inverted)',

        // Border color
        'border-color': 'var(--color-border)'
      }
    },
  },
  plugins: [],
}