import * as React from 'react'
import { Link } from 'react-router-dom'
import { FileText, LogOut, Settings, User, Users } from 'lucide-react'
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

export function ProfileDropdown({ user, onSignOut, className }) {
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
        <div className="group relative w-full">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-resonance-border bg-resonance-bg-secondary p-3 text-left transition-all duration-200 hover:bg-resonance-bg-hover hover:shadow-sm focus:outline-none"
            >
              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-resonance-accent p-0.5">
                  <div className="h-full w-full overflow-hidden rounded-full bg-resonance-bg-secondary">
                    <img
                      alt={profile.name}
                      className="h-full w-full rounded-full object-cover"
                      src={profile.avatar}
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium leading-tight tracking-tight text-resonance-text-primary">
                  {profile.name}
                </div>
                <div className="truncate text-xs leading-tight tracking-tight text-resonance-text-muted">
                  {profile.email}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          <div
            className={cn(
              'absolute top-1/2 -right-2 -translate-y-1/2 transition-all duration-200',
              isOpen ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
            )}
          >
            <svg
              aria-hidden="true"
              className={cn(
                'transition-all duration-200',
                isOpen ? 'scale-110 text-resonance-text-primary' : 'text-resonance-text-muted group-hover:text-resonance-text-secondary'
              )}
              fill="none"
              height="24"
              viewBox="0 0 12 24"
              width="12"
            >
              <path
                d="M2 4C6 8 6 16 2 20"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-64 origin-bottom-right rounded-2xl border border-resonance-border bg-resonance-bg-elevated/95 p-2 shadow-xl backdrop-blur-sm"
          >
            <div className="space-y-1">
              {menuItems.map((item) => (
                <DropdownMenuItem asChild key={item.label}>
                  {item.external ? (
                    <a
                      href={item.href}
                      className="group flex cursor-pointer items-center rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-resonance-border hover:bg-resonance-bg-hover hover:shadow-sm"
                    >
                      <div className="flex flex-1 items-center gap-2 text-resonance-text-secondary">
                        {item.icon}
                        <span className="whitespace-nowrap text-sm font-medium leading-tight tracking-tight text-resonance-text-primary">
                          {item.label}
                        </span>
                      </div>
                    </a>
                  ) : (
                    <Link
                      to={item.href}
                      className="group flex cursor-pointer items-center rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-resonance-border hover:bg-resonance-bg-hover hover:shadow-sm"
                    >
                      <div className="flex flex-1 items-center gap-2 text-resonance-text-secondary">
                        {item.icon}
                        <span className="whitespace-nowrap text-sm font-medium leading-tight tracking-tight text-resonance-text-primary">
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  )}
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-resonance-border to-transparent" />

            <DropdownMenuItem asChild>
              <button
                type="button"
                onClick={onSignOut}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-red-500/10 p-3 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/20 hover:shadow-sm"
              >
                <LogOut className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                <span className="text-sm font-medium text-red-500 group-hover:text-red-600">
                  Sign Out
                </span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </div>
  )
}

export default ProfileDropdown