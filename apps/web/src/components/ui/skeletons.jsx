import React from 'react'

/*
  NovaFlow Skeletons — pure Tailwind, zero dependencies
  Shimmer animation via inline style + CSS keyframes in index.css
  All colors use NovaFlow tokens.

  Usage: import { DashboardSkeleton, DesignDetailSkeleton, etc. } from "@/components/ui/Skeletons"
*/

// --------------------------------------------------
// Base shimmer bar — NovaFlow themed
// --------------------------------------------------
const ShimmerBar = ({ className = '', style = {} }) => (
  <div
    className={`skeleton-shimmer rounded-xl ${className}`}
    style={{
      background: 'linear-gradient(90deg, rgb(var(--bg-tertiary-rgb)) 25%, rgb(var(--bg-hover-rgb)) 50%, rgb(var(--bg-tertiary-rgb)) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      ...style,
    }}
  />
)

// --------------------------------------------------
// Design Card Skeleton (used in Dashboard grid)
// --------------------------------------------------
export function DesignCardSkeleton() {
  return (
    <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <ShimmerBar className="h-4 w-16" />
          <ShimmerBar className="h-5 w-3/4" />
          <ShimmerBar className="h-3 w-full" />
        </div>
        <ShimmerBar className="h-9 w-9 rounded-full shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-resonance-bg-tertiary rounded-lg px-2.5 py-1.5 space-y-2">
          <ShimmerBar className="h-3 w-12" />
          <ShimmerBar className="h-6 w-16" />
          <ShimmerBar className="h-3 w-20" />
        </div>
        <div className="bg-resonance-bg-tertiary rounded-lg px-2.5 py-1.5 space-y-2">
          <ShimmerBar className="h-3 w-12" />
          <ShimmerBar className="h-6 w-16" />
          <ShimmerBar className="h-3 w-20" />
        </div>
        <div className="bg-resonance-bg-tertiary rounded-lg px-2.5 py-1.5 space-y-2">
          <ShimmerBar className="h-3 w-12" />
          <ShimmerBar className="h-6 w-16" />
          <ShimmerBar className="h-3 w-20" />
        </div>
        <div className="bg-resonance-bg-tertiary rounded-lg px-2.5 py-1.5 space-y-2">
          <ShimmerBar className="h-3 w-12" />
          <ShimmerBar className="h-6 w-16" />
          <ShimmerBar className="h-3 w-20" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-resonance-border">
        <div className="flex -space-x-2">
          <ShimmerBar className="h-6 w-6 rounded-full" />
          <ShimmerBar className="h-6 w-6 rounded-full" />
          <ShimmerBar className="h-6 w-6 rounded-full" />
        </div>
        <ShimmerBar className="h-3 w-20" />
      </div>
    </div>
  )
}

