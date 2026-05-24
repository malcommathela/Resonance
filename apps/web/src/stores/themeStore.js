import { create } from 'zustand'
import { THEMES } from '@shared/constants'

export const useThemeStore = create((set, get) => ({
  theme: localStorage.getItem('resonance-theme') || 'dark',
  accentColor: localStorage.getItem('resonance-accent') || '#8b5cf6',
  animationsEnabled: localStorage.getItem('resonance-animations') !== 'false',

  setTheme: (theme) => {
    localStorage.setItem('resonance-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
    get().applyTheme()
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(newTheme)
  },

  setAccentColor: (color) => {
    localStorage.setItem('resonance-accent', color)
    set({ accentColor: color })
    get().applyTheme()
  },

  setAnimationsEnabled: (enabled) => {
    localStorage.setItem('resonance-animations', enabled)
    set({ animationsEnabled: enabled })
  },

  applyTheme: () => {
    const { theme, accentColor } = get()
    const themeVars = THEMES[theme]
    const root = document.documentElement

    if (!themeVars || typeof themeVars !== 'object') {
      console.warn(`Theme "${theme}" not found in THEMES`, THEMES)
      return
    }

    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    root.style.setProperty('--accent', accentColor)
    root.style.setProperty('--accent-hover', accentColor + 'cc')
  },

  init: () => {
    const saved = localStorage.getItem('resonance-theme') || 'dark'
    const validTheme = THEMES[saved] ? saved : 'dark'
    document.documentElement.classList.toggle('dark', saved === 'dark')
    get().applyTheme()
  },
}))
