import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

export const AuthCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleCallback } = useAuthStore()

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      navigate('/login?error=missing_token')
      return
    }

    handleCallback(token)
      .then(() => {
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        navigate('/login?error=auth_failed')
      })
  }, [searchParams, handleCallback, navigate])

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-resonance-bg-primary">
      <Loader2 size={32} className="text-resonance-accent animate-spin" />
      <p className="mt-4 text-resonance-text-secondary">Completing sign in...</p>
    </div>
  )
}