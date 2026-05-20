import React from 'react'
import { Tooltip } from './Tooltip'

export const ShortcutButton = ({ shortcut, children, ...props }) => {
  return (
    <Tooltip content={`${shortcut}`}>
      <button {...props}>
        {children}
      </button>
    </Tooltip>
  )
}
