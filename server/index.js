import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  CHOICE_DEADLINE,
  ENFORCE_DEADLINE,
  JWT_SECRET,
  PORT,
  SLOTS,
  SLOT_TITLES,
  choiceWindow,
  db,
  portionsBase
} from './db.js'
import { seed } from './seed.js'

// Пустая база (первый запуск на свежем клоне) — заполняем сами,
// чтобы сервер можно было поднять одной командой
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) seed({ log: () => {} })

const app = express()
app.use(cors())
app.use(express.json())

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

// ── Запросы к базе ──────────────────────────────────────────────────────────
const q = {
  userByLogin: db.prepare('SELECT * FROM users WHERE login = ?'),
  userById: db.prepare('SELECT id, login, role, fio, class FROM users WHERE id = ?'),
  dishes: db.prepare('SELECT * FROM dishes ORDER BY slot, id'),
  dishIds: db.prepare('SELECT id FROM dishes'),
  myDishIds: db.prepare('SELECT dish_id FROM user_dish WHERE user_id = ?'),
  clearDishes: db.prepare('DELETE FROM user_dish WHERE user_id = ?'),
  linkDish: db.prepare('INSERT OR IGNORE INTO user_dish (user_id, dish_id) VALUES (?,?)'),
  dayChoices: db.prepare('SELECT slot, attend FROM day_choice WHERE user_id = ? AND date = ?'),
  setChoice: db.prepare(`
    INSERT INTO day_choice (user_id, date, slot, attend) VALUES (?,?,?,?)
    ON CONFLICT (user_id, date, slot)
    DO UPDATE SET attend = excluded.attend, updated_at = datetime('now')
  `),
  declines: db.prepare(
    'SELECT user_id FROM day_choice WHERE date = ? AND slot = ? AND attend = 0'
  ),

  // Опубликованное меню на день/слот
  menuSlot: db.prepare(`
    SELECT d.* FROM menu_day m JOIN dishes d ON d.id = m.dish_id
    WHERE m.date = ? AND m.slot = ? ORDER BY d.id
  `),
  clearMenu: db.prepare('DELETE FROM menu_day WHERE date = ? AND slot = ?'),
  publishMenu: db.prepare('INSERT OR IGNORE INTO menu_day (date, slot, dish_id) VALUES (?,?,?)'),

  // Ученики: в рационе есть блюдо из меню слота, и не отказались от слота
  matchedStudents: db.prepare(`
    SELECT DISTINCT ud.user_id FROM user_dish ud
    JOIN menu_day m ON m.dish_id = ud.dish_id AND m.date = ? AND m.slot = ?
    WHERE ud.user_id NOT IN (
      SELECT user_id FROM day_choice WHERE date = ? AND slot = ? AND attend = 0
    )
  `),
  eatersByDish: db.prepare(`
    SELECT d.id AS dish_id, d.title AS title, COUNT(ud.user_id) AS n
    FROM dishes d
    JOIN menu_day m ON m.dish_id = d.id AND m.date = ? AND m.slot = ?
    LEFT JOIN user_dish ud ON ud.dish_id = d.id
    WHERE ud.user_id NOT IN (
      SELECT user_id FROM day_choice WHERE date = ? AND slot = ? AND attend = 0
    )
    GROUP BY d.id ORDER BY d.id
  `),
  studentsTotal: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),

  // QR-отметки
  addAttendance: db.prepare(
    'INSERT OR IGNORE INTO attendance (user_id, date, slot) VALUES (?,?,?)'
  ),
  attendanceToday: db.prepare('SELECT slot FROM attendance WHERE user_id = ? AND date = ?'),
  attendanceCheck: db.prepare(
    'SELECT 1 FROM attendance WHERE user_id = ? AND date = ? AND slot = ?'
  ),

  // Выпечка
  bakingAll: db.prepare('SELECT * FROM baking_item ORDER BY id'),
  bakingByTitle: db.prepare('SELECT * FROM baking_item WHERE title = ?'),
  bakingInsert: db.prepare('INSERT INTO baking_item (title, qty, price) VALUES (?,?,?)'),
  bakingUpdate: db.prepare(
    "UPDATE baking_item SET qty = ?, price = ?, updated_at = datetime('now') WHERE id = ?"
  ),

  // Отчёт посещаемости за месяц
  monthAttendance: db.prepare(`
    SELECT user_id, slot, COUNT(*) AS n FROM attendance
    WHERE date LIKE ? GROUP BY user_id, slot
  `),
  // Дни отметок по каждому приёму пищи — для дат пропусков в разрезе слота
  monthAttendedDays: db.prepare(`
    SELECT DISTINCT user_id, slot, date FROM attendance WHERE date LIKE ?
  `),
  monthDeclines: db.prepare(`
    SELECT user_id, slot, COUNT(*) AS n FROM day_choice
    WHERE attend = 0 AND date LIKE ? GROUP BY user_id, slot
  `),
  // Дни явного отказа по приёму пищи: в них ученик не обязан был приходить
  monthDeclinedDays: db.prepare(`
    SELECT DISTINCT user_id, slot, date FROM day_choice
    WHERE attend = 0 AND date LIKE ?
  `),
  studentsAll: db.prepare(
    "SELECT id, fio, class FROM users WHERE role = 'student' ORDER BY class, fio"
  )
}

