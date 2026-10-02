import * as React from 'react'
import { cn } from '@/lib/utils'

// ponytail: native overflow instead of radix-scroll-area dep; add when a11y audit demands it
export const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('relative overflow-auto', className)} {...props}>
    {children}
  </div>
))
ScrollArea.displayName = 'ScrollArea'
