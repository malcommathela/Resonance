import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  CheckCircle,
  AlertTriangle,
  Mail,
  ArrowRight,
  Users,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/services/api'

// ── Skeleton ───────────────────────────────────────────────────────────────
const ShimmerBar = ({ className = '', style = {} }) => (
  <div
    className={`rounded-xl ${className}`}
    style={{
      background:
        'linear-gradient(90deg, rgb(var(--bg-tertiary-rgb)) 25%, rgb(var(--bg-hover-rgb)) 50%, rgb(var(--bg-tertiary-rgb)) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      ...style,
    }}
  />
)

const InviteAcceptSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary px-4">
    <div className="max-w-md w-full bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 space-y-6 shadow-lg">
      <div className="flex justify-center">
        <ShimmerBar className="h-16 w-16 rounded-full" />
      </div>
      <div className="space-y-3 text-center">
        <ShimmerBar className="h-6 w-3/4 mx-auto" />
        <ShimmerBar className="h-4 w-1/2 mx-auto" />
      </div>
      <div className="space-y-2">
        <ShimmerBar className="h-10 w-full rounded-lg" />
        <ShimmerBar className="h-4 w-2/3 mx-auto" />
      </div>
    </div>
  </div>
)

// ── Component ──────────────────────────────────────────────────────────────
export const InviteAcceptPage = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()

  const [status, setStatus] = useState('idle') // idle | processing | success | error
  const [error, setError] = useState(null)
  const [teamId, setTeamId] = useState(null)

  const hasRedirectedToLogin = useRef(false)
  const hasAttempted = useRef(false)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const getErrorDetails = useCallback((err) => {
    const code = err?.status || err?.data?.status || err?.response?.status
    const msg = err?.message || err?.data?.error || err?.response?.data?.error
    const returnedTeamId =
      err?.data?.teamId || err?.response?.data?.teamId || err?.teamId

    switch (code) {
      case 400:
        return {
          message: msg || 'Invalid invitation link. Please check the URL and try again.',
          teamId: returnedTeamId,
        }
      case 404:
        return {
          message: 'This invitation link is invalid or the team no longer exists.',
        }
      case 410:
        return {
          message: 'This invitation has expired. Please ask the team owner to send a new one.',
        }
      case 409:
        return {
          message: 'You are already a member of this team.',
          teamId: returnedTeamId,
          isAlreadyMember: true,
        }
      case 403:
        return {
          message:
            'This invitation was sent to a different email address. Please sign in with the correct account.',
        }
      case 429:
        return {
          message: 'Too many attempts. Please wait a moment and try again.',
        }
      default:
        return {
          message: msg || 'Failed to accept invitation. Please try again later.',
        }
    }
  }, [])

  const acceptInvite = useCallback(async () => {
    if (hasAttempted.current) return
    hasAttempted.current = true

    const token = searchParams.get('token')
    if (!token) {
      if (isMounted.current) {
        setError('No invitation token provided. Please use the link from your email.')
        setStatus('error')
      }
      return
    }

    if (isMounted.current) setStatus('processing')

    try {
      const result = await api.acceptTeamInvite(token)
      if (isMounted.current) {
        setTeamId(result.teamId)
        setStatus('success')
        showToast({
          message: 'Invitation accepted! Welcome to the team.',
          type: 'success',
        })
      }
    } catch (err) {
      console.error('Failed to accept invite:', err)
      if (isMounted.current) {
        const { message, teamId: errTeamId, isAlreadyMember } = getErrorDetails(err)
        setError(message)
        setStatus('error')
        if (errTeamId) setTeamId(errTeamId)

        if (isAlreadyMember) {
          showToast({ message: 'You are already a member. Redirecting...', type: 'info' })
        } else {
          showToast({ message, type: 'error' })
        }
      }
    }
  }, [searchParams, showToast, getErrorDetails])

  // ── Auth gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return

    // Not signed in → go to our custom login page, then come back here
    if (!isSignedIn) {
      if (!hasRedirectedToLogin.current) {
        hasRedirectedToLogin.current = true
        const currentPath = window.location.pathname + window.location.search
        navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, { replace: true })
      }
      return
    }

    // Signed in → auto-accept if we haven't tried yet
    if (status === 'idle') {
      acceptInvite()
    }
  }, [isLoaded, isSignedIn, status, acceptInvite, navigate])

  // ── Success redirect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'success' && teamId) {
      navigate(`/teams/${teamId}`, { replace: true })
    }
  }, [status, teamId, navigate])

  // ── Already-member (409) redirect ────────────────────────────────────────
  useEffect(() => {
    if (status === 'error' && teamId && error?.includes('already a member')) {
      const timer = setTimeout(() => {
        if (isMounted.current) {
          navigate(`/teams/${teamId}`, { replace: true })
        }
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [status, teamId, error, navigate])

  // ── Render states ────────────────────────────────────────────────────────

  if (!isLoaded) return <InviteAcceptSkeleton />

  // Waiting for redirect to login
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary px-4">
        <div className="max-w-md w-full bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 text-center shadow-lg space-y-6">
          <Loader2 size={32} className="animate-spin text-resonance-accent mx-auto" />
          <p className="text-sm text-resonance-text-secondary">
            Redirecting to sign in...
          </p>
        </div>
      </div>
    )
  }

  if (status === 'idle' || status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary px-4">
        <div className="max-w-md w-full bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 text-center shadow-lg space-y-6">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-full bg-resonance-accent/10 flex items-center justify-center">
              <Mail size={28} className="text-resonance-accent" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-resonance-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-resonance-accent" />
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-resonance-text-primary">
              Processing Invitation
            </h2>
            <p className="text-sm text-resonance-text-secondary">
              Verifying your invite and adding you to the team...
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-resonance-text-muted">
            <Loader2 size={14} className="animate-spin" />
            <span>Hang tight, this only takes a moment</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary px-4">
        <div className="max-w-md w-full bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-resonance-text-primary">
              You're In!
            </h2>
            <p className="text-sm text-resonance-text-secondary">
              Your invitation has been accepted successfully.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-resonance-accent font-medium">
            <Users size={16} />
            <span>Redirecting to team...</span>
          </div>
          <Button
            onClick={() => navigate(`/teams/${teamId}`)}
            className="w-full"
            icon={ArrowRight}
          >
            Go to Team Now
          </Button>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary px-4">
      <div className="max-w-md w-full bg-resonance-bg-secondary border border-resonance-border rounded-xl p-8 text-center shadow-lg space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-resonance-text-primary">
            Invitation Error
          </h2>
          <p className="text-sm text-resonance-text-secondary">{error}</p>
        </div>
        <p className="text-xs text-resonance-text-muted">
          Please ask the team owner to resend the invitation if the link has expired.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              hasAttempted.current = false
              setStatus('idle')
              setError(null)
            }}
            className="w-full"
          >
            Try Again
          </Button>
          <Button onClick={() => navigate('/team')} className="w-full">
            Back to Teams
          </Button>
        </div>
      </div>
    </div>
  )
}