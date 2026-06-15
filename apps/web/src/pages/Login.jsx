import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignIn } from '@clerk/clerk-react'
import { Zap, Layers, Activity, Shield } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { animations } from '@/lib/anime'

export const Login = ({ mode = 'signIn' }) => {
  const navigate = useNavigate()
  const { theme } = useThemeStore()

  const leftRef = useRef(null)
  const rightRef = useRef(null)
  const featuresRef = useRef(null)
  const orbsRef = useRef(null)

  useEffect(() => {
    if (leftRef.current) animations.slideInLeft(leftRef.current, 0)
    if (rightRef.current) animations.slideInRight(rightRef.current, 200)
    if (featuresRef.current) animations.staggerFadeIn(featuresRef.current.children, 150)
    if (orbsRef.current) animations.float(orbsRef.current.children)
  }, [])

  const features = [
    { icon: Layers, title: 'Visual Architecture', desc: 'Design systems with drag-and-drop blocks' },
    { icon: Activity, title: 'Real-time Simulation', desc: 'Test load, latency, and failure scenarios' },
    { icon: Shield, title: 'GitHub Integration', desc: 'Reverse-engineer from your repositories' },
    { icon: Zap, title: 'AI Optimization', desc: 'Get intelligent suggestions for improvements' },
  ]

  return (
    <div className="min-h-screen flex bg-resonance-bg-primary">
      {/* Left Panel - Clerk Auth */}
      <div
        ref={leftRef}
        className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12"
        style={{ opacity: 0 }}
      >
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-resonance-accent flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-resonance-text-primary">Resonance</span>
          </div>

          <h1 className="text-3xl font-bold text-resonance-text-primary mb-2">
            {mode === 'signUp' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-resonance-text-secondary mb-8">
            {mode === 'signUp' 
              ? 'Sign up to start designing and simulating your systems.'
              : 'Sign in to continue designing and simulating your systems.'}
          </p>

          {/* Clerk SignIn/SignUp Component */}
          <SignIn 
            routing="hash"
            redirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none p-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-resonance-bg-elevated border border-resonance-border rounded-xl text-resonance-text-primary font-medium hover:bg-resonance-bg-hover hover:border-resonance-accent/30 transition-all duration-200',
                socialButtonsBlockButtonText: 'text-resonance-text-primary',
                formFieldLabel: 'text-sm font-medium text-resonance-text-secondary mb-1.5',
                formFieldInput: 'w-full px-4 py-3 bg-resonance-bg-elevated border border-resonance-border rounded-xl text-resonance-text-primary placeholder:text-resonance-text-muted focus:outline-none focus:border-resonance-accent/50',
                formButtonPrimary: 'w-full px-6 py-3 bg-resonance-accent text-white rounded-xl font-medium hover:bg-resonance-accent/90 transition-all',
                footerActionLink: 'text-resonance-accent hover:underline',
                dividerLine: 'bg-resonance-border',
                dividerText: 'text-resonance-text-muted text-sm',
                identityPreviewText: 'text-resonance-text-primary',
                identityPreviewEditButton: 'text-resonance-accent',
                formFieldErrorText: 'text-red-400 text-sm mt-1',
                alertText: 'text-red-400 text-sm',
              },
              layout: {
                socialButtonsPlacement: 'top',
                showOptionalFields: false,
              },
            }}
          />

          <p className="mt-6 text-center text-sm text-resonance-text-muted">
            By continuing, you agree to our{' '}
            <a href="#" className="text-resonance-accent hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-resonance-accent hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* Right Panel - Brand/Visual */}
      <div
        ref={rightRef}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
            }}
          />
        </div>

        <div ref={orbsRef} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute bottom-32 right-16 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-purple-500/15 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-white mb-4">
              Design, Simulate, Optimize
            </h2>
            <p className="text-lg text-white/70 max-w-md">
              Build production-ready system architectures visually. Test them under real-world conditions before you ship.
            </p>
          </div>

          <div ref={featuresRef} className="grid grid-cols-2 gap-4 max-w-md">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors"
                  style={{ opacity: 0 }}
                >
                  <Icon size={24} className="text-violet-300 mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-white/60">{feature.desc}</p>
                </div>
              )
            })}
          </div>

          <div className="flex gap-8 mt-10">
            <div>
              <p className="text-2xl font-bold text-white">10K+</p>
              <p className="text-sm text-white/60">Designs Created</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">50K+</p>
              <p className="text-sm text-white/60">Simulations Run</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-sm text-white/60">Uptime</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}