// --------------------------------------------------
// Dashboard Skeleton (stats + grid)
// --------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <ShimmerBar className="h-9 w-48" />
          <ShimmerBar className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ShimmerBar className="h-10 w-36 rounded-xl" />
          <ShimmerBar className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <ShimmerBar className="h-4 w-24" />
              <ShimmerBar className="h-4 w-4" />
            </div>
            <ShimmerBar className="h-8 w-16" />
            <ShimmerBar className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-resonance-bg-secondary border border-resonance-border rounded-xl p-1">
          {[...Array(5)].map((_, i) => (
            <ShimmerBar key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBar className="h-8 w-56 rounded-lg" />
          <ShimmerBar className="h-8 w-20 rounded-lg" />
          <ShimmerBar className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Design Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <DesignCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------
// Design Detail Skeleton
// --------------------------------------------------
export function DesignDetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="space-y-3">
          <ShimmerBar className="h-4 w-64" />
          <ShimmerBar className="h-9 w-96" />
          <div className="flex gap-4">
            <ShimmerBar className="h-5 w-20" />
            <ShimmerBar className="h-5 w-24" />
            <ShimmerBar className="h-5 w-20" />
            <ShimmerBar className="h-5 w-28" />
          </div>
        </div>
        <div className="flex gap-2.5">
          <ShimmerBar className="h-10 w-32 rounded-xl" />
          <ShimmerBar className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-resonance-border">
        {[...Array(5)].map((_, i) => (
          <ShimmerBar key={i} className="h-12 w-28" />
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 space-y-3">
            <ShimmerBar className="h-4 w-20" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <ShimmerBar className="h-4 w-16" />
                <ShimmerBar className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 space-y-3">
            <ShimmerBar className="h-4 w-12" />
            <div className="flex justify-between">
              <ShimmerBar className="h-4 w-16" />
              <ShimmerBar className="h-4 w-20" />
            </div>
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 space-y-3">
            <ShimmerBar className="h-4 w-24" />
            <ShimmerBar className="h-32 w-32 rounded-full mx-auto" />
          </div>
        </div>

        {/* Main */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 space-y-3">
                <div className="flex justify-between">
                  <ShimmerBar className="h-4 w-20" />
                  <ShimmerBar className="h-4 w-4" />
                </div>
                <ShimmerBar className="h-8 w-12" />
                <ShimmerBar className="h-1.5 w-full" />
              </div>
            ))}
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6 space-y-4">
            <div className="flex justify-between">
              <ShimmerBar className="h-5 w-48" />
              <ShimmerBar className="h-5 w-16" />
            </div>
            <ShimmerBar className="h-24 w-full" />
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6 space-y-4">
            <div className="flex justify-between">
              <ShimmerBar className="h-5 w-40" />
              <ShimmerBar className="h-8 w-24 rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-resonance-bg-tertiary rounded-xl p-5 space-y-2 text-center">
                  <ShimmerBar className="h-8 w-20 mx-auto" />
                  <ShimmerBar className="h-4 w-24 mx-auto" />
                  <ShimmerBar className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Settings Skeleton
// --------------------------------------------------
export function SettingsSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <ShimmerBar className="h-8 w-32" />
        <ShimmerBar className="h-4 w-64" />
      </div>
      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-1">
          {[...Array(6)].map((_, i) => (
            <ShimmerBar key={i} className="h-10 w-full rounded-lg" />
          ))}
          <div className="mt-6 pt-6 border-t border-resonance-border">
            <ShimmerBar className="h-10 w-full rounded-lg" />
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 space-y-6">
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-6">
              <ShimmerBar className="h-20 w-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <ShimmerBar className="h-4 w-48" />
                <ShimmerBar className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ShimmerBar className="h-10 w-full rounded-xl" />
              <ShimmerBar className="h-10 w-full rounded-xl" />
            </div>
            <ShimmerBar className="h-10 w-full rounded-xl" />
            <ShimmerBar className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Canvas Editor Skeleton
// --------------------------------------------------
export function CanvasEditorSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-resonance-canvas-bg">
      {/* Toolbar */}
      <div className="h-14 border-b border-resonance-border flex items-center px-4 gap-4">
        <ShimmerBar className="h-8 w-48 rounded-lg" />
        <div className="flex-1" />
        <ShimmerBar className="h-8 w-32 rounded-lg" />
        <ShimmerBar className="h-8 w-28 rounded-lg" />
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-resonance-border p-4 space-y-3">
          <ShimmerBar className="h-5 w-24" />
          {[...Array(8)].map((_, i) => (
            <ShimmerBar key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        {/* Canvas area */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 grid grid-cols-[repeat(20,1fr)] grid-rows-[repeat(20,1fr)] opacity-5">
            {[...Array(400)].map((_, i) => (
              <div key={i} className="border border-resonance-border" />
            ))}
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <ShimmerBar className="h-64 w-96 rounded-xl" />
          </div>
        </div>
        {/* Right panel */}
        <div className="w-72 border-l border-resonance-border p-4 space-y-3">
          <ShimmerBar className="h-5 w-20" />
          <ShimmerBar className="h-8 w-full rounded-lg" />
          <ShimmerBar className="h-8 w-full rounded-lg" />
          <ShimmerBar className="h-32 w-full rounded-lg" />
          <ShimmerBar className="h-8 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Report List Skeleton
// --------------------------------------------------
export function ReportListSkeleton() {
  return (
    <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden space-y-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
        <ShimmerBar className="h-5 w-48" />
        <div className="flex gap-2">
          <ShimmerBar className="h-8 w-16 rounded-lg" />
          <ShimmerBar className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="grid grid-cols-[48px_1fr_auto_auto] items-center gap-4 px-6 py-4 border-b border-resonance-border last:border-0">
          <ShimmerBar className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <ShimmerBar className="h-4 w-48" />
            <ShimmerBar className="h-3 w-72" />
          </div>
          <div className="flex gap-4">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="text-center space-y-1">
                <ShimmerBar className="h-5 w-8" />
                <ShimmerBar className="h-3 w-8" />
              </div>
            ))}
          </div>
          <ShimmerBar className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------
// Audit Log Skeleton
// --------------------------------------------------
export function AuditLogSkeleton() {
  return (
    <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden space-y-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
        <ShimmerBar className="h-5 w-32" />
        <ShimmerBar className="h-8 w-24 rounded-lg" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="grid grid-cols-[40px_1fr_auto] items-center gap-4 px-6 py-3.5 border-b border-resonance-border last:border-0">
          <ShimmerBar className="h-2 w-2 rounded-full" />
          <div className="space-y-1">
            <ShimmerBar className="h-4 w-48" />
            <ShimmerBar className="h-3 w-96" />
          </div>
          <ShimmerBar className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------
// Text Content Skeleton (generic)
// --------------------------------------------------
export function TextContentSkeleton({ lines = 5 }) {
  return (
    <div className="w-full space-y-3">
      {[...Array(lines)].map((_, i) => {
        const widths = ["w-full", "w-5/6", "w-4/6", "w-full", "w-3/6"]
        return (
          <ShimmerBar
            key={i}
            className={`h-4 ${widths[i % widths.length]} rounded`}
          />
        )
      })}
    </div>
  )
}

// --------------------------------------------------
// User Profile Skeleton
// --------------------------------------------------
export function UserProfileSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <ShimmerBar className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <ShimmerBar className="h-3 w-36 rounded-lg" />
        <ShimmerBar className="h-3 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// --------------------------------------------------
// Template Card Skeleton
// --------------------------------------------------
export function TemplateCardSkeleton() {
  return (
    <div className="p-[1px] rounded-[14px] bg-gradient-to-b from-[rgba(220,252,92,0.6)] via-[rgba(0,98,214,0.3)] to-[rgba(0,0,0,0.15)]">
      <div className="bg-resonance-bg-secondary rounded-[13px] p-6 h-full flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <ShimmerBar className="h-11 w-11 rounded-xl" />
          <ShimmerBar className="h-5 w-16 rounded-full" />
        </div>
        <ShimmerBar className="h-5 w-3/4" />
        <ShimmerBar className="h-3 w-full" />
        <ShimmerBar className="h-3 w-5/6" />
        <ShimmerBar className="h-20 w-full rounded-lg" />
        <div className="flex gap-4 pt-3 border-t border-resonance-border">
          <ShimmerBar className="h-3 w-20" />
          <ShimmerBar className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Templates Page Skeleton
// --------------------------------------------------
export function TemplatesPageSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <ShimmerBar className="h-6 w-48 mx-auto rounded-full" />
        <ShimmerBar className="h-9 w-72 mx-auto" />
        <ShimmerBar className="h-4 w-96 mx-auto" />
        <div className="flex justify-center gap-3 pt-2">
          <ShimmerBar className="h-10 w-36 rounded-xl" />
          <ShimmerBar className="h-10 w-32 rounded-xl" />
        </div>
      </div>
      <ShimmerBar className="h-12 w-full max-w-xl mx-auto rounded-xl" />
      <div className="flex justify-center gap-2 flex-wrap">
        {[...Array(7)].map((_, i) => (
          <ShimmerBar key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <TemplateCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}


// ── Team Management Skeleton ───────────────────────────────────────────────
export function TeamManagementSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-3">
          <ShimmerBar className="h-3 w-24" />
          <ShimmerBar className="h-9 w-64" />
          <ShimmerBar className="h-4 w-96" />
        </div>
        <ShimmerBar className="h-10 w-36 rounded-xl" />
      </div>
      {/* Section title */}
      <div className="space-y-4">
        <ShimmerBar className="h-3 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6 space-y-4"
            >
              <div className="space-y-2">
                <ShimmerBar className="h-5 w-48" />
                <ShimmerBar className="h-3 w-full" />
              </div>
              <div className="flex gap-4">
                <ShimmerBar className="h-3 w-24" />
                <ShimmerBar className="h-3 w-24" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <ShimmerBar className="h-8 w-8 rounded-full" />
                  <ShimmerBar className="h-8 w-8 rounded-full" />
                  <ShimmerBar className="h-8 w-8 rounded-full" />
                </div>
                <ShimmerBar className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Pending invites */}
      <div className="space-y-4">
        <ShimmerBar className="h-3 w-32" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 bg-resonance-bg-secondary border border-resonance-border rounded-xl px-5 py-4"
          >
            <ShimmerBar className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-48" />
              <ShimmerBar className="h-3 w-72" />
            </div>
            <ShimmerBar className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Team Overview Skeleton ──────────────────────────────────────────────────
export function TeamOverviewSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Breadcrumb */}
      <ShimmerBar className="h-4 w-24" />
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ShimmerBar className="h-8 w-8 rounded-lg" />
          <ShimmerBar className="h-9 w-64" />
          <ShimmerBar className="h-6 w-20 rounded-full" />
        </div>
        <ShimmerBar className="h-4 w-96" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 space-y-3"
          >
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-8 w-12" />
            <ShimmerBar className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Team ID */}
      <ShimmerBar className="h-12 w-full rounded-xl" />
      {/* Members + Designs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden space-y-0">
          <div className="px-5 py-4 border-b border-resonance-border flex justify-between">
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-8 w-28 rounded-lg" />
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-3.5 border-b border-resonance-border last:border-0"
            >
              <ShimmerBar className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <ShimmerBar className="h-4 w-32" />
                <ShimmerBar className="h-3 w-48" />
              </div>
              <ShimmerBar className="h-3 w-16" />
              <ShimmerBar className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
        <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden space-y-0">
          <div className="px-5 py-4 border-b border-resonance-border flex justify-between">
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-8 w-28 rounded-lg" />
          </div>
          {[1, 2].map((i) => (
            <div
              key={i}
              className="px-5 py-4 border-b border-resonance-border last:border-0 space-y-3"
            >
              <div className="flex justify-between">
                <ShimmerBar className="h-4 w-40" />
                <ShimmerBar className="h-5 w-16 rounded-full" />
              </div>
              <ShimmerBar className="h-3 w-full" />
              <div className="flex justify-between">
                <ShimmerBar className="h-3 w-32" />
                <ShimmerBar className="h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab Content Skeleton (lightweight refresh placeholder) ──────────────────
export function TabSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <ShimmerBar className="h-4 w-32" />
        <ShimmerBar className="h-10 w-28 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <ShimmerBar className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <ShimmerBar className="h-4 w-32" />
                <ShimmerBar className="h-3 w-48" />
              </div>
              <ShimmerBar className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}