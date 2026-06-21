import React from 'react'

export default function Avatar({ user, size = 'default', className = '', onClick }) {
  const sizeClass = size === 'small' ? 'small' : size === 'large' ? 'large' : ''

  const getBackgroundStyle = () => {
    if (user.avatar && user.avatar.length > 0) {
      return {}
    }
    if (user.avatar_color) {
      return { backgroundColor: user.avatar_color }
    }
    return {}
  }

  const renderContent = () => {
    if (user.avatar && user.avatar.length > 0) {
      return <img src={user.avatar} alt="" className="avatar-img" />
    }
    if (user.avatar_emoji) {
      return <span className="avatar-emoji">{user.avatar_emoji}</span>
    }
    return user.username?.[0]?.toUpperCase() || '?'
  }

  return (
    <div
      className={`avatar ${sizeClass} ${className}`}
      style={getBackgroundStyle()}
      onClick={onClick}
    >
      {renderContent()}
      {className.includes('clickable') && <div className="avatar-overlay">Изменить</div>}
    </div>
  )
}
