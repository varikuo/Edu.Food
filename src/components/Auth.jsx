import { useState } from 'react'
import { login, setToken } from '../lib/api'

const ACCENT = '#E89B2D'

// Экран входа. Регистрации нет: логин и пароль выдаёт школа
// (файл server/data/logins.csv раздаётся через классных руководителей).
export default function Auth({ onAuthed }) {
  const [form, setForm] = useState({ login: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value }))
  })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await login(form)
      setToken(data.token)
      onAuthed(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input =
    'w-full rounded-2xl bg-[#F5F5F5] px-4 py-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2'

  return (
    <div className="px-6 pt-14">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">Вход</h1>
      <p className="mt-1.5 text-sm text-neutral-400">
        Edu.Food — логин и пароль выдаёт школа
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          {...field('login')}
          placeholder="Логин"
          autoCapitalize="none"
          autoComplete="username"
          className={input}
          required
        />
        <input
          {...field('password')}
          type="password"
          placeholder="Пароль"
          autoComplete="current-password"
          className={input}
          required
        />

        {error && <p className="text-[13px] font-medium text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full py-3.5 text-[15px] font-semibold text-white shadow-sm active:brightness-95 disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          {busy ? 'Подождите…' : 'Войти'}
        </button>
      </form>

      <div className="mt-8 rounded-2xl bg-[#F5F5F5] p-4 text-[13px] leading-relaxed text-neutral-500">
        <p className="font-semibold text-neutral-700">Демо-доступы</p>
        <p className="mt-1">
          ученик — логин и пароль из файла <b>logins.csv</b>
        </p>
        <p>
          столовая — <b>stolovaya</b> / <b>demo1234</b>
        </p>
      </div>
    </div>
  )
}
