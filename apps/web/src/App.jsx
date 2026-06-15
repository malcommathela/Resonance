import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useThemeStore } from '@/stores/themeStore'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { DesignDetail } from '@/pages/DesignDetail'
import { CanvasEditor } from '@/pages/CanvasEditor'
import { Settings } from '@/pages/Settings'
import { NotFound } from '@/pages/NotFound'

// Loading spinner component
const LoadingScreen = () => (
  <div className="h-screen flex items-center justify-center bg-resonance-bg-primary">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-resonance-accent" />
  </div>
)

export default function App() {
  const { init: initTheme } = useThemeStore()
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return <LoadingScreen />
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={isSignedIn ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/sign-up" element={isSignedIn ? <Navigate to="/dashboard" replace /> : <Login mode="signUp" />} />

        {/* All main routes are now optionally protected — Clerk handles auth state */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="designs/:id" element={<DesignDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/design/:id" element={<CanvasEditor />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  )
}