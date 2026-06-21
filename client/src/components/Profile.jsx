import React, { useRef, useState } from 'react'
import AvatarPicker from './AvatarPicker'
import Avatar from './Avatar'

export default function Profile({ user, apiFetch, onAvatarChange }) {
  const fileInputRef = useRef(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/users/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.avatar) onAvatarChange(data.avatar)
    } catch (err) {
      console.error('Avatar upload failed:', err)
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Профиль</h2>
      </div>
      <div className="profile-panel">
        <div className="profile-avatar-section">
          <Avatar user={user} size="large" className="clickable" onClick={() => setShowAvatarPicker(!showAvatarPicker)} />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
        <div className="avatar-picker-buttons">
          <button className="avatar-pick-btn" onClick={() => fileInputRef.current.click()}>
            Загрузить фото
          </button>
          <button className="avatar-pick-btn" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
            Смайлик или цвет
          </button>
        </div>
        {showAvatarPicker && (
          <AvatarPicker user={user} apiFetch={apiFetch} onAvatarChange={onAvatarChange} />
        )}
        <div className="profile-info">
          <h3>{user.username}</h3>
          {user.handle && <p className="profile-handle">@{user.handle}</p>}
          <p>{user.email}</p>
        </div>
      </div>
    </div>
  )
}
