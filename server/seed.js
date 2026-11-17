import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import { dataDir, db, today } from './db.js'
import { buildAccounts } from './students.js'

// ── Демо-данные ─────────────────────────────────────────────────────────────
// Запуск: npm run seed — полный сброс и заполнение заново.
// Ученики и параллели — в server/students.js; пароли детерминированы от ФИО,
// поэтому повторный сид не меняет уже розданные логины/пароли.

// Фото блюд лежат в public/menu и скачаны из Wikimedia Commons
// под свободными лицензиями (источники — scripts/download-dish-photos.mjs)
const DISHES = [
  // slot, title, image, kcal, protein, fat, carb
  ['breakfast', 'Каша овсяная на молоке', '/menu/oatmeal.jpg', 248, 8.1, 6.2, 38.0],
  ['breakfast', 'Сырники со сметаной', '/menu/syrniki.jpg', 296, 14.5, 12.0, 30.1],
  ['breakfast', 'Омлет с помидором', '/menu/omelet.jpg', 182, 12.4, 13.1, 4.2],
  ['breakfast', 'Блины с творогом', '/menu/blini.jpg', 310, 12.0, 10.5, 42.0],
  ['breakfast', 'Творожная запеканка', '/menu/zapekanka.jpg', 265, 15.2, 8.4, 32.5],
  ['breakfast', 'Каша рисовая молочная', '/menu/rice-porridge.jpg', 232, 7.0, 5.8, 39.0],
  ['lunch', 'Борщ со сметаной', '/menu/borsch.jpg', 214, 7.8, 11.4, 19.6],
  ['lunch', 'Плов с курицей', '/menu/plov.jpg', 336, 16.2, 12.8, 40.3],
  ['lunch', 'Пюре с котлетой', '/menu/pure.jpg', 312, 15.1, 16.4, 26.7],
  ['lunch', 'Щи из свежей капусты', '/menu/shchi.jpg', 198, 6.9, 10.2, 18.4],
  ['lunch', 'Гречка с куриной котлетой', '/menu/buckwheat-cutlet.jpg', 322, 18.4, 11.6, 38.2],
  ['lunch', 'Макароны с сыром', '/menu/macaroni-cheese.jpg', 348, 13.6, 12.9, 44.5],
  ['lunch', 'Салат из свежих овощей', '/menu/vegetable-salad.jpg', 94, 1.8, 6.4, 7.2],
  ['dinner', 'Рыба запечённая с овощами', '/menu/fish.jpg', 224, 21.0, 12.6, 8.4],
  ['dinner', 'Салат с курицей', '/menu/salad.jpg', 168, 13.7, 8.9, 9.1],
  ['dinner', 'Куриная запеканка с картофелем', '/menu/chicken-potato.jpg', 286, 19.8, 11.2, 26.4],
  ['dinner', 'Овощное рагу с рисом', '/menu/vegetable-stew-rice.jpg', 218, 6.4, 7.8, 31.6],
  ['dinner', 'Творожный пудинг', '/menu/curd-pudding.jpg', 204, 14.1, 6.3, 22.0]
]

// Меню, которое «работник» уже опубликовал на сегодня
const MENU_TODAY = {
  breakfast: ['Каша овсяная на молоке', 'Сырники со сметаной'],
  lunch: ['Борщ со сметаной', 'Плов с курицей'],
  dinner: ['Рыба запечённая с овощами', 'Салат с курицей']
}

// Выпечка на сегодня (цена в рублях); нулевое количество покажет «Нет в наличии».
// Второе поле — фото из public/, файл назван по продукту
const BAKING = [
  ['Курник', '/kurnik.jpg', 12, 60],
  ['Шанежка', '/shanejka.jpg', 8, 45],
  ['Сосиска в тесте', '/sosiskavteste.jpg', 25, 35],
  ['Пирожок с капустой', '/kapusta.jpg', 0, 30],
  ['Пирожок с мясом', '/myaso.jpg', 15, 35],
  ['Бургер', '/burger.jpg', 6, 90],
  ['Якутская лепешка', '/lepeshka.jpg', 10, 40]
]

const STAFF_PASSWORD = 'demo1234'

// Детерминированный псевдослучай по строке — для истории посещаемости
function rnd(seed) {
  let h = 2166136261
  for (const ch of seed) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

// Учебные дни месяца: с 1-го по сегодня включительно, пн–сб (шестидневка)
function weekdaysUpToToday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const days = []
  for (let day = 1; day <= d; day++) {
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
    if (dow >= 1 && dow <= 6) {
      days.push(`${dateStr.slice(0, 7)}-${String(day).padStart(2, '0')}`)
    }
  }
  return days
}

