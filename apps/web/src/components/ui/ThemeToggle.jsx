import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

export const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg hover:bg-resonance-bg-hover transition-colors ${className}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-resonance-text-secondary" />
      ) : (
        <Moon size={18} className="text-resonance-text-secondary" />
      )}
    </button>
  )
}
