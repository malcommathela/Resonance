import React from 'react'
import { Bell, Settings, ChevronDown, Zap } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Tooltip } from '@/components/ui/Tooltip'

export const Header = () => {
  const { user } = useAuthStore()
  const { theme } = useThemeStore()

  return (
    <header className="h-14 border-b border-resonance-border bg-resonance-bg-secondary flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-resonance-accent flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg text-resonance-text-primary">Resonance</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip content="Notifications">
          <button className="p-2 rounded-lg hover:bg-resonance-bg-hover transition-colors relative">
            <Bell size={18} className="text-resonance-text-secondary" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </Tooltip>

        <ThemeToggle />

        <Tooltip content="Settings">
          <button className="p-2 rounded-lg hover:bg-resonance-bg-hover transition-colors">
            <Settings size={18} className="text-resonance-text-secondary" />
          </button>
        </Tooltip>

        <div className="h-6 w-px bg-resonance-border mx-1" />

        <div className="flex items-center gap-2 pl-2">
          <img
            src={user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
            alt={user?.name}
            className="w-8 h-8 rounded-full border border-resonance-border"
          />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-resonance-text-primary">{user?.name}</p>
            <p className="text-xs text-resonance-text-muted">{user?.team?.name}</p>
          </div>
          <ChevronDown size={14} className="text-resonance-text-muted" />
        </div>
      </div>
    </header>
  )
}