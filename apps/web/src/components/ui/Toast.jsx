import React, { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((messageOrOptions, type = 'info', duration = 4000) => {
    let message, toastType, toastDuration

    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
      message = messageOrOptions.message
      toastType = messageOrOptions.type || type
      toastDuration = messageOrOptions.duration || duration
    } else {
      message = messageOrOptions
      toastType = type
      toastDuration = duration
    }

    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type: toastType }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, toastDuration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // showToast is an alias for addToast — Team.jsx expects this
  const showToast = addToast

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
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

const Toast = ({ message, type, onClose }) => {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const colors = {
    success: 'bg-green-500/10 border-green-500/20 text-green-500',
    error: 'bg-red-500/10 border-red-500/20 text-red-500',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  }

  const Icon = icons[type] || Info

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[300px] max-w-md animate-enter ${colors[type] || colors.info}`}
    >
      <Icon size={18} />
      <p className="text-sm flex-1 text-resonance-text-primary">{message}</p>
      <button
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-black/5 transition-colors"
      >
        <X size={14} className="text-resonance-text-muted" />
      </button>
    </div>
  )
}