import React from 'react'

export const Card = ({ children, className = '', hover = true, onClick }) => {
  return (
    <div
      className={`card ${hover ? 'hover:shadow-lg hover:shadow-resonance-accent/5' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
