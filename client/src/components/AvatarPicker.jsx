import React, { useState } from 'react'

const AVATAR_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
  '😎', '🤓', '🧐', '😏', '😒', '😞', '😔', '😟',
  '😕', '🙁', '😮', '😯', '😲', '😳', '🥺', '😢',
  '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀',
  '👻', '👽', '🤖', '💩', '🤡', '👹', '👺', '🎃',
  '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🐣', '🦆', '🦅', '🦉', '🦇',
  '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌',
  '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌿', '☘️',
  '🍀', '🍁', '🍂', '🍃', '🌵', '🌴', '🌳', '🌲',
  '⭐', '🌟', '✨', '💫', '🔥', '💥', '❄️', '🌈',
  '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌧️', '⛈️', '🌩️',
  '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂',
]

const AVATAR_COLORS = [
  '#e94560', '#ff6b6b', '#ee5a24', '#f39c12', '#f1c40f',
  '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#8e44ad',
  '#e74c3c', '#e67e22', '#27ae60', '#2980b9', '#6c5ce7',
  '#fd79a8', '#00cec9', '#6c5ce7', '#a29bfe', '#74b9ff',
  '#55efc4', '#ffeaa7', '#fab1a0', '#81ecec', '#dfe6e9',
  '#636e72', '#2d3436', '#000000', '#ffffff', '#b2bec3',
]

export default function AvatarPicker({ user, apiFetch, onAvatarChange }) {
  const [selectedEmoji, setSelectedEmoji] = useState(user.avatar_emoji || '')
  const [selectedColor, setSelectedColor] = useState(user.avatar_color || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/users/avatar-emoji', {
        method: 'POST',
        body: JSON.stringify({ emoji: selectedEmoji || null, color: selectedColor || null }),
      })
      const data = await res.json()
      if (data.avatar_emoji !== undefined) {
        onAvatarChange(data)
      }
    } catch (err) {
      console.error('Failed to save avatar:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setSelectedEmoji('')
    setSelectedColor('')
  }

  const hasChanges = selectedEmoji !== (user.avatar_emoji || '') || selectedColor !== (user.avatar_color || '')

  return (
    <div className="avatar-picker">
      <div className="avatar-picker-section">
        <h4>Цвет фона</h4>
        <div className="avatar-color-grid">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              className={`avatar-color-btn ${selectedColor === color ? 'selected' : ''}`}
              style={{ background: color, border: color === '#ffffff' ? '2px solid var(--border)' : 'none' }}
              onClick={() => setSelectedColor(color === selectedColor ? '' : color)}
            />
          ))}
        </div>
      </div>

      <div className="avatar-picker-section">
        <h4>Смайлик</h4>
        <div className="avatar-emoji-grid">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className={`avatar-emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
              onClick={() => setSelectedEmoji(emoji === selectedEmoji ? '' : emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="avatar-picker-actions">
        {(selectedEmoji || selectedColor) && (
          <button className="avatar-picker-clear" onClick={handleClear}>Сбросить</button>
        )}
        <button
          className="avatar-picker-save"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
