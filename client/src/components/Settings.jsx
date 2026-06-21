import React, { useState, useRef } from 'react'
import AvatarPicker from './AvatarPicker'
import Avatar from './Avatar'

const BACKGROUNDS = [
  { id: 'none', label: 'Нет', value: null },
  { id: 'bg1', label: 'Пляж', value: '/backgrounds/20200209083857_Plyazh_p9014_366.jpg' },
  { id: 'bg2', label: 'Горы', value: '/backgrounds/images (1).jpg' },
  { id: 'bg3', label: 'Ночь', value: '/backgrounds/images.jpg' },
]

export default function Settings({ settings, onUpdate, user, onLogout, onAvatarChange, apiFetch, onUpdateUser }) {
  const fileInputRef = useRef(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

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

  const startEdit = (field) => {
    setEditingField(field)
    setEditValue(field === 'handle' ? (user.handle || '') : user.username)
    setEditError('')
    setEditSuccess('')
  }

  const saveEdit = async () => {
    setEditError('')
    setEditSuccess('')
    if (editingField === 'username') {
      if (editValue.length < 2 || editValue.length > 30) { setEditError('От 2 до 30 символов'); return }
      if (!/^[a-zA-Z0-9 _-]+$/.test(editValue)) { setEditError('Только латиница, цифры, пробел, _ и -'); return }
      try {
        const res = await apiFetch('/api/users/update-username', {
          method: 'POST',
          body: JSON.stringify({ username: editValue }),
        })
        const data = await res.json()
        if (data.username) {
          onUpdateUser(data)
          setEditingField(null)
          setEditSuccess('Имя изменено')
        } else {
          setEditError(data.error || 'Ошибка')
        }
      } catch (err) {
        setEditError('Ошибка сети')
      }
    } else if (editingField === 'handle') {
      const clean = editValue.replace('@', '').toLowerCase()
      if (clean.length < 3) { setEditError('Минимум 3 символа'); return }
      if (!/^[a-z0-9_]+$/.test(clean)) { setEditError('Только латиница, цифры и _'); return }
      try {
        const res = await apiFetch('/api/users/set-handle', {
          method: 'POST',
          body: JSON.stringify({ handle: clean }),
        })
        const data = await res.json()
        if (data.handle) {
          onUpdateUser(data)
          setEditingField(null)
          setEditSuccess('@username изменён')
        } else {
          setEditError(data.error || 'Ошибка')
        }
      } catch (err) {
        setEditError('Ошибка сети')
      }
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Настройки</h2>
      </div>

      <div className="settings-section">
        <h3>Аккаунт</h3>
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
            {editingField === 'username' ? (
              <div className="inline-edit">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  className="inline-edit-input"
                  maxLength={30}
                />
                <div className="inline-edit-buttons">
                  <button className="inline-edit-save" onClick={saveEdit}>✓</button>
                  <button className="inline-edit-cancel" onClick={() => setEditingField(null)}>✕</button>
                </div>
              </div>
            ) : (
              <h3 className="editable-field" onClick={() => startEdit('username')}>
                {user.username} <span className="edit-pencil">✏️</span>
              </h3>
            )}

            {editingField === 'handle' ? (
              <div className="inline-edit">
                <div className="handle-input-wrap">
                  <span className="handle-prefix">@</span>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value.replace('@', ''))}
                    autoFocus
                    className="inline-edit-input handle-input"
                    maxLength={20}
                  />
                </div>
                <div className="inline-edit-buttons">
                  <button className="inline-edit-save" onClick={saveEdit}>✓</button>
                  <button className="inline-edit-cancel" onClick={() => setEditingField(null)}>✕</button>
                </div>
              </div>
            ) : (
              <p className="profile-handle editable-field" onClick={() => startEdit('handle')}>
                {user.handle ? `@${user.handle}` : 'Задать @username'} <span className="edit-pencil">✏️</span>
              </p>
            )}

            <p>{user.email}</p>
          </div>
          {editError && <div className="inline-edit-error">{editError}</div>}
          {editSuccess && <div className="inline-edit-success">{editSuccess}</div>}
          <button className="logout-btn" onClick={onLogout}>Выйти</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Оформление</h3>
        <div className="settings-row">
          <span className="settings-row-label">Светлая тема</span>
          <button
            className={`toggle ${settings.theme === 'light' ? 'active' : ''}`}
            onClick={() => onUpdate({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Фон чата</h3>
        <div className="bg-grid">
          {BACKGROUNDS.map((bg) => (
            <div
              key={bg.id}
              className={`bg-option ${settings.background === bg.value ? 'selected' : ''}`}
              style={bg.value ? { backgroundImage: `url(${bg.value})` } : { background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
              onClick={() => onUpdate({ background: bg.value })}
            >
              {!bg.value && 'Без фона'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
