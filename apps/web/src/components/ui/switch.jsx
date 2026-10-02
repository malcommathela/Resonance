import * as React from 'react'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef(({ className, checked, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={!!checked}
    data-state={checked ? 'checked' : 'unchecked'}
    className={cn(
      'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-resonance-border bg-resonance-bg-tertiary transition-colors data-[state=checked]:bg-resonance-accent',
      className
    )}
    {...props}
  >
    <span
      className={cn(
        'block h-4 w-4 rounded-full bg-resonance-text-primary transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )}
    />
  </button>
))
Switch.displayName = 'Switch'
