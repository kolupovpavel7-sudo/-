import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import AuthScreen from './components/AuthScreen'
import HandleModal from './components/HandleModal'

const API = ''
const socket = io(API || window.location.origin)

function getToken() {
  return localStorage.getItem('token')
}

function apiFetch(url, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API}${url}`, { ...options, headers })
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('settings')) || { theme: 'dark', background: null }
  } catch { return { theme: 'dark', background: null } }
}

function saveSettings(s) {
  localStorage.setItem('settings', JSON.stringify(s))
}

function isEmojiOnly(str) {
  if (!str || str.length > 8) return false
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\u200D)(?:\s*(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\u200D))*$/u
  return emojiRegex.test(str.trim())
}

export default function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(getToken())
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [settings, setSettings] = useState(loadSettings)
  const [pinnedMessage, setPinnedMessage] = useState(null)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const userRef = useRef(user)
  const activeConversationRef = useRef(activeConversation)
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { activeConversationRef.current = activeConversation }, [activeConversation])

  useEffect(() => {
    document.documentElement.className = settings.theme === 'light' ? 'theme-light' : ''
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  useEffect(() => {
    if (user) {
      socket.emit('user:online', user.id)
      loadConversations(user.id)
    }
  }, [user])

  useEffect(() => {
    if (activeConversation) {
      socket.emit('conversation:join', activeConversation.id)
      loadMessages(activeConversation.id)
      loadPinnedMessage(activeConversation.id)
      markMessagesRead(activeConversation.id)
      return () => socket.emit('conversation:leave', activeConversation.id)
    } else {
      setMessages([])
      setPinnedMessage(null)
    }
  }, [activeConversation?.id])

  useEffect(() => {
    const handleOnline = (ids) => setOnlineUsers(ids)

    const handleNewMessage = (msg) => {
      const current = activeConversationRef.current
      if (current && msg.conversation_id === current.id) {
        setMessages((prev) => [...prev, msg])
        if (msg.sender_id !== userRef.current?.id) {
          apiFetch(`/api/messages/${msg.id}/read`, { method: 'POST' }).catch(() => {})
        }
      }
      const u = userRef.current
      if (u) loadConversations(u.id)
    }

    const handleReactions = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, reactions } : m))
    }

    const handleConvDeleted = ({ conversationId }) => {
      setConversations(prev => prev.filter(c => c.id !== conversationId))
      setActiveConversation(prev => prev?.id === conversationId ? null : prev)
      setMessages(prev => {
        const conv = activeConversationRef.current
        if (conv && conv.id === conversationId) return []
        return prev
      })
    }

    socket.on('users:online', handleOnline)
    socket.on('message:new', handleNewMessage)
    socket.on('message:reactions', handleReactions)
    socket.on('conversation:deleted', handleConvDeleted)
    socket.on('message:edited', ({ message }) => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, ...message } : m))
    })
    socket.on('message:deleted', ({ messageId, conversationId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    })
    socket.on('conversation:pinned', ({ conversationId, pinnedMessage: pm }) => {
      const cur = activeConversationRef.current
      if (cur && cur.id === conversationId) setPinnedMessage(pm)
    })
    socket.on('message:read', ({ messageId, readBy }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) return { ...m, readBy }
        return m
      }))
    })

    return () => {
      socket.off('users:online', handleOnline)
      socket.off('message:new', handleNewMessage)
      socket.off('message:reactions', handleReactions)
      socket.off('conversation:deleted', handleConvDeleted)
      socket.off('message:edited')
      socket.off('message:deleted')
      socket.off('conversation:pinned')
      socket.off('message:read')
    }
  }, [])

  useEffect(() => {
    if (token) {
      apiFetch('/api/auth/me')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          if (data.id) setUser(data)
          else { setToken(null); localStorage.removeItem('token') }
        })
        .catch(() => { setToken(null); localStorage.removeItem('token') })
    }
  }, [])

  const loadConversations = async (userId) => {
    try {
      const res = await apiFetch(`/api/conversations/${userId}`)
      const data = await res.json()
      setConversations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }

  const loadMessages = async (convId) => {
    try {
      const res = await apiFetch(`/api/messages/${convId}`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const loadPinnedMessage = async (convId) => {
    try {
      const res = await apiFetch(`/api/conversations/${convId}/pinned`)
      const data = await res.json()
      setPinnedMessage(data.pinnedMessage || null)
    } catch {
      setPinnedMessage(null)
    }
  }

  const markMessagesRead = async (convId) => {
    try {
      const res = await apiFetch(`/api/messages/${convId}`)
      const data = await res.json()
      if (!Array.isArray(data)) return
      for (const msg of data) {
        if (msg.sender_id !== user?.id) {
          apiFetch(`/api/messages/${msg.id}/read`, { method: 'POST' }).catch(() => {})
        }
      }
    } catch {}
  }

  const pinMessage = async (messageId) => {
    if (!activeConversation) return
    try {
      const res = await apiFetch(`/api/conversations/${activeConversation.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      })
      const data = await res.json()
      setPinnedMessage(data.pinnedMessage)
    } catch (err) {
      console.error('Pin failed:', err)
    }
  }

  const unpinMessage = async () => {
    if (!activeConversation) return
    try {
      await apiFetch(`/api/conversations/${activeConversation.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ messageId: null }),
      })
      setPinnedMessage(null)
    } catch (err) {
      console.error('Unpin failed:', err)
    }
  }

  const deleteConversation = async (convId) => {
    try {
      const res = await apiFetch(`/api/conversations/${convId}`, { method: 'DELETE' })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId))
        if (activeConversation?.id === convId) {
          setActiveConversation(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const createConversation = async (participantIds, name, type) => {
    const convType = type || (participantIds.length > 2 ? 'group' : 'private')

    if (convType === 'private' && participantIds.length === 1) {
      const existing = conversations.find(c =>
        c.type === 'private' && c.other_user_id === participantIds[0]
      )
      if (existing) {
        setActiveConversation(existing)
        setMobileShowChat(true)
        return existing
      }
    }

    const res = await apiFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        name,
        type: convType,
        participantIds: [...participantIds, user.id],
      }),
    })
    const conv = await res.json()
    await loadConversations(user.id)
    setActiveConversation(conv)
    setMobileShowChat(true)
    return conv
  }

  const sendMessage = (content, type = 'text', fileUrl = null, replyTo = null) => {
    if (!activeConversation) return
    const emojiOnly = type === 'text' && isEmojiOnly(content)
    socket.emit('message:send', {
      conversationId: activeConversation.id,
      senderId: user.id,
      content,
      type: emojiOnly ? 'emoji' : (type || 'text'),
      fileUrl,
      replyTo,
    })
  }

  const handleAuth = (userData, userToken) => {
    setUser(userData)
    setToken(userToken)
  }

  const handleLogout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    setConversations([])
    setActiveConversation(null)
    setMessages([])
    setOnlineUsers([])
  }

  const handleAvatarChange = (userData) => {
    if (typeof userData === 'string') {
      setUser(prev => ({ ...prev, avatar: userData }))
    } else {
      setUser(prev => ({ ...prev, ...userData }))
    }
  }

  const handleHandleSet = (updatedUser) => {
    setUser(updatedUser)
  }

  const handleUpdateSettings = (patch) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  const handleUpdateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }))
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />
  }

  return (
    <div className="app">
      {!user.handle && (
        <HandleModal user={user} apiFetch={apiFetch} onHandleSet={handleHandleSet} />
      )}
      <Sidebar
        user={user}
        conversations={conversations}
        activeConversation={activeConversation}
        onNewConversation={createConversation}
        onDeleteConversation={deleteConversation}
        onlineUsers={onlineUsers}
        onLogout={handleLogout}
        onAvatarChange={handleAvatarChange}
        apiFetch={apiFetch}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onUpdateUser={handleUpdateUser}
        onSelectConversation={(conv) => { setActiveConversation(conv); setMobileShowChat(true) }}
        mobileShowChat={mobileShowChat}
      />
      <ChatWindow
        conversation={activeConversation}
        messages={messages}
        user={user}
        sendMessage={sendMessage}
        socket={socket}
        apiFetch={apiFetch}
        onlineUsers={onlineUsers}
        background={settings.background}
        pinnedMessage={pinnedMessage}
        onPin={pinMessage}
        onUnpin={unpinMessage}
        onBack={() => setMobileShowChat(false)}
        mobileShowChat={mobileShowChat}
      />
    </div>
  )
}
