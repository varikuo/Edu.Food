// Тонкая обёртка над fetch: базовый путь /api идёт через прокси Vite,
// токен лежит в localStorage и подмешивается в заголовок Authorization.

const TOKEN_KEY = 'mealqr.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export async function request(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error ?? `Ошибка ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

// ── Auth ────────────────────────────────────────────────────────────────────
// Регистрации нет: логин и пароль выдаёт школу (server/data/logins.csv)
export const login = (credentials) => request('/auth/login', { method: 'POST', body: credentials })
export const me = () => request('/me')

// ── Меню и рацион ученика ───────────────────────────────────────────────────
export const getDishes = () => request('/dishes')
export const getMyDishes = () => request('/me/dishes')
export const saveMyDishes = (dishIds) =>
  request('/me/dishes', { method: 'PUT', body: { dishIds } })

// ── Опубликованное меню на день ─────────────────────────────────────────────
export const getMenu = () => request('/menu')
export const publishMenu = (slots) => request('/menu', { method: 'PUT', body: { slots } })

// ── Выбор приёмов пищи на день ─────────────────────────────────────────────
export const getChoices = () => request('/me/choices')
export const saveChoices = (choices) =>
  request('/me/choices', { method: 'PUT', body: { choices } })

// ── Сводка порций для столовой ──────────────────────────────────────────────
export const getPortions = () => request('/kitchen/portions')

// ── QR-отметки у входа ──────────────────────────────────────────────────────
export const scanAttendance = (slot) =>
  request('/attendance', { method: 'POST', body: { slot } })
export const getAttendanceToday = () => request('/attendance/today')

// ── Выпечка ─────────────────────────────────────────────────────────────────
export const getBaking = () => request('/baking')
export const publishBaking = (items) =>
  request('/baking', { method: 'PUT', body: { items } })

// ── Отчёт посещаемости для бухгалтерии ──────────────────────────────────────
export const getAttendanceReport = (month) =>
  request(`/kitchen/attendance?month=${encodeURIComponent(month)}`)
