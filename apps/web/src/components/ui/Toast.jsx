import React, { createContext, useCallback, useContext } from 'react'
import { Toaster, toast } from 'sonner'
import { useThemeStore } from '@/stores/themeStore'

const ToastContext = createContext(null)

const notifyByType = {
  success: toast.success,
  error: toast.error,
  warning: toast.warning,
  info: toast.info,
}

export const ToastProvider = ({ children }) => {
  const parent = useContext(ToastContext)
  const theme = useThemeStore((s) => s.theme)

  const addToast = useCallback((messageOrOptions, type = 'info', duration = 4000) => {
    const options =
      typeof messageOrOptions === 'object' && messageOrOptions !== null
        ? messageOrOptions
        : { message: messageOrOptions }
    const kind = options.type || type
    const notify = notifyByType[kind] || toast.info
    notify(options.message, { duration: options.duration || duration })
  }, [])

  const removeToast = useCallback(() => {}, [])

  if (parent) return children

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showToast: addToast }}>
      {children}
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
