import React from 'react'

export const ThinkingIndicator = ({ label }) => (
  <div className="flex items-center gap-2.5 py-1" role="status" aria-live="polite">
    <span className="flex items-center gap-1">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: '0.15s' }} />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: '0.3s' }} />
    </span>
    <span className="shimmer-text text-sm">{label || 'Thinking…'}</span>
  </div>
)
