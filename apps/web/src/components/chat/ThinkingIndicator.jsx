import React from 'react'

/* Animated "thinking" row shown before/while the assistant works */
export const ThinkingIndicator = ({ label }) => (
  <div className="flex items-center gap-2.5 py-1" role="status" aria-live="polite">
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-resonance-accent typing-dot" />
      <span className="w-1.5 h-1.5 rounded-full bg-resonance-accent typing-dot" style={{ animationDelay: '0.15s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-resonance-accent typing-dot" style={{ animationDelay: '0.3s' }} />
    </span>
    <span className="text-sm shimmer-text">{label || 'Thinking…'}</span>
  </div>
)
