import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Mail,
  Plus,
  ChevronRight,
  Crown,
  Shield,
  User,
  Layers,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { TeamManagementSkeleton } from '@/components/ui/skeletons'
import { api } from '@/services/api'

const ROLES = {
  owner: { label: 'Owner', icon: Crown, badge: 'warning' },
  admin: { label: 'Admin', icon: Shield, badge: 'accent' },
  member: { label: 'Member', icon: User, badge: 'default' },
}

export const Team = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState([])
  const [invites, setInvites] = useState([])
  const [myInvites, setMyInvites] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadTeams()
    loadMyInvites()
  }, [])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const data = await api.getTeams()
      setTeams(data || [])
    } catch (err) {
      console.error('Failed to load teams:', err)
      showToast({ message: 'Failed to load teams', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadMyInvites = async () => {
    try {
      const data = await api.getMyInvites()
      setMyInvites(data || [])
    } catch (err) {
      console.error('Failed to load invites:', err)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      showToast({ message: 'Team name is required', type: 'error' })
      return
    }

    setCreating(true)
    try {
      const newTeam = await api.createTeam({
        name: teamName.trim(),
        description: teamDescription.trim(),
      })
      setTeams([newTeam, ...teams])
      setShowCreateModal(false)
      setTeamName('')
      setTeamDescription('')
      showToast({ message: 'Team created successfully', type: 'success' })
      navigate(`/teams/${newTeam.id}`)
    } catch (err) {
      console.error('Failed to create team:', err)
      showToast({ message: err.message || 'Failed to create team', type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleAcceptInvite = async (inviteToken) => {
    try {
      const { teamId } = await api.acceptTeamInvite(inviteToken)
      setMyInvites((prev) => prev.filter((i) => i.token !== inviteToken))
      showToast({ message: 'Invite accepted! Redirecting...', type: 'success' })
      setTimeout(() => navigate(`/teams/${teamId}`), 1000)
    } catch (err) {
      console.error('Failed to accept invite:', err)
      showToast({ message: err.message || 'Failed to accept invite', type: 'error' })
    }
  }

    const handleDeclineInvite = async (inviteToken) => {
    try {
      await api.declineTeamInvite(inviteToken)
      setMyInvites((prev) => prev.filter((i) => i.token !== inviteToken))
      showToast({ message: 'Invite declined', type: 'info' })
    } catch (err) {
      console.error('Failed to decline invite:', err)
      showToast({ message: err.message || 'Failed to decline invite', type: 'error' })
    }
  }

  if (loading) {
    return <TeamManagementSkeleton />
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-resonance-accent text-[11px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-resonance-accent" />
            Your Teams
          </div>
          <h1 className="text-3xl font-semibold leading-9 tracking-tight text-resonance-text-primary">
            Team Management
          </h1>
          <p className="text-sm text-resonance-text-secondary leading-[22.75px]">
            Create teams, invite members, and manage access to designs and simulations.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
          Create Team
        </Button>
      </div>

      {/* Teams You Belong To */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-resonance-text-muted">
          <Users size={14} />
          Teams You Belong To
        </div>
        {teams.length === 0 ? (
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 text-center">
            <p className="text-sm text-resonance-text-secondary">
              No teams yet. Create one to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => {
              const RoleIcon = ROLES[team.myRole]?.icon || User
              return (
                <div
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}`)}
                  className="group bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6 cursor-pointer hover:border-resonance-accent/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-resonance-text-primary group-hover:text-resonance-accent transition-colors">
                        {team.name}
                      </h3>
                      <p className="text-sm text-resonance-text-secondary line-clamp-1">
                        {team.description || 'No description'}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-resonance-text-muted group-hover:text-resonance-accent transition-colors shrink-0 mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-sm text-resonance-text-secondary mb-4">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {team.memberCount || 0} members
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers size={14} />
                      {team.designCount || 0} designs
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {/* Placeholder avatars */}
                      {[...Array(Math.min(4, team.memberCount || 0))].map((_, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-resonance-bg-secondary bg-resonance-bg-tertiary flex items-center justify-center text-[10px] font-bold text-resonance-text-secondary shrink-0"
                          style={{
                            marginLeft: i > 0 ? -10 : 0,
                            zIndex: 4 - i,
                          }}
                        >
                          M
                        </div>
                      ))}
                      {(team.memberCount || 0) > 4 && (
                        <div
                          className="w-8 h-8 rounded-full border-2 border-resonance-bg-secondary bg-resonance-bg-tertiary flex items-center justify-center text-[10px] font-medium text-resonance-text-secondary shrink-0"
                          style={{ marginLeft: -10 }}
                        >
                          +{(team.memberCount || 0) - 4}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ROLES[team.myRole]?.badge || 'default'}>
                        <span className="flex items-center gap-1">
                          <RoleIcon size={10} />
                          {ROLES[team.myRole]?.label}
                        </span>
                      </Badge>
                      <span className="text-xs text-resonance-text-muted">
                        {new Date(team.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Pending Invites */}
      {myInvites.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-resonance-text-muted">
            <Mail size={14} />
            Pending Invites
          </div>
          <div className="space-y-2">
            {myInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 bg-resonance-bg-secondary border border-resonance-border rounded-xl px-5 py-4"
              >
                <div className="w-10 h-10 rounded-full bg-resonance-bg-tertiary flex items-center justify-center shrink-0">
                  <Mail size={16} className="text-resonance-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-resonance-text-primary truncate">
                    {invite.email}
                  </div>
                  <div className="text-sm text-resonance-text-secondary truncate">
                    Invited to {invite.teamName} · {invite.role}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => handleAcceptInvite(invite.token)}
                  >
                    Accept
                  </Button>
                  <button
                    onClick={() => handleDeclineInvite(invite.token)}
                    className="p-2 text-resonance-text-muted hover:text-resonance-text-primary transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-resonance-bg-primary border border-resonance-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-resonance-text-primary">Create Team</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-resonance-text-muted hover:text-resonance-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-resonance-text-primary mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Engineering Team"
                  className="w-full px-3 py-2 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-resonance-text-primary mb-2">
                  Description
                </label>
                <textarea
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="What does this team work on?"
                  rows={3}
                  className="w-full px-3 py-2 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTeam}
                  loading={creating}
                  className="flex-1"
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}