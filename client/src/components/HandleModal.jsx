import React, { useState, useEffect } from 'react'

export default function HandleModal({ user, apiFetch, onHandleSet }) {
  const [handle, setHandle] = useState('')
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (handle.length < 3) {
      setStatus(null)
      return
    }
    const clean = handle.replace('@', '').toLowerCase()
    if (!/^[a-z0-9_]+$/.test(clean)) {
      setStatus({ ok: false, msg: 'Только латиница, цифры и _' })
      return
    }
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/users/check-handle/${clean}`)
        const data = await res.json()
        setStatus(data.available
          ? { ok: true, msg: '@' + clean + ' — доступен' }
          : { ok: false, msg: 'Этот @username уже занят' })
      } catch {
        setStatus(null)
      } finally {
        setChecking(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [handle, apiFetch])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clean = handle.replace('@', '').toLowerCase()
    if (!clean || clean.length < 3 || !status?.ok) return
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/api/users/set-handle', {
        method: 'POST',
        body: JSON.stringify({ handle: clean }),
      })
      const data = await res.json()
      if (data.handle) {
        onHandleSet(data)
      } else {
        setError(data.error || 'Ошибка')
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Создайте @username</h2>
        <p className="modal-desc">Это ваш уникальный идентификатор. Другие смогут找到 вас по нему.</p>
        <form onSubmit={handleSubmit}>
          <div className="handle-input-wrap">
            <span className="handle-prefix">@</span>
            <input
              type="text"
              placeholder="username"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace('@', ''))}
              autoFocus
              maxLength={20}
            />
          </div>
          {handle.length >= 3 && (
            <div className={`handle-status ${status?.ok ? 'ok' : 'bad'}`}>
              {checking ? 'Проверка...' : status?.msg}
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={saving || !status?.ok}>
            {saving ? 'Сохранение...' : 'Готово'}
          </button>
        </form>
      </div>
    </div>
  )
}
