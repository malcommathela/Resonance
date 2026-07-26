import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export const Dropdown = ({ trigger, items, align = 'right', portal = true }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const ref = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target) && triggerRef.current && !triggerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  const handleTriggerClick = (e) => {
    e.stopPropagation()
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: align === 'right' ? rect.right - 192 : rect.left, // 192 = w-48
      })
    }
    setIsOpen(!isOpen)
  }

  const menuContent = (
    <div
      ref={ref}
      className="fixed w-48 bg-resonance-bg-elevated border border-resonance-border rounded-xl shadow-2xl z-[9999] py-1"
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            item.onClick()
            setIsOpen(false)
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
            item.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary'
          }`}
        >
          {item.icon && <item.icon size={14} />}
          {item.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div onClick={handleTriggerClick}>
        {trigger}
      </div>
      {isOpen && (
        portal ? createPortal(menuContent, document.body) : menuContent
      )}
    </div>
  )
}