// ── Auth ────────────────────────────────────────────────────────────────────
// Регистрации нет: школа выдаёт логин и пароль (server/data/logins.csv)
function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
}

function publicUser(user) {
  return { id: user.id, login: user.login, role: user.role, fio: user.fio, class: user.class }
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      if (!required) return next()
      return res.status(401).json({ error: 'Требуется вход' })
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      const user = q.userById.get(payload.sub)
      if (!user) return res.status(401).json({ error: 'Пользователь не найден' })
      req.user = user
      return next()
    } catch {
      return res.status(401).json({ error: 'Сессия истекла, войдите заново' })
    }
  }
}

function onlyStaff(req, res, next) {
  if (req.user?.role !== 'staff') return res.status(403).json({ error: 'Только для столовой' })
  next()
}

app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body ?? {}
  const user = q.userByLogin.get(String(login ?? '').trim().toLowerCase())
  if (!user || !bcrypt.compareSync(String(password ?? ''), user.pass_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  res.json({ token: sign(user), user: publicUser(user) })
})

app.get('/api/me', auth(), (req, res) => {
  res.json({ user: req.user, ...choiceWindow() })
})

// ── Каталог блюд и рацион ученика ───────────────────────────────────────────
app.get('/api/dishes', auth(), (_req, res) => {
  res.json({ dishes: q.dishes.all() })
})

app.get('/api/me/dishes', auth(), (req, res) => {
  res.json({ dishIds: q.myDishIds.all(req.user.id).map((r) => r.dish_id) })
})

