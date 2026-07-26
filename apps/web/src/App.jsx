import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useApiWithAuth } from '@/services/api'
import { useThemeStore } from '@/stores/themeStore'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { DesignDetail } from '@/pages/DesignDetail'
import { CanvasEditor } from '@/pages/CanvasEditor'
import { Settings } from '@/pages/Settings'
import { NotFound } from '@/pages/NotFound'
import { LoadingPage } from '@/components/ui/LoadingSpinner'
import { ReportPage } from '@/pages/ReportPage'
import { Team } from '@/pages/Team'
import { Templates } from '@/pages/Templates'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function App() {
  const { init: initTheme } = useThemeStore()
  const { isLoaded, isSignedIn } = useAuth()

  useApiWithAuth()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  if (!isLoaded) {
    return <LoadingPage message="" />
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Routes>
          <Route
            path="/login"
            element={isSignedIn ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="/sign-up"
            element={isSignedIn ? <Navigate to="/dashboard" replace /> : <Login mode="signUp" />}
          />

          <Route
            path="/"
            element={isSignedIn ? <AppShell /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="designs/:id" element={<DesignDetail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reports" element={<ReportPage />} />
            <Route path="team" element={<Team />} />
            <Route path="templates" element={<Templates />} />
          </Route>

          <Route
            path="/design/:id"
            element={isSignedIn ? <CanvasEditor /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </ToastProvider>
  )
}