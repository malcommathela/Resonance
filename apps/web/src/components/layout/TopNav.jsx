import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, FileText, FolderOpen, Home, LayoutTemplate, Users, Zap } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ProfileDropdown } from '@/components/ui/ProfileDropdown'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  { label: 'Home', icon: Home, path: '/', isActive: (p) => p === '/' },
  { label: 'Designs', icon: FolderOpen, path: '/dashboard', isActive: (p) => p === '/dashboard' || p.startsWith('/designs') },
  { label: 'Templates', icon: LayoutTemplate, path: '/templates', isActive: (p) => p.startsWith('/templates') },
  { label: 'Teams', icon: Users, path: '/team', isActive: (p) => p === '/team' || p.startsWith('/teams') },
  { label: 'Reports', icon: FileText, path: '/reports', isActive: (p) => p.startsWith('/reports') },
]

/*
 * Global top navigation — the app chrome for Home, Designs, Templates,
 * Teams, Reports and Settings. Not rendered in the active-chat workspace,
 * which swaps it for the conversations sidebar.
 */
export const TopNav = ({ className = '' }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()

  return (
    <header
      className={`h-14 shrink-0 bg-resonance-bg-secondary/30 backdrop-blur-xl flex items-center justify-between px-4 gap-4 z-30 ${className}`.trim()}
    >
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-8 h-8 rounded-lg bg-resonance-accent flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Home"
        >
          <Zap size={16} className="text-resonance-neutral" strokeWidth={2.5} />
        </button>
        <span className="text-lg font-bold tracking-tight text-resonance-text-primary hidden sm:block">
          Resonance
        </span>
      </div>

      <nav className="flex items-center gap-1 bg-resonance-bg-tertiary border border-resonance-border rounded-xl p-1 overflow-x-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, path, isActive }) => {
          const active = isActive(pathname)
          return (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-150 ${
                active
                  ? 'bg-resonance-bg-elevated text-resonance-text-primary shadow-sm'
                  : 'text-resonance-text-secondary hover:text-resonance-text-primary'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <button
          type="button"
          title="Notifications"
          className="relative p-2 rounded-lg text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
        >
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-resonance-bg-secondary" />
        </button>
        <div className="w-[160px] hidden md:block">
          <ProfileDropdown user={user} onSignOut={logout} compact />
        </div>
      </div>
    </header>
  )
}
