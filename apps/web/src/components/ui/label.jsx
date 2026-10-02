import * as React from 'react'
import { cn } from '@/lib/utils'

export const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('block text-sm font-medium text-resonance-text-secondary', className)}
    {...props}
  />
))
Label.displayName = 'Label'
