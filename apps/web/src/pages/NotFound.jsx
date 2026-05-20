import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft, Zap } from 'lucide-react'
import { animations } from '@/lib/anime'
import { Button } from '@/components/ui/Button'

export const NotFound = () => {
  const navigate = useNavigate()
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current) {
      animations.fadeInUp(containerRef.current, 0)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary">
      <div
        ref={containerRef}
        className="text-center max-w-md mx-auto px-6"
        style={{ opacity: 0 }}
      >
        {/* Animated 404 */}
        <div className="relative mb-8">
          <h1 className="text-9xl font-bold text-resonance-text-primary/5 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-resonance-accent/10 flex items-center justify-center">
              <Zap size={40} className="text-resonance-accent" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-resonance-text-primary mb-2">
          Page not found
        </h2>
        <p className="text-resonance-text-secondary mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            icon={Home}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
