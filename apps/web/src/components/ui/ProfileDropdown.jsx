import * as React from 'react'
import { ChevronDown, FileText, LogOut, Settings, User, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const fallbackAvatar = (seed = 'resonance-user') =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`

export function ProfileDropdown({ user, onSignOut, className, compact = false, avatarOnly = false }) {
  const [isOpen, setIsOpen] = React.useState(false)

  const profile = {
    name: user?.name || user?.firstName || 'User',
    email: user?.email || '',
    avatar: user?.avatar || fallbackAvatar(user?.email || user?.name || 'resonance-user'),
  }

  const menuItems = [
    { label: 'Profile', href: '/settings', icon: <User className="h-4 w-4" /> },
    { label: 'Team', href: '/team', icon: <Users className="h-4 w-4" /> },
    { label: 'Settings', href: '/settings', icon: <Settings className="h-4 w-4" /> },
    { label: 'Terms & Policies', href: '#', icon: <FileText className="h-4 w-4" />, external: true },
  ]

  return (
    <div className={cn('relative w-full', className)}>
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          {avatarOnly ? (
            <button
              type="button"
              title={profile.name}
              aria-label="Open profile menu"
              className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-border focus:outline-none"
            >
              <img alt={profile.name} className="h-full w-full object-cover" src={profile.avatar} />
            </button>
          ) : compact ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left transition-colors hover:bg-accent focus:outline-none"
            >
              <img alt={profile.name} className="h-6 w-6 shrink-0 rounded-full object-cover" src={profile.avatar} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {profile.name}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-accent focus:outline-none"
            >
              <img alt={profile.name} className="h-10 w-10 shrink-0 rounded-full object-cover" src={profile.avatar} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{profile.name}</div>
                <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
              </div>
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side={avatarOnly ? 'right' : compact ? 'bottom' : 'top'}
          sideOffset={8}
          className="w-60"
        >
          {menuItems.map((item) => (
            <DropdownMenuItem asChild key={item.label}>
              {item.external ? (
                <a href={item.href} className="flex w-full cursor-pointer items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              ) : (
                <Link to={item.href} className="flex w-full cursor-pointer items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={onSignOut}
            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default ProfileDropdown
