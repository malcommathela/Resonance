import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import Topography from '@/components/ui/Topography'
import { DesignCard } from '@/components/ui/DesignCard'
import { useDesignStore } from '@/stores/designStore'
import { useChatStore } from '@/stores/chatStore'
import { useThemeStore } from '@/stores/themeStore'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { QuickActionChips } from '@/components/chat/QuickActionChips'

const formatRelativeTime = (date) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 604800)}w ago`
}

/* Hero + recent designs — the landing (`landing` mode) view of Home */
export const LandingView = () => {
  const designs = useDesignStore((s) => s.designs)
  const isLoading = useDesignStore((s) => s.isLoading)
  const loadDesigns = useDesignStore((s) => s.loadDesigns)
  const startDesignChat = useChatStore((s) => s.startDesignChat)
  const theme = useThemeStore((s) => s.theme)
  const accentColor = useThemeStore((s) => s.accentColor)
  const navigate = useNavigate()

  useEffect(() => {
    loadDesigns().catch(() => {})
  }, [loadDesigns])

  const recent = useMemo(
    () =>
      designs.slice(0, 8).map((d) => ({
        ...d,
        score: d.latestReport?.overallScore || 0,
        status: d.status === 'active' ? 'production' : d.status === 'review' ? 'review' : d.status === 'archived' ? 'archived' : 'draft',
        projectedCost: d.latestSimulation?.projectedMonthlyCost
          ? `$${(d.latestSimulation.projectedMonthlyCost / 1000).toFixed(1)}k`
          : '—',
        lastSim: d.latestSimulation?.createdAt ? formatRelativeTime(d.latestSimulation.createdAt) : null,
        updatedAtLabel: formatRelativeTime(d.updatedAt),
        scenario: d.latestSimulation?.scenario || 'No simulations',
        edges: d.edges || 0,
        team: d.team || [],
      })),
    [designs]
  )

  const handleChat = async (design) => {
    await startDesignChat(design)
    navigate('/')
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-4 pt-16 pb-12 overflow-hidden">
        {/* Topographic contour background (mouse-reactive; light scrim keeps text readable) */}
        <div aria-hidden className="absolute inset-0">
          <Topography
            lowColor={theme === 'dark' ? '#3f3f46' : '#e4e4e7'}
            midColor={accentColor}
            highColor={theme === 'dark' ? '#f1f1f4' : '#18181b'}
            speed={0.35}
            morphAmount={3}
            morphSpeed={0.05}
            bands={2}
            thickness={0.12}
            scale={2}
            pixelSize={1}
            glow={0.5}
            colorMode="elevation"
            contrast={3}
            brightness={1}
            fillBands={false}
            opacity={1}
            grain
            grainIntensity={0.05}
            mouseInteraction
            mouseRadius={0.3}
            mouseStrength={0.4}
          />
          <div className="absolute inset-0 bg-resonance-bg-primary/30 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-resonance-bg-primary pointer-events-none" />
        </div>

        <h1 className="relative z-10 text-4xl md:text-5xl font-bold tracking-tight text-resonance-text-primary animate-fade-in-up">
          Prompt it. <span className="text-resonance-accent">Resonate</span> it.
        </h1>
        <p className="relative z-10 mt-4 text-base md:text-lg text-resonance-text-secondary max-w-xl animate-fade-in-up stagger-1">
          Ask a question, explore a trade-off, or describe a system.
          <br className="hidden md:block" /> Resonance only creates a design when you ask it to.
        </p>

        <div className="relative z-10 mt-8 w-full max-w-3xl animate-fade-in-up stagger-2">
          <ChatComposer variant="hero" autoFocus />
        </div>

        <div className="relative z-10 mt-5 animate-fade-in-up stagger-3">
          <QuickActionChips variant="landing" />
        </div>
      </section>

      {/* Recent designs */}
      <section className="max-w-6xl mx-auto px-6 pb-16 w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-resonance-text-primary">Recent Designs</h2>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-[13px] font-medium text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          >
            View all
          </button>
        </div>

        {isLoading && designs.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-resonance-border p-4 space-y-3">
                <div className="skeleton-shimmer h-9 w-full rounded-lg" />
                <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                <div className="skeleton-shimmer h-4 w-1/3 rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="skeleton-shimmer h-10 rounded-lg" />
                  <div className="skeleton-shimmer h-10 rounded-lg" />
                  <div className="skeleton-shimmer h-10 rounded-lg" />
                  <div className="skeleton-shimmer h-10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-14 rounded-xl border border-dashed border-resonance-border">
            <Layers size={32} className="mx-auto text-resonance-text-muted mb-3" />
            <p className="text-sm text-resonance-text-secondary">
              No designs yet — describe one above, or{' '}
              <button onClick={() => navigate('/dashboard')} className="text-resonance-accent hover:underline">
                open the dashboard
              </button>{' '}
              to import from GitHub.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recent.map((design) => (
              <DesignCard key={design.id} design={design} onChat={handleChat} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