export function seed({ log = console.log } = {}) {
  reset()
  log('[seed] база очищена, заполняю заново')

  // ── Блюда ───────────────────────────────────────────────────────────────
  const insertDish = db.prepare(
    'INSERT INTO dishes (title, slot, image, kcal, protein, fat, carb) VALUES (?,?,?,?,?,?,?)'
  )
  const dishIdByTitle = new Map()
  for (const [slot, title, image, kcal, protein, fat, carb] of DISHES) {
    const { lastInsertRowid } = insertDish.run(title, slot, image, kcal, protein, fat, carb)
    dishIdByTitle.set(title, Number(lastInsertRowid))
  }
  const dishesBySlot = { breakfast: [], lunch: [], dinner: [] }
  const slotOfDish = new Map()
  for (const [slot, title] of DISHES) {
    dishesBySlot[slot].push(title)
    slotOfDish.set(title, slot)
  }

  // ── Пользователи ────────────────────────────────────────────────────────
  const insertUser = db.prepare(
    'INSERT INTO users (login, pass_hash, role, fio, class) VALUES (?,?,?,?,?)'
  )
  const linkDish = db.prepare('INSERT OR IGNORE INTO user_dish (user_id, dish_id) VALUES (?,?)')
  const addAttendance = db.prepare(
    'INSERT OR IGNORE INTO attendance (user_id, date, slot) VALUES (?,?,?)'
  )

  insertUser.run('stolovaya', bcrypt.hashSync(STAFF_PASSWORD, 8), 'staff', 'Столовая', null)

  const date = today()
  const history = weekdaysUpToToday(date).filter((d) => d !== date)
  const accounts = buildAccounts()
  const csvLines = ['№;ФИО;Класс;Логин;Пароль']

  accounts.forEach((acc, i) => {
    const { lastInsertRowid } = insertUser.run(
      acc.login,
      bcrypt.hashSync(acc.password, 8),
      'student',
      acc.fio,
      acc.class
    )
    const userId = Number(lastInsertRowid)
    csvLines.push(`${i + 1};${acc.fio};${acc.class};${acc.login};${acc.password}`)

    // Рацион по умолчанию: по одному блюду на приём пищи, у каждого 4-го —
    // второе на обед. Ученик правит его в личном кабинете.
    const diet = [
      dishesBySlot.breakfast[i % dishesBySlot.breakfast.length],
      dishesBySlot.lunch[i % dishesBySlot.lunch.length],
      dishesBySlot.dinner[i % dishesBySlot.dinner.length]
    ]
    if (i % 4 === 0) diet.push(dishesBySlot.lunch[(i + 1) % dishesBySlot.lunch.length])
    for (const title of diet) linkDish.run(userId, dishIdByTitle.get(title))

    // История посещаемости за этот месяц (кроме сегодня): отмечается по
    // слотам рациона, ~90% дней — чтобы отчёт бухгалтерии не был пустым
    for (const day of history) {
      for (const title of diet) {
        if (rnd(`${acc.login}|${day}|${title}`) < 0.9) {
          addAttendance.run(userId, day, slotOfDish.get(title))
        }
      }
    }
  })

  // ── Меню на сегодня ─────────────────────────────────────────────────────
  const publish = db.prepare('INSERT OR IGNORE INTO menu_day (date, slot, dish_id) VALUES (?,?,?)')
  for (const [slot, titles] of Object.entries(MENU_TODAY)) {
    for (const title of titles) publish.run(date, slot, dishIdByTitle.get(title))
  }

  // ── Выпечка ─────────────────────────────────────────────────────────────
  // qty_date — сутки UTC: количество сбрасывается в 00:00 UTC, цена остаётся
  const todayUtc = new Date().toISOString().slice(0, 10)
  const insertBaking = db.prepare(
    'INSERT INTO baking_item (title, image, qty, price, qty_date) VALUES (?,?,?,?,?)'
  )
  for (const [title, image, qty, price] of BAKING) {
    insertBaking.run(title, image, qty, price, todayUtc)
  }

  // ── Файл для раздачи классным руководителям ─────────────────────────────
  const csvPath = path.join(dataDir, 'logins.csv')
  // BOM + разделитель ; — CSV открывается в Excel без плясок с кодировкой
  fs.writeFileSync(csvPath, '\uFEFF' + csvLines.join('\r\n') + '\r\n', 'utf8')

  log(`[seed] учеников: ${accounts.length}, блюд: ${DISHES.length}, выпечки: ${BAKING.length}`)
  log(`[seed] столовая: stolovaya / ${STAFF_PASSWORD}`)
  log(`[seed] логины и пароли: ${csvPath}`)

  return { created: true }
}

// Новые блюда добавляются в каталог позже: досоздаём отсутствующие по паре
// (название, приём пищи), не трогая существующие — id и рационы учеников целы
export function syncDishes() {
  const exists = db.prepare('SELECT id FROM dishes WHERE title = ? AND slot = ?')
  const insert = db.prepare(
    'INSERT INTO dishes (title, slot, image, kcal, protein, fat, carb) VALUES (?,?,?,?,?,?,?)'
  )
  let added = 0
  for (const [slot, title, image, kcal, protein, fat, carb] of DISHES) {
    if (exists.get(title, slot)) continue
    insert.run(title, slot, image, kcal, protein, fat, carb)
    added += 1
  }
  return added
}

// Фото блюд появились позже каталога: дозаполняем пустые поля по названию,
// не затирая уже заданные картинки
export function backfillDishImages() {
  const update = db.prepare(
    "UPDATE dishes SET image = ? WHERE title = ? AND (image IS NULL OR image = '')"
  )
  for (const [, title, image] of DISHES) if (image) update.run(image, title)
}

// Фото выпечки появились позже самих позиций: дозаполняем пустые поля
// по названию, не затирая уже заданные картинки
export function backfillBakingImages() {
  const update = db.prepare(
    "UPDATE baking_item SET image = ? WHERE title = ? AND (image IS NULL OR image = '')"
  )
  for (const [title, image] of BAKING) update.run(image, title)
}

// Полный сброс: снимает и демо-данных, и все прошлые регистрации
export function reset() {
  db.exec(`
    DELETE FROM attendance;
    DELETE FROM menu_day;
    DELETE FROM baking_item;
    DELETE FROM day_choice;
    DELETE FROM user_dish;
    DELETE FROM dishes;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('users','dishes','baking_item');
  `)
}

// Запуск напрямую: node server/seed.js
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) seed()
