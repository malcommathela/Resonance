import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useApiWithAuth } from '@/services/api'  // ← ADD THIS
import { useThemeStore } from '@/stores/themeStore'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { DesignDetail } from '@/pages/DesignDetail'
import { CanvasEditor } from '@/pages/CanvasEditor'
import { Settings } from '@/pages/Settings'
import { NotFound } from '@/pages/NotFound'

const LoadingScreen = () => (
  <div className="h-screen flex items-center justify-center bg-resonance-bg-primary">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-resonance-accent" />
  </div>
)

export default function App() {
  const { init: initTheme } = useThemeStore()
  const { isLoaded, isSignedIn } = useAuth()
  
  useApiWithAuth()  // ← ADD THIS — initializes token getter immediately

  useEffect(() => {
    initTheme()
  }, [initTheme])

  if (!isLoaded) {
    return <LoadingScreen />
  }

  return (
    <ToastProvider>
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
        </Route>

        <Route 
          path="/design/:id" 
          element={isSignedIn ? <CanvasEditor /> : <Navigate to="/login" replace />} 
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  )
}