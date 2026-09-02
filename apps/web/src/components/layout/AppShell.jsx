import React from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from '@/components/layout/TopNav'

/*
 * App chrome for the main pages (Designs, Templates, Teams, Reports,
 * Settings): global TopNav on top, content below. The left navigation
 * sidebar is gone — the conversations sidebar only exists inside active
 * chat sessions (see pages/Home.jsx → ChatWorkspace).
 */
export const AppShell = () => {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-resonance-bg-primary">
      <TopNav />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
