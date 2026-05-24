import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { AuthCallback } from '@/pages/AuthCallback'
import { Dashboard } from '@/pages/Dashboard'
import { DesignDetail } from '@/pages/DesignDetail'
import { CanvasEditor } from '@/pages/CanvasEditor'
import { Settings } from '@/pages/Settings'
import { NotFound } from '@/pages/NotFound'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore()
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-resonance-bg-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-resonance-accent" />
      </div>
    )
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore()
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-resonance-bg-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-resonance-accent" />
      </div>
    )
  }
  
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  const { init: initTheme } = useThemeStore()
  const { init: initAuth } = useAuthStore()
  const location = useLocation()
  const hasInit = React.useRef(false)

  useEffect(() => {
    initTheme()
  }, [initTheme])

  useEffect(() => {
    if (hasInit.current) return
    hasInit.current = true

    const isLoginPage = location.pathname === '/login'
    if (!isLoginPage) {
      initAuth()
    } else {
      useAuthStore.setState({ isLoading: false })
    }
  }, []) // ← EMPTY dependency array, runs once only

  return (
    <ToastProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="designs/:id" element={<DesignDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route
          path="/design/:id"
          element={
            <ProtectedRoute>
              <CanvasEditor />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  )
}