import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { animations } from '@/lib/anime'

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const contentRef = useRef(null)
  const backdropRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        if (backdropRef.current) animations.backdropFade(backdropRef.current)
        if (contentRef.current) animations.modalEnter(contentRef.current)
      }, 10)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={contentRef}
        className={`relative w-full ${sizes[size]} bg-resonance-bg-elevated rounded-2xl border border-resonance-border shadow-2xl max-h-[90vh] overflow-hidden`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
            <h3 className="text-lg font-semibold text-resonance-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors"
            >
              <X size={20} className="text-resonance-text-muted" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  )
}
