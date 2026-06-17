import React, { useState, useEffect, useRef } from 'react'
import {
  User,
  Palette,
  Bell,
  Shield,
  CreditCard,
  Plug,
  ChevronRight,
  Camera,
  Moon,
  Sun,
  Monitor,
  Check,
  LogOut,
  Trash2,
  Github,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { animations } from '@/lib/anime'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { api } from '@/services/api'

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'integrations', label: 'Integrations', icon: Plug },
]

const accentColors = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6',
]

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const { user, logout, updateUser } = useAuthStore()
  const { theme, setTheme, accentColor, setAccentColor, animationsEnabled, setAnimationsEnabled } = useThemeStore()
  const contentRef = useRef(null)

  useEffect(() => {
    if (contentRef.current) animations.fadeInUp(contentRef.current, 0)
  }, [activeTab])

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileSettings user={user} updateUser={updateUser} />
      case 'appearance': return <AppearanceSettings theme={theme} setTheme={setTheme} accentColor={accentColor} setAccentColor={setAccentColor} animationsEnabled={animationsEnabled} setAnimationsEnabled={setAnimationsEnabled} />
      case 'notifications': return <NotificationSettings />
      case 'security': return <SecuritySettings />
      case 'billing': return <BillingSettings user={user} />
      case 'integrations': return <IntegrationSettings />
      default: return null
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-resonance-text-primary">Settings</h1>
        <p className="text-resonance-text-secondary">Manage your account and preferences</p>
      </div>
      <div className="flex gap-8">
        <div className="w-64 shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-resonance-accent/10 text-resonance-accent' : 'text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary'}`}>
                  <Icon size={18} />{tab.label}<ChevronRight size={14} className={`ml-auto transition-transform ${isActive ? 'rotate-90 text-resonance-accent' : 'text-resonance-text-muted'}`} />
                </button>
              )
            })}
          </nav>
          <div className="mt-6 pt-6 border-t border-resonance-border">
            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all">
              <LogOut size={18} />Sign Out
            </button>
          </div>
        </div>
        <div ref={contentRef} className="flex-1 min-w-0" style={{ opacity: 0 }}>{renderContent()}</div>
      </div>
    </div>
  )
}

// --- Profile, Appearance, Notifications, Security, Billing sections unchanged ---
// (Keeping them minimal for brevity, they work the same as before)

const ProfileSettings = ({ user, updateUser }) => {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [bio, setBio] = useState('')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-resonance-text-primary mb-1">My Profile</h2>
        <p className="text-sm text-resonance-text-secondary">Update your personal information</p>
      </div>
      <Card className="p-6">
        <div className="flex items-start gap-6 mb-6">
          <div className="relative">
            <img src={user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} alt={user?.name} className="w-20 h-20 rounded-full border-2 border-resonance-border" />
            <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-resonance-accent text-white flex items-center justify-center shadow-lg hover:bg-resonance-accent-hover transition-colors"><Camera size={14} /></button>
          </div>
          <div className="flex-1">
            <p className="text-sm text-resonance-text-muted mb-2">We support PNGs, JPEGs and GIFs under 2MB</p>
            <div className="flex gap-2"><Button size="sm">Change Image</Button><Button variant="ghost" size="sm">Remove Image</Button></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">First Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">Last Name</label><input type="text" value={name.split(' ')[1] || ''} className="input-field" /></div>
        </div>
        <div className="mt-4"><label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" /></div>
        <div className="mt-4"><label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} className="input-field resize-none" /></div>
      </Card>
      <div className="flex justify-end gap-3"><Button variant="ghost">Cancel</Button><Button onClick={() => updateUser({ name, email })}>Save Changes</Button></div>
    </div>
  )
}

