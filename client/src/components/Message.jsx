import React, { useState } from 'react'
import Avatar from './Avatar'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export default function Message({ message, isOwn, groupClass = '', onReply, onImageClick, onReact, onEdit, onDelete, onForward, onPin, currentUserId }) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const getReplyPreview = () => {
    if (!message.reply_to) return null
    if (message.reply_type === 'image') return 'Фото'
    if (message.reply_type === 'video') return 'Видео'
    if (message.reply_type === 'audio') return 'Аудио'
    if (message.reply_type === 'file') return 'Файл'
    return message.reply_content || 'Сообщение'
  }

  const renderContent = () => {
    if (message.type === 'emoji') {
      return <span className="message-emoji">{message.content}</span>
    }
    switch (message.type) {
      case 'image':
        return (
          <div className="message-media">
            <img src={message.file_url} alt="Фото" onClick={() => onImageClick?.(message.file_url)} style={{ cursor: 'pointer' }} />
          </div>
        )
      case 'video':
        return <div className="message-media"><video src={message.file_url} controls /></div>
      case 'audio':
        return <div className="message-media"><audio src={message.file_url} controls /></div>
      case 'file':
        return <a href={message.file_url} target="_blank" rel="noreferrer" className="message-file">{message.content || 'Файл'}</a>
      default:
        return <span>{message.content}</span>
    }
  }

  const reactions = message.reactions || []
  const groupedReactions = {}
  for (const r of reactions) {
    if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = { emoji: r.emoji, count: 0, users: [], mine: false }
    groupedReactions[r.emoji].count++
    groupedReactions[r.emoji].users.push(r.username)
    if (r.user_id === currentUserId) groupedReactions[r.emoji].mine = true
  }

  const showAvatar = !groupClass || groupClass === 'grouped-first'
  const showSenderName = !groupClass || groupClass === 'grouped-first'

  return (
    <div
      className={`message ${isOwn ? 'own' : 'other'} ${groupClass}`}
      onMouseLeave={() => { setShowReactionPicker(false); setShowMenu(false) }}
    >
      {!isOwn && (
        <div className={`message-avatar ${!showAvatar ? 'hidden' : ''}`}>
          <Avatar user={{ username: message.sender_name || '?', avatar: message.sender_avatar, avatar_emoji: message.sender_avatar_emoji, avatar_color: message.sender_avatar_color }} size="small" />
        </div>
      )}
      <div className="message-content">
        {showSenderName && !isOwn && <span className="sender-name">{message.sender_name}</span>}
        <div className="message-bubble">
          {message.reply_to && (
            <div className="message-reply-quote">
              <span className="reply-name">{message.reply_sender_name}</span>
              <span className="reply-text">{getReplyPreview()}</span>
            </div>
          )}
          {renderContent()}
          <div className="message-bottom">
            <span className="message-time">
              {formatTime(message.created_at)}
              {isOwn && (
                <span className={`read-receipt ${message.readBy && message.readBy.length > 0 ? 'read' : ''}`}>
                  {message.readBy && message.readBy.length > 0 ? '✓✓' : '✓'}
                </span>
              )}
            </span>
            <button className="reply-btn" onClick={() => setShowMenu(!showMenu)} title="Ещё">⋯</button>
            <button className="reply-btn" onClick={() => onReply?.(message)} title="Ответить">↩</button>
            <button className="reply-btn" onClick={() => setShowReactionPicker(!showReactionPicker)} title="Реакция">☺</button>
          </div>
        </div>

        {showMenu && isOwn && (
          <div className="message-context-menu">
            <button onClick={() => { onEdit?.(message); setShowMenu(false) }}>✏️ Изменить</button>
            <button onClick={() => { onDelete?.(message); setShowMenu(false) }}>🗑 Удалить</button>
            <button onClick={() => { onForward?.(message); setShowMenu(false) }}>↪ Переслать</button>
            <button onClick={() => { onPin?.(message.id); setShowMenu(false) }}>📌 Закрепить</button>
          </div>
        )}

        {showMenu && !isOwn && (
          <div className="message-context-menu">
            <button onClick={() => { onPin?.(message.id); setShowMenu(false) }}>📌 Закрепить</button>
          </div>
        )}

        {Object.keys(groupedReactions).length > 0 && (
          <div className="message-reactions">
            {Object.values(groupedReactions).map((r, i) => (
              <button
                key={i}
                className={`reaction-chip ${r.mine ? 'mine' : ''}`}
                title={r.users.join(', ')}
                onClick={() => onReact?.(message.id, r.emoji)}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {showReactionPicker && (
          <div className="reaction-quick-picker">
            {QUICK_REACTIONS.map(emoji => (
              <button key={emoji} className="reaction-quick-btn" onClick={() => {
                onReact?.(message.id, emoji)
                setShowReactionPicker(false)
              }}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
