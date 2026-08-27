import { useEffect } from 'react'

interface ToastProps {
  message: string
  onDismiss: () => void
}

function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="btn btn-icon" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

export default Toast