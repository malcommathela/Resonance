import React from 'react'
import { Bell, FolderOpen, MessageSquare, Users, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  { label: 'Chat', icon: MessageSquare, path: '/', current: true },
  { label: 'Designs', icon: FolderOpen, path: '/dashboard' },
  { label: 'Teams', icon: Users, path: '/team' },
]

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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap size={16} className="text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">Resonance</span>
      </div>

      <nav className="hidden items-center gap-1 rounded-xl border bg-muted p-1 md:flex">
        {NAV_ITEMS.map(({ label, icon: Icon, path, current }) => (
          <button
            key={label}
            type="button"
            onClick={() => !current && navigate(path)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              current
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
          className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-background bg-destructive" />
        </button>
        <div
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          title={user?.name || 'Profile'}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
