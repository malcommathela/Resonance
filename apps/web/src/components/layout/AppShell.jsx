import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export const AppShell = () => {
  return (
    <div className="h-screen flex bg-resonance-bg-primary">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}