import React, { useState } from 'react'

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim()) {
      onLogin(username.trim())
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Messenger</h1>
        <p>Введите имя для входа</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Ваше имя..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={!username.trim()}>
            Войти
          </button>
        </form>
      </div>
    </div>
  )
}
