import React, { useState, useEffect } from 'react'

const FLOATING_EMOJIS = ['💬', '✉️', '🔒', '👋', '🚀', '🔔', '📌', '❤️', '✨', '🎯', '💡', '🌟', '🎪', '🎨', '🎵', '⭐']

function generateParticles() {
  const particles = []
  for (let i = 0; i < 40; i++) {
    const startX = 5 + Math.random() * 90
    const drift = -40 + Math.random() * 80
    const dur = 10 + Math.random() * 15
    const delay = Math.random() * 12
    const size = 14 + Math.random() * 20
    particles.push({
      emoji: FLOATING_EMOJIS[i % FLOATING_EMOJIS.length],
      style: {
        left: `${startX}%`,
        top: '-40px',
        fontSize: `${size}px`,
        animation: `emojiFall ${dur}s ${delay}s linear infinite`,
        '--drift': `${drift}px`,
      }
    })
  }
  return particles
}

export default function AuthScreen({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [particles] = useState(() => generateParticles())
  const [formKey, setFormKey] = useState(0)

  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const url = isLogin ? '/api/auth/login' : '/api/auth/register'
    const body = isLogin
      ? { email, password }
      : { username, handle: handle.replace('@', ''), email, password }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      onAuth(data.user, data.token)
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (toLogin) => {
    if (toLogin === isLogin) return
    setError('')
    setIsLogin(toLogin)
    setUsername('')
    setHandle('')
    setEmail('')
    setPassword('')
    setFormKey(k => k + 1)
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg">
        <div className="auth-bg-gradient" />
        {particles.map((p, i) => (
          <div key={i} className="floating-emoji" style={p.style}>{p.emoji}</div>
        ))}
      </div>

      <div className={`auth-card ${mounted ? 'auth-card-visible' : ''}`}>
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <circle cx="24" cy="24" r="24" fill="#3390ec"/>
              <path d="M10 24.5C10 24.5 14 21 24 14C24 14 20 24 20 28C20 32 24 24 24 24C24 24 32 16 38 12C38 12 34 28 26 34C26 34 30 24 28 20C28 20 24 34 22 38C22 38 20 26 16 24C16 24 14 28 10 24.5Z" fill="white"/>
            </svg>
          </div>
          <h1>Messenger</h1>
          <p className="auth-subtitle">Быстрый и безопасный обмен сообщениями</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => switchTab(true)}
          >
            Вход
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => switchTab(false)}
          >
            Регистрация
          </button>
        </div>

        <form key={formKey} onSubmit={handleSubmit} className="auth-form auth-form-animated">
          {!isLogin && (
            <div className="auth-field-group">
              <div className="auth-input-wrap">
                <input
                  type="text"
                  placeholder="Имя пользователя"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="auth-input-wrap handle-wrap">
                <span className="handle-prefix">@</span>
                <input
                  type="text"
                  placeholder="username"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace('@', ''))}
                  required
                  maxLength={20}
                />
              </div>
            </div>
          )}

          <div className="auth-input-wrap">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={isLogin}
            />
          </div>

          <div className="auth-input-wrap">
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="auth-error">
              <span className="auth-error-icon">⚠</span>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" />
            ) : isLogin ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  )
}
