import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function PhotoViewer({ src, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="photo-viewer" onClick={onClose}>
      <div className="photo-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="photo-viewer-close" onClick={onClose}>✕</button>
        <img src={src} alt="Фото" />
      </div>
    </div>,
    document.body
  )
}