app.put('/api/me/dishes', auth(), (req, res) => {
  const valid = new Set(q.dishIds.all().map((r) => r.id))
  const ids = (Array.isArray(req.body?.dishIds) ? req.body.dishIds : []).map(Number)
  db.exec('BEGIN')
  try {
    q.clearDishes.run(req.user.id)
    for (const id of ids) if (valid.has(id)) q.linkDish.run(req.user.id, id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    return res.status(400).json({ error: `Не удалось сохранить: ${err.message}` })
  }
  res.json({ dishIds: q.myDishIds.all(req.user.id).map((r) => r.dish_id) })
})

// ── Меню на день ────────────────────────────────────────────────────────────
function menuFor(date) {
  const slots = {}
  for (const slot of SLOTS) {
    const dishes = q.menuSlot.all(date, slot)
    slots[slot] = { published: dishes.length > 0, dishes }
  }
  return { date, slots }
}

app.get('/api/menu', auth(), (req, res) => {
  const date = DATE_RE.test(String(req.query.date ?? ''))
    ? String(req.query.date)
    : choiceWindow().date
  res.json(menuFor(date))
})

// Публикация работником: заменяет набор блюд каждого присланного слота
app.put('/api/menu', auth(), onlyStaff, (req, res) => {
  const date = choiceWindow().date
  const valid = new Set(q.dishIds.all().map((r) => r.id))
  const incoming = req.body?.slots ?? {}
  db.exec('BEGIN')
  try {
    for (const slot of SLOTS) {
      const ids = incoming[slot]
      if (!Array.isArray(ids)) continue // слот не прислан — не трогаем
      q.clearMenu.run(date, slot)
      for (const id of ids.map(Number)) if (valid.has(id)) q.publishMenu.run(date, slot, id)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    return res.status(400).json({ error: `Не удалось опубликовать: ${err.message}` })
  }
  res.json(menuFor(date))
})

// ── Выбор приёмов пищи на день ─────────────────────────────────────────────
// Значение по умолчанию: включён. Если в опубликованном меню слота нет ни
// одного блюда из рациона ученика — слот предвынят (auto). Автоснятие — только
// состояние экрана; отказом считается явная запись attend = 0.
function choicesFor(user, date) {
  const myDishes = new Set(q.myDishIds.all(user.id).map((r) => r.dish_id))
  const stored = q.dayChoices.all(user.id, date)
  const choices = {}
  for (const slot of SLOTS) {
    const row = stored.find((r) => r.slot === slot)
    if (row) {
      choices[slot] = { attend: Boolean(row.attend), auto: false }
      continue
    }
    const menu = q.menuSlot.all(date, slot)
    const eatsSomething = menu.some((d) => myDishes.has(d.id))
    choices[slot] = { attend: menu.length === 0 || eatsSomething, auto: true }
  }
  return choices
}

app.get('/api/me/choices', auth(), (req, res) => {
  const win = choiceWindow()
  res.json({ ...win, choices: choicesFor(req.user, win.date) })
})

app.put('/api/me/choices', auth(), (req, res) => {
  const win = choiceWindow()
  if (!win.open) {
    return res.status(409).json({ error: `Выбор закрыт — до ${CHOICE_DEADLINE}` })
  }
  const incoming = req.body?.choices ?? {}
  db.exec('BEGIN')
  try {
    for (const slot of SLOTS) {
      if (!(slot in incoming)) continue
      q.setChoice.run(req.user.id, win.date, slot, incoming[slot] ? 1 : 0)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    return res.status(400).json({ error: `Не удалось сохранить: ${err.message}` })
  }
  res.json({ ...win, choices: choicesFor(req.user, win.date) })
})

// ── Сводка порций для столовой ──────────────────────────────────────────────
// порции = база − «не ест выбранное» − «отказались»; база — число учеников
app.get('/api/kitchen/portions', auth(), onlyStaff, (_req, res) => {
  const { date } = choiceWindow()
  const base = portionsBase()

  const slots = SLOTS.map((slot) => {
    const menu = q.menuSlot.all(date, slot)
    if (menu.length === 0) {
      return {
        slot,
        title: SLOT_TITLES[slot],
        published: false,
        base,
        skipped: 0,
        declined: 0,
        portions: null,
        dishes: []
      }
    }
    const matched = q.matchedStudents.all(date, slot, date, slot).length
    const declined = q.declines.all(date, slot).length
    const skipped = base - declined - matched

    const dishes = q.eatersByDish.all(date, slot, date, slot).map((r) => ({
      id: r.dish_id,
      title: r.title,
      qty: r.n
    }))

    return {
      slot,
      title: SLOT_TITLES[slot],
      published: true,
      base,
      skipped,
      declined,
      portions: matched,
      dishes
    }
  })

  res.json({ date, base, students: q.studentsTotal.get().n, deadline: CHOICE_DEADLINE, slots })
})

// ── QR-отметки ──────────────────────────────────────────────────────────────
// QR у входа статичный: завтрак / обед / ужин. Повторная отметка за день
// не создаёт дубль — сервер отвечает already: true.
app.post('/api/attendance', auth(), (req, res) => {
  const slot = String(req.body?.slot ?? '')
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: 'Неизвестный приём пищи' })
  const { date } = choiceWindow()

  const already = Boolean(q.attendanceCheck.get(req.user.id, date, slot))
  q.addAttendance.run(req.user.id, date, slot)
  res.json({ slot, date, already })
})

app.get('/api/attendance/today', auth(), (req, res) => {
  const { date } = choiceWindow()
  const slots = q.attendanceToday.all(req.user.id, date).map((r) => r.slot)
  res.json({ date, slots })
})

// ── Выпечка ─────────────────────────────────────────────────────────────────
app.get('/api/baking', auth(), (_req, res) => {
  res.json({ items: q.bakingAll.all() })
})

// Публикация работником: [{ title, qty, price }] — количество и цена
// обновляются, новая позиция создаётся; фото подвешивается позже полем image
app.put('/api/baking', auth(), onlyStaff, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  db.exec('BEGIN')
  try {
    for (const item of items) {
      const title = String(item?.title ?? '').trim()
      const qty = Math.max(0, Math.round(Number(item?.qty) || 0))
      const price = Math.max(0, Math.round(Number(item?.price) || 0))
      if (!title) continue
      const existing = q.bakingByTitle.get(title)
      if (existing) q.bakingUpdate.run(qty, price, existing.id)
      else q.bakingInsert.run(title, qty, price)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    return res.status(400).json({ error: `Не удалось опубликовать: ${err.message}` })
  }
  res.json({ items: q.bakingAll.all() })
})

// ── Отчёт посещаемости для бухгалтерии ──────────────────────────────────────
// Учебные дни — пн–сб (шестидневка), до сегодня включительно.
// Пропуск — учебный день, когда ученик не отметился ни на одном приёме пищи
// и не отказывался явно. Для каждого ученика отдаём список дат пропусков.
app.get('/api/kitchen/attendance', auth(), onlyStaff, (req, res) => {
  const win = choiceWindow()
  const month = MONTH_RE.test(String(req.query.month ?? ''))
    ? String(req.query.month)
    : win.date.slice(0, 7)

  const [y, m] = month.split('-').map(Number)
  const lastDay =
    month === win.date.slice(0, 7) ? Number(win.date.slice(8, 10)) : daysInMonth(y, m)

  // Учебные дни месяца: пн–сб, формат ISO для сравнения с attendance.date
  const schoolDays = []
  for (let day = 1; day <= lastDay; day++) {
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
    if (dow >= 1 && dow <= 6) {
      schoolDays.push(`${month}-${String(day).padStart(2, '0')}`)
    }
  }

  const pattern = `${month}%`
  const attended = groupCount(q.monthAttendance.all(pattern))
  const declined = groupCount(q.monthDeclines.all(pattern))
  const attendedDays = groupDates(q.monthAttendedDays.all(pattern))
  const declinedDays = groupDates(q.monthDeclinedDays.all(pattern))

  const classes = new Map()
  for (const s of q.studentsAll.all()) {
    const key = s.class ?? 'Без класса'
    if (!classes.has(key)) classes.set(key, [])
    const been = attendedDays[s.id] ?? {}
    const skipped = declinedDays[s.id] ?? {}
    const row = { fio: s.fio, slots: {}, missedBySlot: {} }
    for (const slot of SLOTS) {
      const n = attended[s.id]?.[slot] ?? 0
      const d = declined[s.id]?.[slot] ?? 0
      // Пропуск этого приёма: учебный день без QR-отметки и без явного отказа
      const onSlot = been[slot] ?? new Set()
      const offSlot = skipped[slot] ?? new Set()
      const missedDates = schoolDays.filter((day) => !onSlot.has(day) && !offSlot.has(day))
      row.slots[slot] = { attended: n, missed: Math.max(schoolDays.length - n - d, 0) }
      row.missedBySlot[slot] = missedDates
    }
    classes.get(key).push(row)
  }

  res.json({
    month,
    weekdays: schoolDays.length,
    classes: [...classes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([name, rows]) => ({ class: name, rows }))
  })
})

function groupCount(rows) {
  const out = {}
  for (const r of rows) {
    out[r.user_id] ??= {}
    out[r.user_id][r.slot] = r.n
  }
  return out
}

// [{user_id, slot, date}] → { user_id: { slot: Set(date) } }
function groupDates(rows) {
  const out = {}
  for (const r of rows) {
    out[r.user_id] ??= {}
    out[r.user_id][r.slot] ??= new Set()
    out[r.user_id][r.slot].add(r.date)
  }
  return out
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    base: portionsBase(),
    deadline: CHOICE_DEADLINE,
    enforce: ENFORCE_DEADLINE
  })
})

app.use((err, _req, res, _next) => {
  console.error('[api]', err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

app.listen(PORT, () => {
  const control = ENFORCE_DEADLINE ? '' : ', контроль времени выключен'
  console.log(`[api] http://localhost:${PORT}`)
  console.log(
    `[api] база порций: ${portionsBase()} (ученики в базе), дедлайн ${CHOICE_DEADLINE}${control}`
  )
})
