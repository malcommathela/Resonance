import React, { useState, useRef } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'

export const Dropdown = ({ trigger, items, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useClickOutside(() => setIsOpen(false))

  const alignClass = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div className={`absolute ${alignClass} top-full mt-1 w-48 bg-resonance-bg-elevated border border-resonance-border rounded-xl shadow-xl z-50 py-1`}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
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
      )}
    </div>
  )
}
