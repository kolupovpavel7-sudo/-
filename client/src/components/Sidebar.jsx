import React, { useState, useEffect, useRef } from 'react'
import Settings from './Settings'
import Avatar from './Avatar'

export default function Sidebar({
  user,
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onlineUsers,
  onLogout,
  onAvatarChange,
  apiFetch,
  settings,
  onUpdateSettings,
  onUpdateUser,
  mobileShowChat,
}) {
  const [activeTab, setActiveTab] = useState('chats')
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [showGroupCreate, setShowGroupCreate] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupSelectedUsers, setGroupSelectedUsers] = useState([])
  const [showMenu, setShowMenu] = useState(false)
  const searchTimeout = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    if (!showSearch || search.length < 1) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setSearchResults(data)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [search, showSearch])

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
      setContextMenu(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const startChat = async (userId) => {
    await onNewConversation([userId])
    setShowSearch(false)
    setSearch('')
    setSearchResults([])
  }

  const createGroup = async () => {
    if (groupSelectedUsers.length === 0 || !groupName.trim()) return
    await onNewConversation(groupSelectedUsers, groupName.trim(), 'group')
    setShowGroupCreate(false)
    setGroupName('')
    setGroupSelectedUsers([])
    setSearch('')
    setActiveTab('chats')
  }

  const toggleGroupUser = (u) => {
    setGroupSelectedUsers(prev =>
      prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
    )
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  const getMsgIcon = (conv) => {
    const t = conv.last_message_type
    if (!t || t === 'text' || t === 'emoji') return ''
    if (t === 'image') return '🖼 '
    if (t === 'video') return '🎬 '
    if (t === 'audio') return '🎤 '
    if (t === 'file') return '📎 '
    return ''
  }

  const getConvDisplayName = (conv) => {
    if (conv.type === 'group') return conv.name || 'Группа'
    return conv.other_username || conv.name || 'Новый чат'
  }

  const getConvUser = (conv) => ({
    username: getConvDisplayName(conv),
    avatar: conv.avatar,
    avatar_emoji: conv.avatar_emoji,
    avatar_color: conv.avatar_color,
  })

  const filteredConversations = conversations.filter(c => {
    if (activeTab === 'new') return c.type !== 'favorites' && !c.last_message
    return c.type !== 'favorites'
  })

  return (
    <div className={`sidebar ${mobileShowChat ? 'hidden-mobile' : ''}`} onClick={() => contextMenu && setContextMenu(null)}>
      <div className="sidebar-topbar">
        <button className="sidebar-hamburger" onClick={() => setShowMenu(!showMenu)}>
          ☰
        </button>

        {showSearch ? (
          <div className="sidebar-search-input-wrap">
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="sidebar-search-input"
            />
            <button className="search-close-btn" onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]) }}>✕</button>
          </div>
        ) : (
          <div className="sidebar-search-bar" onClick={() => setShowSearch(true)}>
            <span>Поиск</span>
          </div>
        )}

        <div className="sidebar-topbar-avatars">
          <Avatar user={user} size="small" />
        </div>
      </div>

      {showMenu && (
        <div className="hamburger-menu" ref={menuRef}>
          <div className="hamburger-menu-header">
            <Avatar user={user} size="large" />
            <div className="hamburger-menu-user">
              <span className="hamburger-menu-name">{user.username}</span>
              {user.handle && <span className="hamburger-menu-handle">@{user.handle}</span>}
            </div>
          </div>

          <div className="hamburger-menu-items">
            <button className="hamburger-menu-item" onClick={() => { setShowMenu(false); setActiveTab('settings') }}>
              <span className="hamburger-menu-icon">👤</span>
              <span>Мой профиль</span>
            </button>
            <button className="hamburger-menu-item" onClick={() => { setShowMenu(false); setActiveTab('new'); setShowSearch(true) }}>
              <span className="hamburger-menu-icon">👥</span>
              <span>Новая группа</span>
            </button>
            <button className="hamburger-menu-item" onClick={() => { setShowMenu(false); setShowSearch(true) }}>
              <span className="hamburger-menu-icon">👤</span>
              <span>Контакты</span>
            </button>
            <button className="hamburger-menu-item" onClick={() => { setShowMenu(false); setActiveTab('settings') }}>
              <span className="hamburger-menu-icon">⚙️</span>
              <span>Настройки</span>
            </button>

            <div className="hamburger-menu-separator" />

            <div className="hamburger-menu-item toggle-row">
              <span className="hamburger-menu-icon">🌙</span>
              <span>Ночной режим</span>
              <button
                className={`toggle ${settings.theme === 'light' ? '' : 'active'}`}
                onClick={() => onUpdateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
              />
            </div>
          </div>

          <div className="hamburger-menu-footer">
            <button className="hamburger-menu-item danger" onClick={() => { setShowMenu(false); onLogout() }}>
              <span className="hamburger-menu-icon">🚪</span>
              <span>Выйти</span>
            </button>
            <div className="hamburger-menu-version">Messenger v1.0</div>
          </div>
        </div>
      )}

      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>
          Все чаты
        </button>
        <button className={`sidebar-tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => { setActiveTab('new') }}>
          Новые
        </button>
        <button className={`sidebar-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          Настройки
        </button>
      </div>

      {activeTab === 'settings' && (
        <Settings
          settings={settings}
          onUpdate={onUpdateSettings}
          user={user}
          onLogout={onLogout}
          onAvatarChange={onAvatarChange}
          apiFetch={apiFetch}
          onUpdateUser={onUpdateUser}
        />
      )}

      {showSearch && search.length >= 1 && (
        <div className="conversation-list">
          {searching && <p className="empty-text">Поиск...</p>}
          {!searching && searchResults.length === 0 && (
            <div className="empty-search">
              <p className="empty-text">Ничего не найдено</p>
              <button className="show-all-chats-btn" onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]); setActiveTab('chats') }}>
                Показать все чаты
              </button>
            </div>
          )}
          {searchResults.map((u) => (
            <div key={u.id} className="conv-item" onClick={() => {
              if (showGroupCreate) { toggleGroupUser(u); return }
              startChat(u.id)
            }}>
              <div className="conv-avatar">
                <Avatar user={u} />
                {onlineUsers.includes(u.id) && <div className="conv-online-dot" />}
              </div>
              <div className="conv-body">
                <div className="conv-top">
                  <span className="conv-name">{u.username}</span>
                  {showGroupCreate && (
                    <span className={`group-check ${groupSelectedUsers.includes(u.id) ? 'checked' : ''}`}>
                      {groupSelectedUsers.includes(u.id) ? '✓' : ''}
                    </span>
                  )}
                </div>
                <div className="conv-bottom">
                  <span className="conv-handle">{u.handle ? `@${u.handle}` : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showSearch && (activeTab === 'chats' || activeTab === 'new') && (
        <div className="conversation-list">
          {activeTab === 'new' && (
            <div className="new-chat-actions">
              <button className="new-chat-action-btn" onClick={() => { setShowGroupCreate(!showGroupCreate); setShowSearch(true); setSearch('') }}>
                👥 Создать группу
              </button>
              <button className="new-chat-action-btn" onClick={() => { setShowGroupCreate(false); setShowSearch(true); setSearch('') }}>
                ✉️ Новый чат
              </button>
            </div>
          )}
          {activeTab === 'new' && showGroupCreate && (
            <div className="group-create-form">
              <input
                type="text"
                placeholder="Название группы..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="group-name-input"
                autoFocus
              />
              {groupSelectedUsers.length > 0 && (
                <div className="group-selected-count">{groupSelectedUsers.length} участник(ов)</div>
              )}
              <button
                className="group-create-btn"
                disabled={!groupName.trim() || groupSelectedUsers.length === 0}
                onClick={createGroup}
              >
                Создать группу
              </button>
              {groupSelectedUsers.length === 0 && (
                <p className="empty-text" style={{fontSize: '0.8rem'}}>Найдите участников через поиск ↑</p>
              )}
            </div>
          )}
          {filteredConversations.map((conv) => {
            const lastMsg = conv.last_message
            const msgIcon = getMsgIcon(conv)
            return (
              <div
                key={conv.id}
                className={`conv-item ${activeConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => { onSelectConversation(conv); setActiveTab('chats') }}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, conv }) }}
              >
                <div className="conv-avatar">
                  <Avatar user={getConvUser(conv)} />
                  {conv.type === 'private' && onlineUsers.includes(conv.other_user_id) && <div className="conv-online-dot" />}
                </div>
                <div className="conv-body">
                  <div className="conv-top">
                    <span className="conv-name">
                      {conv.type === 'group' ? '👥 ' : ''}{getConvDisplayName(conv)}
                    </span>
                    {conv.last_message_at && (
                      <span className="conv-time">{formatTime(conv.last_message_at)}</span>
                    )}
                  </div>
                  <div className="conv-bottom">
                    {lastMsg ? (
                      <span className="conv-preview">{msgIcon}{lastMsg}</span>
                    ) : (
                      <span className="conv-preview empty">Начните разговор</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {filteredConversations.length === 0 && (
            <p className="empty-text">Нет чатов</p>
          )}
        </div>
      )}
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button className="context-menu-item danger" onClick={() => {
            if (confirm('Удалить этот чат? Это действие необратимо.')) {
              onDeleteConversation(contextMenu.conv.id)
            }
            setContextMenu(null)
          }}>
            Удалить чат
          </button>
        </div>
      )}
    </div>
  )
}
