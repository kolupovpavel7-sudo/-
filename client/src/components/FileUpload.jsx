import React, { useRef, useState } from 'react'

export default function FileUpload({ onFileSent, apiFetch }) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.fileUrl) {
        onFileSent(data.fileUrl, data.type)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn upload-btn"
        onClick={() => fileInputRef.current.click()}
        disabled={uploading}
      >
        {uploading ? '...' : '+'}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
      />
    </>
  )
}
