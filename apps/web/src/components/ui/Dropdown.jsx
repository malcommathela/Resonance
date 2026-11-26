import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export const Dropdown = ({ trigger, items, align = 'right', className }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
    <DropdownMenuContent align={align === 'right' ? 'end' : 'start'} className={cn('w-48', className)}>
      {items.map((item, i) => (
        <DropdownMenuItem
          key={i}
          onSelect={item.onClick}
          className={cn(
            'gap-2',
            item.danger && 'text-destructive focus:bg-destructive/10 focus:text-destructive'
          )}
        >
          {item.icon && <item.icon size={14} />}
          {item.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)
