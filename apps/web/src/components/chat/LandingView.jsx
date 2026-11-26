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

export const LandingView = () => {
  const designs = useDesignStore((s) => s.designs)
  const isLoading = useDesignStore((s) => s.isLoading)
  const loadDesigns = useDesignStore((s) => s.loadDesigns)
  const startDesignChat = useChatStore((s) => s.startDesignChat)
  const theme = useThemeStore((s) => s.theme)
  const accentColor = useThemeStore((s) => s.accentColor)
  const heroAccent = theme === 'dark' ? accentColor : '#4d7c0f'
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
      <section className="relative flex flex-col items-center overflow-hidden px-4 pb-12 pt-24 text-center md:pt-16">
        <div aria-hidden className="absolute inset-0">
          <Topography
            lowColor={theme === 'dark' ? '#3f3f46' : '#e4e4e7'}
            midColor={heroAccent}
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
            opacity={theme === 'dark' ? 0.85 : 0.5}
            grain
            grainIntensity={0.05}
            mouseInteraction
            mouseRadius={0.3}
            mouseStrength={0.4}
          />
          <div className="pointer-events-none absolute inset-0 bg-background/40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_38%,hsl(var(--background))_0%,hsl(var(--background)/0.85)_38%,transparent_72%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-background" />
        </div>

        <h1 className="animate-fade-in-up relative z-10 text-[32px] font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Prompt it. <span style={{ color: heroAccent }}>Resonate</span> it.
        </h1>
        <p className="animate-fade-in-up stagger-1 relative z-10 mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
          Ask a question, explore a trade-off, or describe a system.
          <br className="hidden md:block" /> Resonance only creates a design when you ask it to.
        </p>

        <div className="animate-fade-in-up stagger-2 relative z-10 mt-8 w-full max-w-3xl">
          <ChatComposer variant="hero" autoFocus />
        </div>

        <div className="animate-fade-in-up stagger-3 relative z-10 mt-5">
          <QuickActionChips variant="landing" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Designs</h2>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </button>
        </div>

        {isLoading && designs.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
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
          <div className="rounded-xl border border-dashed py-14 text-center">
            <Layers size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No designs yet — describe one above, or{' '}
              <button onClick={() => navigate('/dashboard')} className="text-primary hover:underline">
                open the dashboard
              </button>{' '}
              to import from GitHub.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((design) => (
              <DesignCard key={design.id} design={design} onChat={handleChat} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
