import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import {
  ArrowLeft,
  Users,
  Plus,
  Mail,
  X,
  Crown,
  Shield,
  User,
  Layers,
  Trash2,
  LogOut,
  Copy,
  RefreshCw,
  Clock,
  AlertCircle,
  Check,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { TeamOverviewSkeleton, TabSkeleton } from '@/components/ui/skeletons'
import { api } from '@/services/api'
import { useDesignStore } from '@/stores/designStore'
import { formatDate } from '@/lib/dateUtils'
import ErrorBoundary from '@/components/ErrorBoundary'

const ROLES = {
  owner: { label: 'Owner', icon: Crown, badge: 'warning' },
  admin: { label: 'Admin', icon: Shield, badge: 'accent' },
  member: { label: 'Member', icon: User, badge: 'default' },
}

const TabButton = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center ${
      active
        ? 'border-resonance-accent text-resonance-accent'
        : 'border-transparent text-resonance-text-muted hover:text-resonance-text-primary'
    }`}
  >
    {children}
    {badge > 0 && (
      <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-resonance-accent text-resonance-neutral rounded-full min-w-[18px]">
        {badge}
      </span>
    )}
  </button>
)

// ── Helpers ────────────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const getDaysUntil = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  return Math.ceil((date - now) / (1000 * 60 * 60 * 24))
}

const getExpirationBadge = (expiresAt) => {
  const days = getDaysUntil(expiresAt)
  if (days < 0) return { text: 'Expired', variant: 'error' }
  if (days <= 2) return { text: `Expires in ${days} day${days !== 1 ? 's' : ''}`, variant: 'warning' }
  return { text: `Expires in ${days} days`, variant: 'default' }
}

const formatMemberSince = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Component ──────────────────────────────────────────────────────────────
const TeamOverviewComponent = () => {
  const { id: teamId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useUser()
  const { designs } = useDesignStore()

  // State
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [teamDesigns, setTeamDesigns] = useState([])
  const [activeTab, setActiveTab] = useState('designs')

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateDesignModal, setShowCreateDesignModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Form states
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteError, setInviteError] = useState(null)
  const [designName, setDesignName] = useState('')
  const [designDescription, setDesignDescription] = useState('')
  const [selectedDesigns, setSelectedDesigns] = useState(new Set())

  // Loading states
  const [inviting, setInviting] = useState(false)
  const [creatingDesign, setCreatingDesign] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resendingInviteId, setResendingInviteId] = useState(null)
  const [copiedInviteId, setCopiedInviteId] = useState(null)
  const [copiedTeamId, setCopiedTeamId] = useState(false)

  // Settings states
  const [teamNameEdit, setTeamNameEdit] = useState('')
  const [teamDescEdit, setTeamDescEdit] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    loadTeamData()
  }, [teamId])

  useEffect(() => {
    if (team) {
      setTeamNameEdit(team.name || '')
      setTeamDescEdit(team.description || '')
    }
  }, [team])

  const loadTeamData = async (silent = false) => {
  if (!silent) setLoading(true)
  else setIsRefreshing(true)

  try {
    // 1. Fetch team first to know the user's role
    const teamData = await api.getTeam(teamId)

    const canManageInvites =
      teamData?.myRole === 'owner' || teamData?.myRole === 'admin'

    // 2. Fetch everything else in parallel, skipping invites for non-admins
    const [membersData, invitesData, designsData] = await Promise.all([
      api.getTeamMembers(teamId),
      canManageInvites ? api.getTeamInvites(teamId) : Promise.resolve([]),
      api.getTeamDesigns(teamId),
    ])

    setTeam(teamData)
    setMembers(membersData || [])
    setInvites(invitesData || [])
    setTeamDesigns(designsData || [])
  } catch (err) {
    console.error('Failed to load team:', err)
    showToast({ message: 'Failed to load team data', type: 'error' })
  } finally {
    if (!silent) setLoading(false)
    else setIsRefreshing(false)
  }
}

  // ── Invite validation ──────────────────────────────────────────────────
  const memberLimit = team?.maxMembers || 5
  const currentTotal = members.length + invites.length
  const atLimit = currentTotal >= memberLimit

  const validateInviteEmail = (email) => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return null
    if (members.some((m) => m.email?.toLowerCase() === normalized)) {
      return 'This user is already a team member'
    }
    if (invites.some((i) => i.email?.toLowerCase() === normalized)) {
      return 'This email already has a pending invite'
    }
    return null
  }

  const handleInviteEmailChange = (value) => {
    setInviteEmail(value)
    setInviteError(validateInviteEmail(value))
  }

  const handleInviteMember = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      showToast({ message: 'Email is required', type: 'error' })
      return
    }
    const error = validateInviteEmail(email)
    if (error) {
      showToast({ message: error, type: 'error' })
      return
    }
    if (atLimit) {
      showToast({ message: 'Team member limit reached', type: 'error' })
      return
    }

    setInviting(true)
    try {
      await api.inviteTeamMember(teamId, { email, role: inviteRole })
      showToast({ message: 'Invitation sent successfully', type: 'success' })
      setInviteEmail('')
      setInviteRole('member')
      setInviteError(null)
      setShowInviteModal(false)
      await loadTeamData(true)
    } catch (err) {
      console.error('Failed to invite:', err)
      showToast({ message: err.message || 'Failed to send invitation', type: 'error' })
    } finally {
      setInviting(false)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    try {
      await api.revokeTeamInvite(teamId, inviteId)
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
      showToast({ message: 'Invitation revoked', type: 'success' })
    } catch (err) {
      console.error('Failed to revoke invite:', err)
      showToast({ message: 'Failed to revoke invitation', type: 'error' })
    }
  }

  const handleResendInvite = async (invite) => {
    setResendingInviteId(invite.id)
    try {
      await api.inviteTeamMember(teamId, { email: invite.email, role: invite.role })
      showToast({ message: 'Invitation resent', type: 'success' })
      await loadTeamData(true)
    } catch (err) {
      console.error('Failed to resend invite:', err)
      showToast({ message: err.message || 'Failed to resend invitation', type: 'error' })
    } finally {
      setResendingInviteId(null)
    }
  }

  const handleCopyInviteLink = async (invite) => {
    const url = `${window.location.origin}/team/invite?token=${invite.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedInviteId(invite.id)
      showToast({ message: 'Invite link copied to clipboard', type: 'success' })
      setTimeout(() => setCopiedInviteId(null), 2000)
    } catch (err) {
      showToast({ message: 'Failed to copy link', type: 'error' })
    }
  }

  // ── Members (optimistic) ─────────────────────────────────────────────────
  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    const previousMembers = [...members]
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    try {
      await api.removeTeamMember(teamId, memberId)
      showToast({ message: 'Member removed', type: 'success' })
    } catch (err) {
      setMembers(previousMembers)
      console.error('Failed to remove member:', err)
      showToast({ message: 'Failed to remove member', type: 'error' })
    }
  }

  const handleUpdateRole = async (memberId, newRole) => {
    const previousMembers = [...members]
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    )
    try {
      await api.updateTeamMemberRole(teamId, memberId, newRole)
      showToast({ message: 'Role updated', type: 'success' })
    } catch (err) {
      setMembers(previousMembers)
      console.error('Failed to update role:', err)
      showToast({ message: 'Failed to update role', type: 'error' })
    }
  }

  // ── Designs ──────────────────────────────────────────────────────────────
  const handleCreateTeamDesign = async () => {
    if (!designName.trim()) {
      showToast({ message: 'Design name is required', type: 'error' })
      return
    }

    setCreatingDesign(true)
    try {
      await api.createTeamDesign(teamId, {
        name: designName.trim(),
        description: designDescription.trim(),
      })
      showToast({ message: 'Design created successfully', type: 'success' })
      setDesignName('')
      setDesignDescription('')
      setShowCreateDesignModal(false)
      await loadTeamData(true)
    } catch (err) {
      console.error('Failed to create design:', err)
      showToast({ message: 'Failed to create design', type: 'error' })
    } finally {
      setCreatingDesign(false)
    }
  }

  const handleImportDesigns = async () => {
    if (selectedDesigns.size === 0) {
      showToast({ message: 'Please select at least one design', type: 'error' })
      return
    }

    setImporting(true)
    try {
      const results = await Promise.allSettled(
        Array.from(selectedDesigns).map((designId) =>
          api.importDesignToTeam(teamId, designId)
        )
      )

      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      if (successful > 0) {
        showToast({ message: `${successful} design(s) imported`, type: 'success' })
        setSelectedDesigns(new Set())
        setShowImportModal(false)
        await loadTeamData(true)
      }
      if (failed > 0) {
        showToast({ message: `${failed} import(s) failed`, type: 'error' })
      }
    } catch (err) {
      console.error('Failed to import designs:', err)
      showToast({ message: 'Failed to import designs', type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  const handleRemoveDesign = async (designId) => {
    if (!confirm('Remove this design from the team? It will remain in your personal designs.')) return
    try {
      await api.removeDesignFromTeam(teamId, designId)
      showToast({ message: 'Design removed from team', type: 'success' })
      await loadTeamData(true)
    } catch (err) {
      console.error('Failed to remove design:', err)
      showToast({ message: 'Failed to remove design from team', type: 'error' })
    }
  }

  // ── Team lifecycle ─────────────────────────────────────────────────────────
  const handleDeleteTeam = async () => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return
    try {
      await api.deleteTeam(teamId)
      showToast({ message: 'Team deleted', type: 'success' })
      navigate('/team')
    } catch (err) {
      console.error('Failed to delete team:', err)
      showToast({ message: 'Failed to delete team', type: 'error' })
    }
  }

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave this team?')) return
    try {
      await api.removeTeamMember(teamId, user.id)
      showToast({ message: 'You left the team', type: 'success' })
      navigate('/team')
    } catch (err) {
      console.error('Failed to leave team:', err)
      showToast({ message: err.message || 'Failed to leave team', type: 'error' })
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    if (!teamNameEdit.trim()) {
      showToast({ message: 'Team name is required', type: 'error' })
      return
    }
    setSavingSettings(true)
    try {
      await api.updateTeam(teamId, {
        name: teamNameEdit.trim(),
        description: teamDescEdit.trim(),
      })
      showToast({ message: 'Team settings saved', type: 'success' })
      setTeam((prev) => ({ ...prev, name: teamNameEdit.trim(), description: teamDescEdit.trim() }))
    } catch (err) {
      console.error('Failed to save settings:', err)
      showToast({ message: 'Failed to save settings', type: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleCopyTeamId = async () => {
    try {
      await navigator.clipboard.writeText(team.id)
      setCopiedTeamId(true)
      showToast({ message: 'Team ID copied to clipboard', type: 'success' })
      setTimeout(() => setCopiedTeamId(false), 2000)
    } catch (err) {
      showToast({ message: 'Failed to copy Team ID', type: 'error' })
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const isOwner = team?.myRole === 'owner'
  const isAdmin = team?.myRole === 'admin' || isOwner
  const personalDesigns = designs.filter((d) => !d.teamId)

  if (loading) {
    return <TeamOverviewSkeleton />
  }

  if (!team) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8">
        <div className="text-center">
          <p className="text-resonance-text-secondary">Team not found</p>
          <Button variant="secondary" onClick={() => navigate('/team')} className="mt-4">
            Back to Teams
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <button
          onClick={() => navigate('/team')}
          className="flex items-center gap-2 text-resonance-accent hover:text-resonance-accent/80 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to teams
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-resonance-text-primary">{team.name}</h1>
            <p className="text-resonance-text-secondary mt-1">{team.description}</p>
          </div>
          <Badge variant={ROLES[team.myRole]?.badge || 'default'}>
            <span className="flex items-center gap-1">
              {React.createElement(ROLES[team.myRole]?.icon || User, { size: 10 })}
              {ROLES[team.myRole]?.label}
            </span>
          </Badge>
        </div>

        <div className="flex gap-4 text-sm text-resonance-text-secondary flex-wrap">
          <span className="flex items-center gap-1.5">
            <Users size={14} />
            {members.length} / {memberLimit} members
            {atLimit && (
              <Badge variant="warning" className="ml-1">At limit</Badge>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Layers size={14} />
            {teamDesigns.length} designs
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-resonance-border flex gap-8 overflow-x-auto">
        <TabButton active={activeTab === 'designs'} onClick={() => setActiveTab('designs')}>
          Designs
        </TabButton>
        <TabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} badge={invites.length}>
          Members
        </TabButton>
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          Settings
        </TabButton>
      </div>

      {/* Tab Content with refresh overlay */}
      <div className="relative min-h-[200px]">
        {isRefreshing && (
          <div className="absolute inset-0 bg-resonance-bg-primary/40 backdrop-blur-[1px] z-10 flex items-start justify-center pt-20 rounded-xl">
            <RefreshCw size={20} className="animate-spin text-resonance-accent" />
          </div>
        )}

        {/* ── Designs Tab ── */}
        {activeTab === 'designs' && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="flex gap-2">
                <Button icon={Plus} onClick={() => setShowCreateDesignModal(true)}>
                  Create Design
                </Button>
                {personalDesigns.length > 0 && (
                  <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                    Add from My Designs
                  </Button>
                )}
              </div>
            )}

            {teamDesigns.length === 0 ? (
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 text-center">
                <Layers size={32} className="mx-auto text-resonance-text-muted mb-3" />
                <p className="text-resonance-text-secondary font-medium">No designs in this team yet</p>
                {isAdmin ? (
                  <p className="text-sm text-resonance-text-muted mt-1">
                    Create a new design or import one from your personal collection.
                  </p>
                ) : (
                  <p className="text-sm text-resonance-text-muted mt-1">
                    Ask an admin to add designs.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamDesigns.map((design) => (
                  <div
                    key={design.id}
                    onClick={() => navigate(`/designs/${design.id}`)}
                    className="group relative bg-resonance-bg-secondary border border-resonance-border rounded-xl p-4 cursor-pointer hover:border-resonance-accent/30 transition-all"
                  >
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveDesign(design.id)
                        }}
                        className="absolute top-3 right-3 p-1.5 text-resonance-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-500/10"
                        title="Remove from team"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <h3 className="font-semibold text-resonance-text-primary group-hover:text-resonance-accent transition-colors">
                      {design.name}
                    </h3>
                    <p className="text-sm text-resonance-text-secondary line-clamp-2 mt-1">
                      {design.description}
                    </p>

                    {/* Owner avatar */}
                    <div className="flex items-center gap-2 mt-3">
                      {design.owner?.avatar ? (
                        <img
                          src={design.owner.avatar}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-resonance-bg-tertiary flex items-center justify-center text-[9px] text-resonance-text-muted font-medium">
                          {getInitials(design.owner?.name)}
                        </div>
                      )}
                      <span className="text-xs text-resonance-text-muted">
                        {design.owner?.name || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs text-resonance-text-muted">
                      <span>{design.blocks || 0} blocks</span>
                      <span>{formatDate(design.updatedAt || design.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Members Tab ── */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Member limit & invite CTA */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-resonance-text-secondary">
                <span className="font-medium text-resonance-text-primary">{members.length}</span> active members
                {invites.length > 0 && (
                  <span className="ml-2">
                    · <span className="font-medium text-resonance-text-primary">{invites.length}</span> pending
                  </span>
                )}
              </div>
              {isAdmin && (
                <Tooltip content={atLimit ? 'Member limit reached' : 'Invite by email'} position="left">
                  <div>
                    <Button
                      icon={Mail}
                      onClick={() => setShowInviteModal(true)}
                      disabled={atLimit}
                    >
                      Invite Member
                    </Button>
                  </div>
                </Tooltip>
              )}
            </div>

            {/* Pending Invites */}
            {isAdmin && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-resonance-text-primary flex items-center gap-2">
                  <Clock size={14} className="text-resonance-text-muted" />
                  Pending Invites
                </h3>

                {invites.length === 0 ? (
                  <div className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4 text-center">
                    <p className="text-sm text-resonance-text-muted">No pending invitations</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => {
                      const exp = getExpirationBadge(invite.expiresAt)
                      const isExpired = exp.variant === 'error'
                      return (
                        <div
                          key={invite.id}
                          className={`flex items-center justify-between bg-resonance-bg-secondary border rounded-lg p-3 ${
                            isExpired ? 'border-red-500/20 opacity-70' : 'border-resonance-border'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-resonance-bg-tertiary flex items-center justify-center">
                              <Mail size={14} className="text-resonance-text-muted" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-resonance-text-primary truncate">
                                {invite.email}
                              </p>
                              <p className="text-xs text-resonance-text-muted truncate">
                                {invite.inviter ? (
                                  <span>Invited by {invite.inviter.name}</span>
                                ) : (
                                  <span>Invited recently</span>
                                )}
                                {' · '}
                                <Badge variant={exp.variant} className="text-[10px] px-1 py-0">
                                  {exp.text}
                                </Badge>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            {!isExpired && (
                              <>
                                <Tooltip content="Copy invite link" position="top">
                                  <button
                                    onClick={() => handleCopyInviteLink(invite)}
                                    className={`p-1.5 rounded-md transition-colors ${
                                      copiedInviteId === invite.id
                                        ? 'text-green-500 bg-green-500/10'
                                        : 'text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-tertiary'
                                    }`}
                                  >
                                    {copiedInviteId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                                  </button>
                                </Tooltip>

                                <Tooltip content="Resend invite" position="top">
                                  <button
                                    onClick={() => handleResendInvite(invite)}
                                    disabled={resendingInviteId === invite.id}
                                    className="p-1.5 text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-tertiary rounded-md transition-colors disabled:opacity-50"
                                  >
                                    <RefreshCw
                                      size={14}
                                      className={resendingInviteId === invite.id ? 'animate-spin' : ''}
                                    />
                                  </button>
                                </Tooltip>
                              </>
                            )}

                            <Tooltip content="Revoke invitation" position="top">
                              <button
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="p-1.5 text-resonance-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Active Members List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-resonance-text-primary flex items-center gap-2">
                <Users size={14} className="text-resonance-text-muted" />
                Members
              </h3>

              {members.length === 0 ? (
                <div className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-8 text-center">
                  <Users size={32} className="mx-auto text-resonance-text-muted mb-3" />
                  <p className="text-sm text-resonance-text-secondary font-medium">No members yet</p>
                  <p className="text-xs text-resonance-text-muted mt-1">
                    Invite colleagues to collaborate on this team.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const isMe = member.clerkId === user?.id || member.id === user?.id
                    const RoleIcon = ROLES[member.role]?.icon || User
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-resonance-bg-secondary border border-resonance-border rounded-lg p-3 hover:border-resonance-border/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-resonance-accent/10 text-resonance-accent flex items-center justify-center text-xs font-bold">
                              {getInitials(member.name)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-resonance-text-primary truncate">
                                {member.name}
                              </p>
                              {isMe && (
                                <Badge variant="accent" className="text-[10px] px-1.5 py-0">
                                  You
                                </Badge>
                              )}
                              <Badge variant={ROLES[member.role]?.badge || 'default'} className="text-[10px] px-1.5 py-0">
                                <span className="flex items-center gap-0.5">
                                  <RoleIcon size={10} />
                                  {ROLES[member.role]?.label}
                                </span>
                              </Badge>
                            </div>
                            <p className="text-xs text-resonance-text-muted truncate">
                              {member.email}
                              {member.createdAt && (
                                <span className="ml-2">· Member since {formatMemberSince(member.createdAt)}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {isAdmin && !isMe && member.role !== 'owner' && (
                            <>
                              <div className="relative">
                                <select
                                  value={member.role}
                                  onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                                  className="appearance-none bg-resonance-bg-tertiary border border-resonance-border text-resonance-text-primary text-xs rounded-md pl-2 pr-6 py-1.5 cursor-pointer hover:border-resonance-accent/30 focus:outline-none focus:border-resonance-accent"
                                >
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <ChevronDown
                                  size={12}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-resonance-text-muted pointer-events-none"
                                />
                              </div>

                              <Tooltip content="Remove member" position="top">
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="p-1.5 text-resonance-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </Tooltip>
                            </>
                          )}

                          {isMe && !isOwner && (
                            <Tooltip content="Leave team" position="top">
                              <button
                                onClick={handleLeaveTeam}
                                className="p-1.5 text-resonance-text-muted hover:text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors"
                              >
                                <LogOut size={14} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-resonance-text-primary flex items-center gap-2">
                <Settings size={18} />
                Team Settings
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={teamNameEdit}
                    onChange={(e) => setTeamNameEdit(e.target.value)}
                    className="w-full bg-resonance-bg-secondary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent transition-colors"
                    placeholder="Enter team name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                    Description
                  </label>
                  <textarea
                    value={teamDescEdit}
                    onChange={(e) => setTeamDescEdit(e.target.value)}
                    rows={3}
                    className="w-full bg-resonance-bg-secondary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent transition-colors resize-none"
                    placeholder="What is this team about?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                    Team ID
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={team.id}
                      readOnly
                      className="flex-1 bg-resonance-bg-tertiary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-muted text-sm font-mono select-all"
                    />
                    <button
                      onClick={handleCopyTeamId}
                      className={`p-2 rounded-lg transition-colors ${
                        copiedTeamId
                          ? 'text-green-500 bg-green-500/10'
                          : 'text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-tertiary'
                      }`}
                      title="Copy Team ID"
                    >
                      {copiedTeamId ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-resonance-text-muted mt-1">
                    Used for API integrations and support requests.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    icon={savingSettings ? RefreshCw : null}
                  >
                    {savingSettings ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    setTeamNameEdit(team.name || '')
                    setTeamDescEdit(team.description || '')
                  }}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-resonance-border pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-resonance-text-primary">Danger Zone</h3>

              {isOwner ? (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-500">Delete Team</p>
                      <p className="text-xs text-resonance-text-muted mt-1">
                        This will permanently delete the team, all team designs, and remove all members. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <Button variant="error" onClick={handleDeleteTeam} className="w-full sm:w-auto">
                    Delete Team
                  </Button>
                </div>
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <LogOut size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-500">Leave Team</p>
                      <p className="text-xs text-resonance-text-muted mt-1">
                        You will lose access to all team designs and will need to be re-invited to rejoin.
                      </p>
                    </div>
                  </div>
                  <Button variant="warning" onClick={handleLeaveTeam} className="w-full sm:w-auto">
                    Leave Team
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-resonance-bg-primary border border-resonance-border rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-resonance-border">
              <h3 className="font-semibold text-resonance-text-primary">Invite Member</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteEmail('')
                  setInviteError(null)
                }}
                className="p-1 text-resonance-text-muted hover:text-resonance-text-primary rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {atLimit && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-500">
                    This team has reached its member limit ({memberLimit}). You cannot send new invites until existing members leave or pending invites are revoked.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => handleInviteEmailChange(e.target.value)}
                  disabled={atLimit}
                  placeholder="colleague@company.com"
                  className={`w-full bg-resonance-bg-secondary border rounded-lg px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent transition-colors ${
                    inviteError ? 'border-red-500/50' : 'border-resonance-border'
                  }`}
                />
                {inviteError && (
                  <p className="text-xs text-red-500 mt-1">{inviteError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ROLES).map(([key, { label, icon: Icon }]) => (
                    key !== 'owner' && (
                      <button
                        key={key}
                        onClick={() => setInviteRole(key)}
                        disabled={atLimit}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                          inviteRole === key
                            ? 'border-resonance-accent bg-resonance-accent/10 text-resonance-accent'
                            : 'border-resonance-border text-resonance-text-muted hover:border-resonance-text-secondary'
                        } ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Icon size={18} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-resonance-border">
              <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleInviteMember}
                disabled={inviting || !inviteEmail.trim() || !!inviteError || atLimit}
                icon={inviting ? RefreshCw : Mail}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Design Modal */}
      {showCreateDesignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-resonance-bg-primary border border-resonance-border rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-resonance-border">
              <h3 className="font-semibold text-resonance-text-primary">Create Team Design</h3>
              <button
                onClick={() => {
                  setShowCreateDesignModal(false)
                  setDesignName('')
                  setDesignDescription('')
                }}
                className="p-1 text-resonance-text-muted hover:text-resonance-text-primary rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                  Design Name *
                </label>
                <input
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="e.g. Production API Gateway"
                  className="w-full bg-resonance-bg-secondary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-resonance-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe this architecture..."
                  className="w-full bg-resonance-bg-secondary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-resonance-border">
              <Button variant="secondary" onClick={() => setShowCreateDesignModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeamDesign}
                disabled={creatingDesign || !designName.trim()}
                icon={creatingDesign ? RefreshCw : Plus}
              >
                {creatingDesign ? 'Creating...' : 'Create Design'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Designs Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-resonance-bg-primary border border-resonance-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-resonance-border">
              <h3 className="font-semibold text-resonance-text-primary">Import from My Designs</h3>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setSelectedDesigns(new Set())
                }}
                className="p-1 text-resonance-text-muted hover:text-resonance-text-primary rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              {personalDesigns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-resonance-text-secondary">No personal designs available</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {personalDesigns.map((design) => {
                    const isSelected = selectedDesigns.has(design.id)
                    return (
                      <button
                        key={design.id}
                        onClick={() => {
                          const next = new Set(selectedDesigns)
                          if (next.has(design.id)) next.delete(design.id)
                          else next.add(design.id)
                          setSelectedDesigns(next)
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-resonance-accent bg-resonance-accent/5'
                            : 'border-resonance-border hover:border-resonance-text-secondary'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-resonance-accent border-resonance-accent'
                              : 'border-resonance-border bg-resonance-bg-secondary'
                          }`}
                        >
                          {isSelected && <Check size={12} className="text-resonance-neutral" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-resonance-text-primary truncate">
                            {design.name}
                          </p>
                          <p className="text-xs text-resonance-text-muted truncate">
                            {design.description || 'No description'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-resonance-border">
              <span className="text-xs text-resonance-text-muted">
                {selectedDesigns.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setShowImportModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportDesigns}
                  disabled={importing || selectedDesigns.size === 0}
                  icon={importing ? RefreshCw : Layers}
                >
                  {importing ? 'Importing...' : 'Import Selected'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Export wrapped in ErrorBoundary ────────────────────────────────────────
export const TeamOverview = (props) => (
  <ErrorBoundary>
    <TeamOverviewComponent {...props} />
  </ErrorBoundary>
)

export default TeamOverview
