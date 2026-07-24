import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react'
import { Zap } from 'lucide-react'

export const Login = ({ mode = 'signIn' }) => {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard', { replace: true })
    }
  }, [isSignedIn, navigate])

  if (isSignedIn) return null

  const clerkAppearance = {
    elements: {
      rootBox: 'w-full',
      card: 'bg-transparent shadow-none p-0 border-0',
      headerTitle: 'hidden',
      headerSubtitle: 'hidden',
      socialButtonsBlockButton:
        'w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#111111] border border-[#222222] rounded-xl text-sm font-medium text-white hover:bg-[#1a1a1a] hover:border-[#333333] transition-all duration-150',
      socialButtonsBlockButtonText: 'text-white',
      socialButtonsBlockButtonArrow: 'hidden',
      formFieldLabel: 'hidden',
      formFieldInput:
        'w-full px-4 py-3 bg-[#111111] border border-[#222222] rounded-xl text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#DCFC5C]/40 focus:ring-[3px] focus:ring-[#DCFC5C]/8 transition-all',
      formButtonPrimary:
        'w-full mt-3 px-4 py-3 bg-[#DCFC5C] text-black rounded-xl text-sm font-semibold hover:bg-[#c5e050] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150',
      footerActionLink: 'text-[#9CA3AF] hover:text-white transition-colors font-medium',
      dividerLine: 'bg-[#222222]',
      dividerText: 'text-[#6B7280] text-xs font-medium',
      identityPreviewText: 'text-white',
      identityPreviewEditButton: 'text-[#DCFC5C]',
      formFieldErrorText: 'text-red-400 text-sm mt-1',
      alertText: 'text-red-400 text-sm',
      otpCodeFieldInput: 'bg-[#111111] border-[#222222] text-white',
      footer: 'hidden',
      logoBox: 'hidden',
    },
    layout: {
      socialButtonsPlacement: 'top',
      showOptionalFields: false,
      logoPlacement: 'none',
    },
  }

  const AuthComponent = mode === 'signUp' ? SignUp : SignIn

  return (
    <div className="min-h-screen flex bg-black">
      {/* LEFT PANEL — Auth */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-black">
        <div className="max-w-sm w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10 fade-in-up">
            <div className="w-9 h-9 rounded-xl bg-[#DCFC5C] flex items-center justify-center">
              <Zap size={18} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">Resonance</span>
          </div>

          {/* Headline */}
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white mb-3 fade-in-up stagger-1">
            {mode === 'signUp' ? 'Create your account.' : 'Login or create your account.'}
          </h1>

          {/* Clerk Auth */}
          <div className="mt-8 fade-in-up stagger-2">
            <AuthComponent
              routing="hash"
              redirectUrl="/dashboard"
              appearance={clerkAppearance}
            />
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-[#6B7280] fade-in-up stagger-5">
            By continuing, you agree to Resonance's{' '}
            <a href="#" className="text-[#9CA3AF] hover:text-white transition-colors underline underline-offset-2">
              privacy policy
            </a>
            .
          </p>
        </div>
      </div>

      {/* CENTER VERTICAL DIVIDER */}
      <div className="hidden lg:flex items-center justify-center bg-black">
        <div className="h-[calc(100vh-96px)] w-px bg-[#222222]" />
      </div>

      {/* RIGHT PANEL — Brand / Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
        {/* Ambient orbs */}
        <div className="absolute top-[15%] left-[20%] w-[180px] h-[180px] rounded-full bg-[rgba(220,252,92,0.25)] blur-[60px] opacity-[0.35] animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[20%] right-[15%] w-[220px] h-[220px] rounded-full bg-[rgba(0,98,214,0.2)] blur-[60px] opacity-[0.35] animate-[float_8s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[55%] left-[40%] w-[140px] h-[140px] rounded-full bg-[rgba(220,252,92,0.15)] blur-[60px] opacity-[0.35] animate-[float_8s_ease-in-out_infinite_4s]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(220,252,92,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(220,252,92,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-center px-16 py-12 w-full">
          {/* Header text */}
          <div className="text-center mb-10 fade-in-up stagger-1">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to join Resonance?</h2>
            <p className="text-[#9CA3AF] text-sm max-w-sm mx-auto leading-relaxed">
              Join thousands of teams shipping beautiful, production-ready interfaces in record time.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-10 fade-in-up stagger-2">
            {/* Top row */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl h-24 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]" />
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl h-24 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]" />
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl h-24 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]" />

            {/* Middle row - testimonial spans 3 cols */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl col-span-3 p-5 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-2 mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 1L24 22H0L12 1z" />
                </svg>
                <span className="text-white font-semibold">Vercel</span>
              </div>

              <blockquote className="text-white text-base leading-relaxed mb-4 font-normal">
                "Resonance is why I still have hair. No more worrying about system architecture at 3am."
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#DCFC5C] to-[#b8d94a] flex items-center justify-center text-black font-bold text-xs">
                  GR
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Guillermo Rauch</p>
                  <p className="text-[#6B7280] text-xs">CEO, Vercel</p>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl h-28 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]" />
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl h-28 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]" />
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl h-28 transition-all duration-150 hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]" />
          </div>

          {/* Trusted By */}
          <div className="mt-auto pt-8 fade-in-up stagger-5">
            <p className="text-[#6B7280] text-xs font-medium mb-4 tracking-wide uppercase text-center">
              Trusted by teams at
            </p>
            <div className="flex items-center justify-center gap-8">
              {/* OpenAI */}
              <div className="flex items-center gap-1.5 text-white opacity-50 hover:opacity-80 transition-opacity duration-150 cursor-default">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
                </svg>
                <span className="text-sm font-medium">OpenAI</span>
              </div>

              {/* Clerk */}
              <div className="flex items-center gap-1.5 text-white opacity-50 hover:opacity-80 transition-opacity duration-150 cursor-default">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
                <span className="text-sm font-medium">Clerk</span>
              </div>

              {/* Claude */}
              <div className="flex items-center gap-1.5 text-white opacity-50 hover:opacity-80 transition-opacity duration-150 cursor-default">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span className="text-sm font-medium">Claude</span>
              </div>

              {/* Supabase */}
              <div className="flex items-center gap-1.5 text-white opacity-50 hover:opacity-80 transition-opacity duration-150 cursor-default">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span className="text-sm font-medium">Supabase</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}