import React, { useState, useRef, useEffect } from 'react'
import Message from './Message'
import FileUpload from './FileUpload'
import PhotoViewer from './PhotoViewer'
import EmojiPicker from './EmojiPicker'
import Avatar from './Avatar'

export default function ChatWindow({ conversation, messages, user, sendMessage, socket, apiFetch, onlineUsers = [], pinnedMessage, onPin, onUnpin, background, onBack, mobileShowChat }) {
  const [text, setText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editMsg, setEditMsg] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [showForwardPicker, setShowForwardPicker] = useState(false)
  const [photoViewer, setPhotoViewer] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showUserInfo, setShowUserInfo] = useState(false)
  const [groupParticipants, setGroupParticipants] = useState([])
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleTypingStart = ({ userId }) => { setTypingUser(userId); setIsTyping(true) }
    const handleTypingStop = () => { setIsTyping(false); setTypingUser(null) }
    socket.on('typing:start', handleTypingStart)
    socket.on('typing:stop', handleTypingStop)
    return () => { socket.off('typing:start', handleTypingStart); socket.off('typing:stop', handleTypingStop) }
  }, [socket])

  const handleSend = (e) => {
    e.preventDefault()
    if (editMsg) {
      if (text.trim()) {
        apiFetch(`/api/messages/${editMsg.id}`, {
          method: 'PUT',
          body: JSON.stringify({ content: text.trim() }),
        })
        setEditMsg(null)
        setText('')
        socket.emit('typing:stop', { conversationId: conversation.id, userId: user.id })
      }
      return
    }
    if (text.trim()) {
      sendMessage(text.trim(), 'text', null, replyTo?.id || null)
      setText('')
      setReplyTo(null)
      setShowEmojiPicker(false)
      socket.emit('typing:stop', { conversationId: conversation.id, userId: user.id })
    }
  }

  const handleTyping = (e) => {
    setText(e.target.value)
    socket.emit('typing:start', { conversationId: conversation.id, userId: user.id })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: conversation.id, userId: user.id })
    }, 2000)
  }

  const handleFileSent = (fileUrl, type) => {
    const content = type === 'image' ? 'Фото' : type === 'video' ? 'Видео' : 'Файл'
    sendMessage(content, type, fileUrl, replyTo?.id || null)
    setReplyTo(null)
  }

  const handleReply = (message) => {
    setReplyTo(message)
    setEditMsg(null)
    inputRef.current?.focus()
  }

  const handleEdit = (message) => {
    setEditMsg(message)
    setReplyTo(null)
    setText(message.content || '')
    inputRef.current?.focus()
  }

  const handleDelete = async (message) => {
    if (!confirm('Удалить это сообщение?')) return
    try {
      await apiFetch(`/api/messages/${message.id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleForward = (message) => {
    setForwardMsg(message)
    setShowForwardPicker(true)
  }

  const forwardToConversation = async (convId) => {
    if (!forwardMsg) return
    try {
      await apiFetch(`/api/messages/${forwardMsg.id}/forward`, {
        method: 'POST',
        body: JSON.stringify({ conversationId: convId }),
      })
    } catch (err) {
      console.error('Forward failed:', err)
    }
    setShowForwardPicker(false)
    setForwardMsg(null)
  }

  const handleEmojiSelect = (emoji) => {
    setText(prev => prev + emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  const handleReact = (messageId, emoji) => {
    if (!conversation) return
    socket.emit('reaction:toggle', { messageId, emoji, conversationId: conversation.id })
  }

  const cancelReply = () => { setReplyTo(null); setEditMsg(null); setText('') }

  const getDisplayName = () => {
    if (!conversation) return 'Новый чат'
    if (conversation.type === 'group') return conversation.name || 'Группа'
    return conversation.other_username || conversation.name || 'Новый чат'
  }

  const isOnline = conversation && conversation.type === 'private' && onlineUsers.includes(conversation.other_user_id)

  const toggleGroupInfo = async () => {
    if (!conversation) return
    if (conversation.type !== 'group') {
      setShowUserInfo(!showUserInfo)
      return
    }
    if (showUserInfo) {
      setShowUserInfo(false)
      return
    }
    try {
      const res = await apiFetch(`/api/conversations/${conversation.id}/participants`)
      const data = await res.json()
      setGroupParticipants(Array.isArray(data) ? data : [])
    } catch {
      setGroupParticipants([])
    }
    setShowUserInfo(true)
  }

  const getDateStr = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Сегодня'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getGroupClass = (msg, i) => {
    if (msg.type === 'emoji') return ''
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const sameSenderAsPrev = prev && prev.sender_id === msg.sender_id
    const sameSenderAsNext = next && next.sender_id === msg.sender_id
    const sameDayAsPrev = prev && new Date(prev.created_at).toDateString() === new Date(msg.created_at).toDateString()
    const sameDayAsNext = next && new Date(next.created_at).toDateString() === new Date(msg.created_at).toDateString()
    if (!sameSenderAsPrev || !sameDayAsPrev) {
      if (sameSenderAsNext && sameDayAsNext) return 'grouped-first'
      return ''
    }
    if (sameSenderAsNext && sameDayAsNext) return 'grouped-mid'
    return 'grouped-last'
  }

  const getDateSeparators = () => {
    const result = []
    let lastDate = ''
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const msgDate = new Date(msg.created_at).toDateString()
      if (msgDate !== lastDate) {
        result.push({ type: 'date', date: msg.created_at, key: `date-${msgDate}` })
        lastDate = msgDate
      }
      result.push({ type: 'msg', msg, key: msg.id, index: i })
    }
    return result
  }

  const items = getDateSeparators()

  if (!conversation) {
    return (
      <div className={`chat-window empty ${!mobileShowChat ? 'hidden-mobile-chat' : ''}`}>
        <div className="empty-state">
          <h2>Messenger</h2>
          <p>Выберите чат или начните новый</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-window ${!mobileShowChat ? 'hidden-mobile-chat' : ''}`}>
      {background && <div className="chat-bg" style={{ backgroundImage: `url(${background})` }} />}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={() => onBack?.()}>←</button>
        <Avatar
          user={{ username: getDisplayName(), avatar: conversation.avatar, avatar_emoji: conversation.avatar_emoji, avatar_color: conversation.avatar_color }}
          className="clickable"
          onClick={toggleGroupInfo}
        />
        <div className="chat-header-info">
          <h3>{getDisplayName()}</h3>
          {isTyping ? (
            <span className="typing-indicator">печатает...</span>
          ) : isOnline ? (
            <span className="typing-indicator" style={{color: 'var(--online)'}}>в сети</span>
          ) : null}
        </div>
      </div>

      {pinnedMessage && (
        <div className="pinned-bar" onClick={() => {
          const el = document.querySelector(`[data-msg-id="${pinnedMessage.id}"]`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}>
          <div className="pinned-bar-info">
            <span className="pinned-bar-label">Закреплённое</span>
            <span className="pinned-bar-text">
              {pinnedMessage.sender_name ? `${pinnedMessage.sender_name}: ` : ''}
              {pinnedMessage.type === 'image' ? 'Фото' : pinnedMessage.type === 'video' ? 'Видео' : pinnedMessage.content || 'Сообщение'}
            </span>
          </div>
          <button className="pinned-bar-close" onClick={(e) => { e.stopPropagation(); onUnpin?.() }}>✕</button>
        </div>
      )}

      {showUserInfo && (
        <div className="user-info-popup-overlay" onClick={() => setShowUserInfo(false)}>
          <div className="user-info-popup" onClick={(e) => e.stopPropagation()}>
            {conversation.type === 'group' ? (
              <>
                <h3>{conversation.name || 'Группа'}</h3>
                <p className="user-info-handle" style={{marginBottom: 12}}>{groupParticipants.length} участников</p>
                <div className="group-participants-list">
                  {groupParticipants.map(p => (
                    <div key={p.id} className="group-participant">
                      <Avatar user={p} size="small" />
                      <span>{p.username}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Avatar
                  user={{ username: conversation.other_username || conversation.name || '?', avatar: conversation.avatar, avatar_emoji: conversation.avatar_emoji, avatar_color: conversation.avatar_color }}
                  size="large"
                />
                <h3>{conversation.other_username || conversation.name}</h3>
                {conversation.other_handle && <p className="user-info-handle">@{conversation.other_handle}</p>}
              </>
            )}
            <button className="user-info-close" onClick={() => setShowUserInfo(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {showForwardPicker && (
        <div className="forward-picker-overlay" onClick={() => { setShowForwardPicker(false); setForwardMsg(null) }}>
          <div className="forward-picker" onClick={(e) => e.stopPropagation()}>
            <h3>Переслать в...</h3>
            <div className="forward-list">
              {conversation && (
                <div className="forward-item" onClick={() => { forwardToConversation(conversation.id); setShowForwardPicker(false) }}>
                  <Avatar user={{ username: getDisplayName(), avatar: conversation.avatar, avatar_emoji: conversation.avatar_emoji, avatar_color: conversation.avatar_color }} size="small" />
                  <span>{getDisplayName()}</span>
                </div>
              )}
            </div>
            <button className="forward-cancel" onClick={() => { setShowForwardPicker(false); setForwardMsg(null) }}>Отмена</button>
          </div>
        </div>
      )}

      <div className="messages-container">
        {items.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="date-separator">
                <span>{getDateStr(item.date)}</span>
              </div>
            )
          }
          const msg = item.msg
          const groupClass = getGroupClass(msg, item.index)
          return (
            <Message
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === user.id}
              groupClass={groupClass}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onForward={handleForward}
              onPin={onPin}
              onImageClick={setPhotoViewer}
              onReact={handleReact}
              currentUserId={user.id}
              onlineUsers={conversation.type === 'group' ? [] : []}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {(replyTo || editMsg) && (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <span className="reply-bar-name">{editMsg ? 'Редактирование' : replyTo.sender_name}</span>
            <span className="reply-bar-text">
              {editMsg ? (editMsg.content || 'Сообщение') : (
                replyTo.type === 'image' ? 'Фото' : replyTo.type === 'video' ? 'Видео' : replyTo.type === 'audio' ? 'Аудио' : replyTo.type === 'file' ? 'Файл' : replyTo.content || 'Сообщение'
              )}
            </span>
          </div>
          <button className="reply-bar-close" onClick={cancelReply}>✕</button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
        </div>
      )}

      <form className="message-input-form" onSubmit={handleSend}>
        <FileUpload onFileSent={handleFileSent} />
        <button type="button" className="icon-btn upload-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>☺</button>
        <input
          ref={inputRef}
          type="text"
          placeholder={editMsg ? 'Редактировать сообщение...' : replyTo ? 'Ответ...' : 'Напишите сообщение...'}
          value={text}
          onChange={handleTyping}
        />
        <button type="submit" disabled={!text.trim()}>➤</button>
      </form>

      {photoViewer && <PhotoViewer src={photoViewer} onClose={() => setPhotoViewer(null)} />}
    </div>
  )
}
