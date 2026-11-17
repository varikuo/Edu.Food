import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// Встроенный в Node (>=24) драйвер SQLite: не нужно ничего компилировать,
// база лежит в одном файле и копируется вместе с проектом.
// DATA_DIR переопределяет папку с данными — на хостинге туда монтируют том.

const root = path.dirname(fileURLToPath(import.meta.url))
export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const SLOTS = ['breakfast', 'lunch', 'dinner']

export const SLOT_TITLES = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин'
}

// Демо: база порций на слот. По умолчанию — фактическое число учеников в базе,
// PORTIONS_BASE=N оставляет ручную подстройку (например, PORTIONS_BASE=10,
// чтобы один отказ заметно менял цифры на экране кухни).
export function portionsBase() {
  const manual = Number(process.env.PORTIONS_BASE)
  if (Number.isFinite(manual) && manual > 0) return manual
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get().n
}

// Дедлайн выбора на день и время по умолчанию «как в столовой» (UTC+9).
export const CHOICE_DEADLINE = process.env.CHOICE_DEADLINE ?? '08:15'
export const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? 9 * 60)
export const ENFORCE_DEADLINE = process.env.CHOICE_ENFORCE_DEADLINE === 'true'

export const JWT_SECRET = process.env.JWT_SECRET ?? 'mealqr-dev-secret'
export const PORT = Number(process.env.PORT ?? 8787)
// Прод включается NODE_ENV=production: тогда секрет и CORS обязаны быть заданы
export const IS_PROD = process.env.NODE_ENV === 'production'

export const db = new DatabaseSync(path.join(dataDir, 'mealqr.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    login      TEXT NOT NULL UNIQUE,
    pass_hash  TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','staff')),
    fio        TEXT NOT NULL,
    class      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dishes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    title   TEXT NOT NULL,
    slot    TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner')),
    image   TEXT,
    kcal    INTEGER NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    fat     REAL NOT NULL DEFAULT 0,
    carb    REAL NOT NULL DEFAULT 0
  );

  -- «Перечень блюд, которые ученик ест»: выбирается в личном кабинете
  CREATE TABLE IF NOT EXISTS user_dish (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, dish_id)
  );

  -- Выбор на конкретный день. Записи нет = ученик включён (порция нужна).
  CREATE TABLE IF NOT EXISTS day_choice (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    slot       TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner')),
    attend     INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, date, slot)
  );

  CREATE INDEX IF NOT EXISTS idx_choice_date_slot ON day_choice (date, slot);

  -- Отметка ученика по QR у входа: одна строка на (ученик, день, приём пищи)
  CREATE TABLE IF NOT EXISTS attendance (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    slot       TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, date, slot)
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);

  -- Опубликованное работником меню на день: какие блюда есть в каждом слоте
  CREATE TABLE IF NOT EXISTS menu_day (
    date         TEXT NOT NULL,
    slot         TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner')),
    dish_id      INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (date, slot, dish_id)
  );

  -- Выпечка на продажу: количество штук и актуальная цена, фото позже полем image.
  -- qty_date — сутки (UTC), на которые задано количество: в 00:00 UTC оно
  -- сбрасывается в 0, а цена остаётся до следующей публикации
  CREATE TABLE IF NOT EXISTS baking_item (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL UNIQUE,
    image      TEXT,
    qty        INTEGER NOT NULL DEFAULT 0,
    price      INTEGER NOT NULL DEFAULT 0,
    qty_date   TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Мягкая миграция старых файлов базы: добавляем недостающие колонки
const bakingCols = db.prepare('PRAGMA table_info(baking_item)').all().map((c) => c.name)
if (!bakingCols.includes('price')) {
  db.exec('ALTER TABLE baking_item ADD COLUMN price INTEGER NOT NULL DEFAULT 0')
}
if (!bakingCols.includes('qty_date')) {
  db.exec('ALTER TABLE baking_item ADD COLUMN qty_date TEXT')
}

// ── Время «как в столовой» ──────────────────────────────────────────────────
// Все расчёты идут от смещения TZ_OFFSET_MIN, чтобы телефон с другой часовой
// зоной не мог обойти дедлайн.

export function nowInTableClock() {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60_000)
}

export function today() {
  return nowInTableClock().toISOString().slice(0, 10)
}

export function minutesNow() {
  const t = nowInTableClock()
  return t.getUTCHours() * 60 + t.getUTCMinutes()
}

export function deadlineMinutes() {
  const [h, m] = CHOICE_DEADLINE.split(':').map(Number)
  return h * 60 + m
}

// Дедлайн относится к завтрашнему дню: после 8:15 выбираем уже «на завтра».
export function choiceWindow() {
  const open = !ENFORCE_DEADLINE || minutesNow() < deadlineMinutes()
  return {
    date: today(),
    deadline: CHOICE_DEADLINE,
    enforce: ENFORCE_DEADLINE,
    open
  }
}