const AppearanceSettings = ({ theme, setTheme, accentColor, setAccentColor, animationsEnabled, setAnimationsEnabled }) => (
  <div className="space-y-6">
    <div><h2 className="text-lg font-semibold text-resonance-text-primary mb-1">Appearance</h2><p className="text-sm text-resonance-text-secondary">Customize how Resonance looks and feels</p></div>
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-resonance-text-primary mb-4">Theme</h3>
      <div className="grid grid-cols-3 gap-4">
        {[{ id: 'light', label: 'Light Mode', icon: Sun }, { id: 'dark', label: 'Dark Mode', icon: Moon }, { id: 'system', label: 'System', icon: Monitor }].map(t => {
          const Icon = t.icon, isActive = theme === t.id
          return (
            <button key={t.id} onClick={() => setTheme(t.id)} className={`relative p-4 rounded-xl border-2 transition-all text-center ${isActive ? 'border-resonance-accent bg-resonance-accent/5' : 'border-resonance-border hover:border-resonance-accent/30'}`}>
              {isActive && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-resonance-accent flex items-center justify-center"><Check size={12} className="text-white" /></div>}
              <Icon size={24} className={`mx-auto mb-2 ${isActive ? 'text-resonance-accent' : 'text-resonance-text-muted'}`} />
              <p className={`text-sm font-medium ${isActive ? 'text-resonance-accent' : 'text-resonance-text-primary'}`}>{t.label}</p>
            </button>
          )
        })}
      </div>
    </Card>
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-resonance-text-primary mb-4">Accent Color</h3>
      <div className="flex flex-wrap gap-3">
        {accentColors.map(color => (
          <button key={color} onClick={() => setAccentColor(color)} className={`w-10 h-10 rounded-full transition-all ${accentColor === color ? 'ring-2 ring-offset-2 ring-offset-resonance-bg-elevated ring-resonance-text-primary scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: color }}>
            {accentColor === color && <Check size={16} className="text-white mx-auto" />}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-resonance-text-secondary">Custom Color</span>
        <div className="flex items-center gap-2">
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded-lg border border-resonance-border cursor-pointer" />
          <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-24 px-2 py-1 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-xs font-mono text-resonance-text-primary" />
        </div>
      </div>
    </Card>
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div><h3 className="text-sm font-semibold text-resonance-text-primary">Show Animations</h3><p className="text-xs text-resonance-text-muted mt-0.5">Enable or disable UI animations</p></div>
        <button onClick={() => setAnimationsEnabled(!animationsEnabled)} className={`relative w-12 h-6 rounded-full transition-colors ${animationsEnabled ? 'bg-resonance-accent' : 'bg-resonance-bg-tertiary border border-resonance-border'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${animationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </Card>
  </div>
)

const NotificationSettings = () => {
  const [settings, setSettings] = useState({ emailNotifications: true, simulationComplete: true, teamInvites: true, marketingEmails: false, securityAlerts: true })
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  const items = [
    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive email updates about your designs' },
    { key: 'simulationComplete', label: 'Simulation Complete', desc: 'Get notified when a simulation finishes' },
    { key: 'teamInvites', label: 'Team Invites', desc: 'Notifications when someone invites you to a team' },
    { key: 'marketingEmails', label: 'Marketing Emails', desc: 'Receive product updates and tips' },
    { key: 'securityAlerts', label: 'Security Alerts', desc: 'Important security notifications' },
  ]
  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-resonance-text-primary mb-1">Notifications</h2><p className="text-sm text-resonance-text-secondary">Choose what you want to be notified about</p></div>
      <Card className="p-6 space-y-4">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium text-resonance-text-primary">{item.label}</p><p className="text-xs text-resonance-text-muted">{item.desc}</p></div>
            <button onClick={() => toggle(item.key)} className={`relative w-12 h-6 rounded-full transition-colors ${settings[item.key] ? 'bg-resonance-accent' : 'bg-resonance-bg-tertiary border border-resonance-border'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </Card>
    </div>
  )
}

const SecuritySettings = () => (
  <div className="space-y-6">
    <div><h2 className="text-lg font-semibold text-resonance-text-primary mb-1">Account Security</h2><p className="text-sm text-resonance-text-secondary">Manage your security preferences</p></div>
    <Card className="p-6 space-y-6">
      <div><h3 className="text-sm font-semibold text-resonance-text-primary mb-1">Email</h3><div className="flex items-center justify-between"><p className="text-sm text-resonance-text-secondary">alex@example.com</p><Button variant="secondary" size="sm">Change email</Button></div></div>
      <div className="border-t border-resonance-border pt-4"><h3 className="text-sm font-semibold text-resonance-text-primary mb-1">Password</h3><div className="flex items-center justify-between"><p className="text-sm text-resonance-text-secondary">••••••••••••</p><Button variant="secondary" size="sm">Change password</Button></div></div>
      <div className="border-t border-resonance-border pt-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-resonance-text-primary">Two-Factor Authentication</h3><p className="text-xs text-resonance-text-muted">Add an extra layer of security</p></div><Button variant="secondary" size="sm">Enable</Button></div></div>
      <div className="border-t border-resonance-border pt-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-resonance-text-primary">Active Sessions</h3><p className="text-xs text-resonance-text-muted">Manage your active login sessions</p></div><Button variant="secondary" size="sm">Manage</Button></div></div>
    </Card>
    <Card className="p-6 border-red-500/20">
      <h3 className="text-sm font-semibold text-red-500 mb-1">Danger Zone</h3>
      <p className="text-xs text-resonance-text-muted mb-4">Permanently delete your account and all data</p>
      <Button variant="danger" size="sm" icon={Trash2}>Delete Account</Button>
    </Card>
  </div>
)

const BillingSettings = ({ user }) => {
  const tiers = [
    { id: 'free', name: 'Free', price: '$0', features: ['3 designs', '3 simulations/day', '1 team member'], current: user?.tier === 'free' },
    { id: 'engineer', name: 'Engineer', price: '$29/mo', features: ['Unlimited designs', 'Unlimited simulations', '5 team members', 'AI suggestions'], current: user?.tier === 'engineer' },
    { id: 'team', name: 'Team', price: '$79/mo', features: ['Everything in Engineer', '20 team members', 'GitHub sync', 'Priority support'], current: user?.tier === 'team' },
  ]
  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-resonance-text-primary mb-1">Billing</h2><p className="text-sm text-resonance-text-secondary">Manage your subscription and billing</p></div>
      <div className="grid grid-cols-3 gap-4">
        {tiers.map(tier => (
          <Card key={tier.id} className={`p-5 relative ${tier.current ? 'ring-2 ring-resonance-accent' : ''}`}>
            {tier.current && <div className="absolute -top-2 left-4 px-2 py-0.5 bg-resonance-accent text-white text-xs font-medium rounded-full">Current</div>}
            <h3 className="text-lg font-bold text-resonance-text-primary">{tier.name}</h3>
            <p className="text-2xl font-bold text-resonance-accent mt-1">{tier.price}</p>
            <ul className="mt-4 space-y-2">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-resonance-text-secondary"><Check size={14} className="text-green-500 shrink-0" />{feature}</li>
              ))}
            </ul>
            {!tier.current && <Button className="w-full mt-4" size="sm" variant="secondary">Upgrade</Button>}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// INTEGRATION SETTINGS — SIMPLIFIED (GitHub OAuth only)
// ============================================================

const IntegrationSettings = () => {
  const { user: clerkUser } = useAuth()
  const [githubConnected, setGithubConnected] = useState(null) // null = loading

  useEffect(() => {
    checkGitHubStatus()
  }, [])

  const checkGitHubStatus = async () => {
    try {
      const status = await api.request('/github/status')
      setGithubConnected(status.connected)
    } catch {
      setGithubConnected(false)
    }
  }

  // Check if user has GitHub as a connected account in Clerk
  const hasGitHubAccount = clerkUser?.externalAccounts?.some(
    acc => acc.provider === 'github' || acc.provider === 'oauth_github'
  )

  const isLoading = githubConnected === null
  const isConnected = githubConnected === true
  const isDisconnected = githubConnected === false

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-resonance-text-primary mb-1">Integrations</h2>
        <p className="text-sm text-resonance-text-secondary">Connect Resonance with your favorite tools</p>
      </div>

      {/* GitHub Integration Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-resonance-bg-tertiary flex items-center justify-center">
              <Github size={24} className="text-resonance-text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-resonance-text-primary">GitHub</h3>
              <p className="text-xs text-resonance-text-muted mt-0.5">
                Import repositories and sync architecture diagrams
              </p>

              <div className="mt-2">
                {isLoading && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-resonance-text-muted">
                    <Loader2 size={12} className="animate-spin" />Checking...
                  </span>
                )}
                {isConnected && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-500">
                    <Check size={12} />Connected
                  </span>
                )}
                {isDisconnected && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-500">
                    <AlertCircle size={12} />Not connected
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium">
                <Check size={14} />Active
              </span>
            ) : (
              <a 
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-resonance-accent text-white rounded-lg text-sm font-medium hover:bg-resonance-accent/90 transition-all"
              >
                <Github size={16} />
                Connect with GitHub
              </a>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
            <p className="text-xs text-green-400">
              <Check size={12} className="inline mr-1" />
              Your GitHub account is connected. You can import from your repositories on the Dashboard.
            </p>
          </div>
        )}

        {isDisconnected && hasGitHubAccount && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <p className="text-xs text-amber-400">
              <AlertCircle size={12} className="inline mr-1" />
              Your account is linked but repository access is not granted. Please sign out and sign back in with GitHub to authorize repository access.
            </p>
          </div>
        )}

        {isDisconnected && !hasGitHubAccount && (
          <div className="mt-4 p-3 rounded-lg bg-resonance-bg-elevated border border-resonance-border">
            <p className="text-xs text-resonance-text-secondary">
              Sign in with GitHub to import your repositories and generate architecture diagrams automatically.
            </p>
          </div>
        )}
      </Card>

      {/* Slack placeholder */}
      <Card className="p-4 flex items-center justify-between opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-resonance-bg-tertiary flex items-center justify-center text-sm font-bold text-resonance-text-primary">SL</div>
          <div><p className="text-sm font-medium text-resonance-text-primary">Slack</p><p className="text-xs text-resonance-text-muted">Get notifications in Slack</p></div>
        </div>
        <Button variant="secondary" size="sm" disabled>Coming Soon</Button>
      </Card>

      {/* Notion placeholder */}
      <Card className="p-4 flex items-center justify-between opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-resonance-bg-tertiary flex items-center justify-center text-sm font-bold text-resonance-text-primary">NO</div>
          <div><p className="text-sm font-medium text-resonance-text-primary">Notion</p><p className="text-xs text-resonance-text-muted">Export designs to Notion</p></div>
        </div>
        <Button variant="secondary" size="sm" disabled>Coming Soon</Button>
      </Card>
    </div>
  )
}