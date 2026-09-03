import React from 'react'
import { Bell, FolderOpen, Home, LayoutTemplate, Users, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  { label: 'Home', icon: Home, path: '/', current: true },
  { label: 'Designs', icon: FolderOpen, path: '/dashboard' },
  { label: 'Templates', icon: LayoutTemplate, path: '/templates' },
  { label: 'Teams', icon: Users, path: '/team' },
]

/* Landing-mode top navigation (matches the vision layout; no left sidebar) */
export const TopNav = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const initials = (user?.name || 'You')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 shrink-0 border-b border-resonance-border bg-resonance-bg-secondary/80 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-resonance-accent flex items-center justify-center">
          <Zap size={16} className="text-resonance-neutral" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-tight text-resonance-text-primary">Resonance</span>
      </div>

      <nav className="hidden md:flex items-center gap-1 bg-resonance-bg-tertiary border border-resonance-border rounded-xl p-1">
        {NAV_ITEMS.map(({ label, icon: Icon, path, current }) => (
          <button
            key={label}
            type="button"
            onClick={() => !current && navigate(path)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              current
                ? 'bg-resonance-bg-elevated text-resonance-text-primary shadow-sm'
                : 'text-resonance-text-secondary hover:text-resonance-text-primary'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          title="Notifications"
          className="relative p-2 rounded-lg text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
        >
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-resonance-bg-secondary" />
        </button>
        <div
          className="w-8 h-8 rounded-full bg-resonance-accent flex items-center justify-center text-xs font-bold text-resonance-neutral cursor-pointer"
          title={user?.name || 'Profile'}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
