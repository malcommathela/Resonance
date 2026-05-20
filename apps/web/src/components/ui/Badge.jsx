import React from 'react'

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-resonance-bg-tertiary text-resonance-text-secondary',
    success: 'bg-green-500/10 text-green-500 border border-green-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    error: 'bg-red-500/10 text-red-500 border border-red-500/20',
    accent: 'bg-resonance-accent/10 text-resonance-accent border border-resonance-accent/20',
    draft: 'bg-resonance-bg-tertiary text-resonance-text-muted border border-resonance-border',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
