import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Settings,
  HelpCircle,
  LogOut,
  Plus,
  Zap,
  FolderOpen,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'designs', label: 'My Designs', icon: FolderOpen, path: '/dashboard' },
  { id: 'templates', label: 'Templates', icon: GitBranch, path: '/dashboard' },
]

const bottomItems = [
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'help', label: 'Help', icon: HelpCircle, path: '#' },
]

export const Sidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const isActive = (path) => location.pathname === path

  return (
    <aside className="w-60 bg-resonance-bg-sidebar border-r border-resonance-border flex flex-col shrink-0">
      <div className="p-4">
        <button
          onClick={() => navigate('/design/new')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-resonance-accent text-white rounded-lg font-medium hover:bg-resonance-accent-hover transition-all duration-200 active:scale-95"
        >
          <Plus size={18} />
          New Design
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`sidebar-item w-full ${active ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="p-3 space-y-1 border-t border-resonance-border">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button
              key={item.id}
              onClick={() => item.path !== '#' && navigate(item.path)}
              className={`sidebar-item w-full ${active ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
        <button
          onClick={logout}
          className="sidebar-item w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
