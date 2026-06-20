import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { animations } from '@/lib/anime'

export const Modal = ({ isOpen, onClose, title, children, size = 'md', footer = null }) => {
  const contentRef = useRef(null)
  const backdropRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        if (backdropRef.current) animations.backdropFade(backdropRef.current)
        if (contentRef.current) animations.modalEnter(contentRef.current)
      })
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={contentRef}
        className={`relative w-full ${sizes[size]} bg-resonance-bg-elevated rounded-2xl border border-resonance-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border shrink-0">
            <h3 className="text-lg font-semibold text-resonance-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors"
              aria-label="Close modal"
            >
              <X size={20} className="text-resonance-text-muted" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-resonance-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}