import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  LayoutTemplate,
  FileText,
  Users,
  Settings,
  Layers,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import ProfileDropdown from '@/components/ui/ProfileDropdown'

const workspaceItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'designs', label: 'Designs', icon: FolderOpen, path: '/dashboard' },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, path: '/templates', beta: true },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
]

const accountItems = [
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export const Sidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuthStore()

  const isActive = (path) => location.pathname === path

  return (
    <aside className="w-60 bg-resonance-bg-secondary border-r border-resonance-border flex flex-col shrink-0 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-8 h-8 bg-resonance-accent rounded-lg flex items-center justify-center text-resonance-neutral">
          <Layers size={18} strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-tight text-resonance-text-primary">
          Resonance
        </span>
      </div>

      {/* Workspace */}
      <nav className="flex-1 px-3">
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-resonance-text-muted">
          Workspace
        </div>

        <div className="space-y-0.5">
          {workspaceItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path) && item.path !== '#'

            return (
              <button
                key={item.id}
                onClick={() => item.path !== '#' && navigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-resonance-accent/15 text-resonance-neutral'
                    : 'text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary'
                }`}
              >
                <Icon size={18} />

                <span className="flex-1 text-left">
                  {item.label}
                </span>

                {item.beta && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-resonance-accent text-resonance-neutral">
                    BETA
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Account */}
        <div className="px-3 mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-resonance-text-muted">
          Account
        </div>

        <div className="space-y-0.5">
          {accountItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path) && item.path !== '#'

            return (
              <button
                key={item.id}
                onClick={() => item.path !== '#' && navigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-resonance-accent/15 text-resonance-neutral'
                    : 'text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary'
                }`}
              >
                <Icon size={18} />

                <span className="flex-1 text-left">
                  {item.label}
                </span>

                {item.id === 'team' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-resonance-accent text-resonance-neutral">
                    BETA
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-resonance-border p-3">
        <ProfileDropdown
          user={user}
          plan="Pro Plan"
          onSignOut={logout}
        />
      </div>
    </aside>
  )
}