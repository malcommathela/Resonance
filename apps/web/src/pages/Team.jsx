import React, { useState, useEffect } from 'react'
import {
  Users,
  Mail,
  Plus,
  MoreVertical,
  Shield,
  User,
  Crown,
  X,
  Settings,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Dropdown } from '@/components/ui/Dropdown'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast'

// --------------------------------------------------
// NovaFlow Elevation — gradient border shell
// Spec: linear-gradient(#DCFC5C 0%, #0062D6 55%, #000000 90%)
// --------------------------------------------------
const GRADIENT_SHELL =
  'p-[1px] rounded-xl bg-gradient-to-b from-[#DCFC5C] via-[#0062D6] to-[#000000]'

const ROLES = {
  owner: { label: 'Owner', icon: Crown, badge: 'warning' },
  admin: { label: 'Admin', icon: Shield, badge: 'accent' },
  member: { label: 'Member', icon: User, badge: 'default' },
}

export const Team = () => {
  const { user } = useAuthStore()
  const { showToast } = useToast()

  const [members, setMembers] = useState([])
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    loadTeam()
  }, [])

  const loadTeam = async () => {
    try {
      setLoading(true)

      // Fallback mock data — remove when backend endpoints are live
      const teamData = (await api.getTeam?.()) || {
        id: 'team-1',
        name: 'Engineering',
        maxMembers: 5,
        createdAt: new Date().toISOString(),
      }

      const membersData = (await api.getTeamMembers?.()) || [
        {
          id: '1',
          name: user?.name || 'You',
          email: user?.email || 'you@resonance.dev',
          role: 'owner',
          status: 'active',
          avatar: user?.avatar,
        },
        {
          id: '2',
          name: 'Alex Rivera',
          email: 'alex@resonance.dev',
          role: 'admin',
          status: 'active',
          avatar: null,
        },
        {
          id: '3',
          name: 'Blair Kim',
          email: 'blair@resonance.dev',
          role: 'member',
          status: 'active',
          avatar: null,
        },
        {
          id: '4',
          name: 'Casey Lin',
          email: 'casey@resonance.dev',
          role: 'member',
          status: 'pending',
          avatar: null,
        },
      ]

      setTeam(teamData)
      setMembers(membersData)
    } catch (err) {
      console.error('Failed to load team:', err)
      showToast?.({ message: 'Failed to load team data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviteLoading(true)
    try {
      await api.inviteMember?.({ email: inviteEmail, role: inviteRole })
      showToast?.({ message: `Invitation sent to ${inviteEmail}`, type: 'success' })
      setInviteEmail('')
      setInviteRole('member')
      setInviteOpen(false)
      loadTeam()
    } catch (err) {
      console.error('Invite failed:', err)
      showToast?.({ message: 'Failed to send invitation', type: 'error' })
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemove = async (memberId) => {
    if (!confirm('Remove this member from the team?')) return
    try {
      await api.removeMember?.(memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      showToast?.({ message: 'Member removed', type: 'success' })
    } catch (err) {
      showToast?.({ message: 'Failed to remove member', type: 'error' })
    }
  }

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await api.updateMemberRole?.(memberId, newRole)
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      )
      showToast?.({ message: 'Role updated', type: 'success' })
    } catch (err) {
      showToast?.({ message: 'Failed to update role', type: 'error' })
    }
  }

  const activeCount = members.filter((m) => m.status === 'active').length
  const pendingCount = members.filter((m) => m.status === 'pending').length
  const isOwner = members.find((m) => m.id === user?.id)?.role === 'owner'

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
        <div className="h-8 w-48 bg-resonance-bg-tertiary rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-resonance-bg-secondary border border-resonance-border rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-96 bg-resonance-bg-secondary border border-resonance-border rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold leading-9 tracking-tight text-resonance-text-primary flex items-center gap-3">
            Team
            <Badge variant="beta" className="text-[11px] px-2 py-0.5">Beta</Badge>
          </h1>
          <p className="text-sm text-resonance-text-secondary leading-[22.75px]">
            Manage your team members and their access to designs and simulations.
          </p>
        </div>

        {/* Avatar stack + CTA */}
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            {members.slice(0, 5).map((m, i) => (
              <div
                key={m.id}
                className="w-10 h-10 rounded-full border-2 border-resonance-bg-primary overflow-hidden bg-resonance-accent flex items-center justify-center text-xs font-bold text-resonance-neutral shrink-0"
                style={{ marginLeft: i > 0 ? -12 : 0, zIndex: members.length - i }}
                title={m.name}
              >
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  m.name?.[0]?.toUpperCase() || '?'
                )}
              </div>
            ))}
            {members.length > 5 && (
              <div
                className="w-10 h-10 rounded-full border-2 border-resonance-bg-primary bg-resonance-bg-tertiary flex items-center justify-center text-xs font-medium text-resonance-text-secondary shrink-0"
                style={{ marginLeft: -12 }}
              >
                +{members.length - 5}
              </div>
            )}
          </div>
          <Button onClick={() => setInviteOpen(true)} icon={Plus}>
            Invite Member
          </Button>
        </div>
      </div>

      {/* Stats — gradient shell per NovaFlow elevation spec */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={GRADIENT_SHELL}>
          <div className="bg-resonance-bg-secondary rounded-[11px] p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-resonance-accent/10 flex items-center justify-center">
              <Users size={20} className="text-resonance-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-resonance-text-primary">
                {members.length}
              </div>
              <div className="text-sm text-resonance-text-secondary">Total members</div>
            </div>
          </div>
        </div>

        <div className={GRADIENT_SHELL}>
          <div className="bg-resonance-bg-secondary rounded-[11px] p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-resonance-accent/10 flex items-center justify-center">
              <Shield size={20} className="text-resonance-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-resonance-text-primary">
                {activeCount}
              </div>
              <div className="text-sm text-resonance-text-secondary">Active</div>
            </div>
          </div>
        </div>

        <div className={GRADIENT_SHELL}>
          <div className="bg-resonance-bg-secondary rounded-[11px] p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-resonance-accent/10 flex items-center justify-center">
              <Mail size={20} className="text-resonance-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-resonance-text-primary">
                {pendingCount}
              </div>
              <div className="text-sm text-resonance-text-secondary">Pending invites</div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Info */}
      <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-resonance-accent flex items-center justify-center text-resonance-neutral">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-resonance-text-primary">
              {team?.name || 'Team'}
            </h2>
            <p className="text-sm text-resonance-text-secondary">
              {members.length} of {team?.maxMembers || 5} members • Created{' '}
              {team?.createdAt ? new Date(team.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
        {isOwner && (
          <Button variant="secondary" icon={Settings} className="hidden sm:flex">
            Team Settings
          </Button>
        )}
      </div>

      {/* Members List */}
      <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-resonance-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-resonance-text-primary">Members</h2>
          <span className="text-sm text-resonance-text-muted">{members.length} total</span>
        </div>

        <div className="divide-y divide-resonance-border">
          {members.map((member) => {
            const RoleIcon = ROLES[member.role]?.icon || User
            const roleConfig = ROLES[member.role] || ROLES.member

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-resonance-bg-hover transition-colors duration-150"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-resonance-accent flex items-center justify-center text-sm font-semibold text-resonance-neutral shrink-0 overflow-hidden">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    member.name?.[0]?.toUpperCase() || '?'
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-resonance-text-primary truncate">
                      {member.name}
                    </span>
                    {member.status === 'pending' && (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </div>
                  <div className="text-sm text-resonance-text-secondary truncate">
                    {member.email}
                  </div>
                </div>

                {/* Role + Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={roleConfig.badge}>
                    <span className="flex items-center gap-1">
                      <RoleIcon size={12} />
                      {roleConfig.label}
                    </span>
                  </Badge>

                  {isOwner && member.role !== 'owner' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        align="right"
                        items={[
                          ...Object.entries(ROLES)
                            .filter(([key]) => key !== member.role && key !== 'owner')
                            .map(([key, config]) => ({
                              icon: config.icon,
                              label: `Change to ${config.label}`,
                              onClick: () => handleRoleChange(member.id, key),
                            })),
                          {
                            icon: X,
                            label: 'Remove from team',
                            danger: true,
                            onClick: () => handleRemove(member.id),
                          },
                        ]}
                        trigger={
                          <button className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted transition-colors duration-150">
                            <MoreVertical size={16} />
                          </button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite team member"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              loading={inviteLoading}
              icon={Mail}
              disabled={!inviteEmail.trim()}
            >
              Send Invite
            </Button>
          </div>
        }
      >
        <form onSubmit={handleInvite} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            icon={Mail}
            required
          />

          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">
              Role
            </label>
            <div className="flex gap-2">
              {Object.entries(ROLES)
                .filter(([key]) => key !== 'owner')
                .map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setInviteRole(key)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 ${
                      inviteRole === key
                        ? 'border-resonance-accent bg-resonance-accent/10 text-resonance-text-primary'
                        : 'border-resonance-border text-resonance-text-secondary hover:bg-resonance-bg-hover'
                    }`}
                  >
                    <config.icon size={16} />
                    {config.label}
                  </button>
                ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}