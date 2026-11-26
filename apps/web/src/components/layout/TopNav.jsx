import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, FileText, FolderOpen, House, Menu, MessageSquare, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ProfileDropdown } from '@/components/ui/ProfileDropdown'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'

const NAV_ITEMS = [
  { label: 'Home', icon: House, path: '/', isActive: (p) => p === '/', view: 'landing' },
  { label: 'Chat', icon: MessageSquare, path: '/', isActive: (p) => p === '/chat', view: 'chat' },
  { label: 'Designs', icon: FolderOpen, path: '/dashboard', isActive: (p) => p === '/dashboard' || p.startsWith('/designs') },
  { label: 'Teams', icon: Users, path: '/team', isActive: (p) => p === '/team' || p.startsWith('/teams') },
  { label: 'Reports', icon: FileText, path: '/reports', isActive: (p) => p.startsWith('/reports') },
]

export const TopNav = ({ className = '' }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const returnToLanding = useChatStore((s) => s.returnToLanding)
  const createSession = useChatStore((s) => s.createSession)
  const [open, setOpen] = useState(false)

  const VIEW_ACTIONS = {
    landing: returnToLanding,
    chat: createSession,
  }

  const go = ({ path, view }) => {
    if (view) VIEW_ACTIONS[view]()
    navigate(path)
    setOpen(false)
  }

  return (
    <header className={`flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-3 backdrop-blur-xl sm:gap-4 sm:px-4 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => go({ path: '/', view: 'landing' })}
        className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90"
        title="Home"
      >
        <img src="/logo.png" alt="Resonance logo" className="h-8 w-8 rounded-lg object-cover" />
        <span className="hidden text-lg font-bold tracking-tight text-foreground sm:block">Resonance</span>
      </button>

      <nav className="hidden items-center gap-1 rounded-xl border bg-muted p-1 md:flex">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Button
              key={item.label}
              type="button"
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => go(item)}
              className={`gap-1.5 text-[13px] ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <item.icon size={14} />
              {item.label}
            </Button>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Button type="button" variant="ghost" size="icon" title="Notifications" className="relative">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        </Button>
        <div className="hidden md:block">
          <ProfileDropdown user={user} onSignOut={logout} compact />
        </div>
        <div className="md:hidden">
          <ProfileDropdown user={user} onSignOut={logout} avatarOnly />
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Open menu" className="md:hidden">
              <Menu size={18} />
            </Button>
          </SheetTrigger>
          <SheetContent title="Navigation">
            <div className="flex items-center gap-2.5 px-1 py-2">
              <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-lg font-bold tracking-tight text-foreground">Resonance</span>
            </div>
            <nav className="mt-2 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = item.isActive(pathname)
                return (
                  <Button
                    key={item.label}
                    type="button"
                    variant={active ? 'secondary' : 'ghost'}
                    onClick={() => go(item)}
                    className={`w-full justify-start gap-3 ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Button>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
