import * as React from 'react'
import { cn } from '@/lib/utils'

// ponytail: native select styled to theme; swap for radix-select only when custom dropdown UI needed
export const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'input-field w-full rounded-xl border border-resonance-border bg-resonance-bg-tertiary px-3 py-2 text-sm text-resonance-text-primary focus:outline-none focus:border-resonance-accent',
      className
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'
